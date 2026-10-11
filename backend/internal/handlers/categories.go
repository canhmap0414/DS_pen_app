package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"ds-pen/backend/internal/ids"
	"ds-pen/backend/internal/models"
)

type CategoryHandler struct {
	DB *gorm.DB
}

type categoryInput struct {
	ParentID    *string `json:"parent_id"`
	Name        string  `json:"name" binding:"required,max=255"`
	Description *string `json:"description" binding:"omitempty,max=2000"`
	IsActive    *bool   `json:"is_active"`
	SortOrder   int     `json:"sort_order" binding:"min=0,max=100000"`
}

type categoryDTO struct {
	ID           string        `json:"id"`
	ParentID     *string       `json:"parent_id"`
	Slug         string        `json:"slug"`
	Name         string        `json:"name"`
	Description  *string       `json:"description"`
	IsActive     bool          `json:"is_active"`
	SortOrder    int           `json:"sort_order"`
	ProductCount int64         `json:"product_count"`
	Children     []categoryDTO `gorm:"-" json:"children,omitempty"`
}

type apiError struct {
	status int
	code   string
}

func (e *apiError) Error() string { return e.code }

func respondErr(c *gin.Context, err error) {
	var ae *apiError
	if errors.As(err, &ae) {
		c.JSON(ae.status, gin.H{"error": ae.code})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
}

// ListPublic returns only active categories; children of an inactive parent are hidden too.
func (h *CategoryHandler) ListPublic(c *gin.Context) {
	h.list(c, true)
}

func (h *CategoryHandler) ListAdmin(c *gin.Context) {
	h.list(c, false)
}

func (h *CategoryHandler) list(c *gin.Context, activeOnly bool) {
	q := h.DB.Table("categories c").
		Select(`c.id, c.parent_id, c.slug, c.is_active, c.sort_order, t.name, t.description,
			(SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS product_count`).
		Joins("JOIN category_translations t ON t.category_id = c.id AND t.language_code = ?", models.DefaultLanguage).
		Order("c.sort_order, c.created_at, c.id")
	if activeOnly {
		q = q.Where("c.is_active")
	}
	var rows []categoryDTO
	if err := q.Scan(&rows).Error; err != nil {
		respondErr(c, err)
		return
	}

	childrenOf := map[string][]categoryDTO{}
	for _, r := range rows {
		if r.ParentID != nil {
			childrenOf[*r.ParentID] = append(childrenOf[*r.ParentID], r)
		}
	}
	tree := []categoryDTO{}
	for _, r := range rows {
		if r.ParentID == nil {
			r.Children = childrenOf[r.ID]
			tree = append(tree, r)
		}
	}
	c.JSON(http.StatusOK, tree)
}

func (h *CategoryHandler) Create(c *gin.Context) {
	in, ok := bindCategory(c)
	if !ok {
		return
	}

	var id string
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := validateParent(tx, in.ParentID, ""); err != nil {
			return err
		}
		if err := ensureNameFree(tx, in.ParentID, in.Name, ""); err != nil {
			return err
		}
		slug, err := uniqueSlug(tx, in.Name)
		if err != nil {
			return err
		}
		cat := models.Category{
			ParentID:           in.ParentID,
			Slug:               slug,
			SourceLanguageCode: models.DefaultLanguage,
			IsActive:           in.IsActive == nil || *in.IsActive,
			SortOrder:          in.SortOrder,
		}
		if err := tx.Create(&cat).Error; err != nil {
			return err
		}
		id = cat.ID
		return tx.Create(&models.CategoryTranslation{
			CategoryID:   cat.ID,
			LanguageCode: models.DefaultLanguage,
			Name:         in.Name,
			Description:  in.Description,
		}).Error
	})
	if err != nil {
		respondErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *CategoryHandler) Update(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	in, ok := bindCategory(c)
	if !ok {
		return
	}

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		var cat models.Category
		if err := tx.Where("id = ?", id).First(&cat).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &apiError{http.StatusNotFound, "not_found"}
			}
			return err
		}
		if err := validateParent(tx, in.ParentID, id); err != nil {
			return err
		}
		if in.ParentID != nil {
			var children int64
			if err := tx.Model(&models.Category{}).Where("parent_id = ?", id).Count(&children).Error; err != nil {
				return err
			}
			if children > 0 {
				return &apiError{http.StatusBadRequest, "has_children"}
			}
		}
		if err := ensureNameFree(tx, in.ParentID, in.Name, id); err != nil {
			return err
		}

		cat.ParentID = in.ParentID
		if in.IsActive != nil {
			cat.IsActive = *in.IsActive
		}
		cat.SortOrder = in.SortOrder
		if err := tx.Model(&cat).Select("ParentID", "IsActive", "SortOrder").Updates(&cat).Error; err != nil {
			return err
		}
		return tx.Model(&models.CategoryTranslation{}).
			Where("category_id = ? AND language_code = ?", id, models.DefaultLanguage).
			Updates(map[string]any{"name": in.Name, "description": in.Description}).Error
	})
	if err != nil {
		respondErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *CategoryHandler) Delete(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		var children, products int64
		if err := tx.Model(&models.Category{}).Where("parent_id = ?", id).Count(&children).Error; err != nil {
			return err
		}
		if children > 0 {
			return &apiError{http.StatusConflict, "has_children"}
		}
		// Soft-deleted products still reference the category, so they block a hard delete as well.
		if err := tx.Table("products").Where("category_id = ?", id).Count(&products).Error; err != nil {
			return err
		}
		if products > 0 {
			return &apiError{http.StatusConflict, "has_products"}
		}
		res := tx.Where("id = ?", id).Delete(&models.Category{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return &apiError{http.StatusNotFound, "not_found"}
		}
		return nil
	})
	if err != nil {
		respondErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func bindCategory(c *gin.Context) (*categoryInput, bool) {
	var in categoryInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return nil, false
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": "name is required"})
		return nil, false
	}
	if in.Description != nil {
		d := strings.TrimSpace(*in.Description)
		if d == "" {
			in.Description = nil
		} else {
			in.Description = &d
		}
	}
	return &in, true
}

func pathID(c *gin.Context) (string, bool) {
	id := ids.Normalize(c.Param("id"))
	if !ids.Valid(id) {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return "", false
	}
	return id, true
}

// validateParent enforces the two-level rule: a parent must itself be a root category.
func validateParent(tx *gorm.DB, parentID *string, selfID string) error {
	if parentID == nil {
		return nil
	}
	if *parentID == selfID {
		return &apiError{http.StatusBadRequest, "invalid_parent"}
	}
	var parent models.Category
	if err := tx.Where("id = ?", *parentID).First(&parent).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &apiError{http.StatusBadRequest, "invalid_parent"}
		}
		return err
	}
	if parent.ParentID != nil {
		return &apiError{http.StatusBadRequest, "parent_must_be_root"}
	}
	return nil
}

func ensureNameFree(tx *gorm.DB, parentID *string, name string, selfID string) error {
	q := tx.Table("categories c").
		Joins("JOIN category_translations t ON t.category_id = c.id AND t.language_code = ?", models.DefaultLanguage).
		Where("LOWER(t.name) = LOWER(?) AND c.id <> ?", name, selfID)
	if parentID == nil {
		q = q.Where("c.parent_id IS NULL")
	} else {
		q = q.Where("c.parent_id = ?", *parentID)
	}
	var n int64
	if err := q.Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		return &apiError{http.StatusConflict, "name_taken"}
	}
	return nil
}

func uniqueSlug(tx *gorm.DB, name string) (string, error) {
	base := slugify(name)
	if base == "" {
		base = "category"
	}
	slug := base
	for i := 2; ; i++ {
		var n int64
		if err := tx.Model(&models.Category{}).Where("slug = ?", slug).Count(&n).Error; err != nil {
			return "", err
		}
		if n == 0 {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, i)
	}
}
