package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"ds-pen/backend/internal/ids"
	"ds-pen/backend/internal/middleware"
	"ds-pen/backend/internal/models"
)

type ProductHandler struct {
	DB *gorm.DB
}

type productInput struct {
	CategoryID      string   `json:"category_id" binding:"required,max=13"`
	Name            string   `json:"name" binding:"required,max=255"`
	Description     *string  `json:"description" binding:"omitempty,max=5000"`
	ProductionYear  int      `json:"production_year" binding:"required,min=1840,max=2100"`
	ProductionMonth *int     `json:"production_month" binding:"omitempty,min=1,max=12"`
	Quantity        int      `json:"quantity" binding:"min=0,max=1000000"`
	PricePoints     int      `json:"price_points" binding:"required,min=1,max=1000000000"`
	Status          string   `json:"status" binding:"required,oneof=published unpublished"`
	Images          []string `json:"images" binding:"max=2,dive,required,max=2048"`
}

type productRow struct {
	ID                 string    `json:"id"`
	Name               string    `json:"name"`
	CategoryID         string    `json:"category_id"`
	CategoryName       string    `json:"category_name"`
	ParentCategoryName *string   `json:"parent_category_name"`
	OwnerID            string    `json:"owner_id"`
	OwnerUsername      string    `json:"owner_username"`
	ProductionYear     int       `json:"production_year"`
	ProductionMonth    *int      `json:"production_month"`
	Quantity           int       `json:"quantity"`
	StockStatus        string    `gorm:"-" json:"stock_status"`
	PricePoints        int       `json:"price_points"`
	Status             string    `json:"status"`
	ThumbnailURL       *string   `json:"thumbnail_url"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type productDetail struct {
	productRow
	Description *string  `json:"description"`
	Images      []string `json:"images"`
}

type productPage struct {
	Items    []productRow `json:"items"`
	Total    int64        `json:"total"`
	Page     int          `json:"page"`
	PageSize int          `json:"page_size"`
}

const productSelect = `p.id, t.name, p.category_id, ct.name AS category_name, pct.name AS parent_category_name,
	p.owner_id, u.username AS owner_username, p.production_year, p.production_month, p.quantity,
	p.price_points, p.status, p.created_at, p.updated_at,
	(SELECT i.image_url FROM product_images i WHERE i.product_id = p.id ORDER BY i.sort_order LIMIT 1) AS thumbnail_url`

var productSorts = map[string]string{
	"created_at":      "p.created_at",
	"price_points":    "p.price_points",
	"quantity":        "p.quantity",
	"production_year": "p.production_year",
}

func (h *ProductHandler) baseQuery() *gorm.DB {
	return h.DB.Table("products p").
		Joins("JOIN product_translations t ON t.product_id = p.id AND t.language_code = ?", models.DefaultLanguage).
		Joins("JOIN categories c ON c.id = p.category_id").
		Joins("LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.language_code = ?", models.DefaultLanguage).
		Joins("LEFT JOIN category_translations pct ON pct.category_id = c.parent_id AND pct.language_code = ?", models.DefaultLanguage).
		Joins("JOIN users u ON u.id = p.owner_id").
		Where("p.deleted_at IS NULL")
}

// List supports filters q, category_id (includes its children), status, stock, owner_id,
// plus page/page_size and sort/order.
func (h *ProductHandler) List(c *gin.Context) {
	page := queryInt(c, "page", 1, 1, 1_000_000)
	pageSize := queryInt(c, "page_size", 20, 1, 100)

	filter := func(q *gorm.DB) *gorm.DB {
		if s := strings.TrimSpace(c.Query("q")); s != "" {
			like := "%" + escapeLike(s) + "%"
			if id := ids.Normalize(strings.TrimPrefix(s, "#")); ids.Valid(id) {
				q = q.Where("(t.name ILIKE ? OR p.id = ?)", like, id)
			} else {
				q = q.Where("t.name ILIKE ?", like)
			}
		}
		if id := ids.Normalize(c.Query("category_id")); ids.Valid(id) {
			q = q.Where("(p.category_id = ? OR c.parent_id = ?)", id, id)
		}
		if id := ids.Normalize(c.Query("owner_id")); ids.Valid(id) {
			q = q.Where("p.owner_id = ?", id)
		}
		switch c.Query("status") {
		case models.ProductStatusPublished, models.ProductStatusUnpublished:
			q = q.Where("p.status = ?", c.Query("status"))
		}
		switch c.Query("stock") {
		case models.StockOut:
			q = q.Where("p.quantity = 0")
		case models.StockLow:
			q = q.Where("p.quantity BETWEEN 1 AND ?", models.LowStockThreshold)
		case models.StockIn:
			q = q.Where("p.quantity > ?", models.LowStockThreshold)
		}
		return q
	}

	var total int64
	if err := filter(h.baseQuery()).Count(&total).Error; err != nil {
		respondErr(c, err)
		return
	}

	orderBy, ok := productSorts[c.Query("sort")]
	if !ok {
		orderBy = "p.created_at"
	}
	dir := "DESC"
	if c.Query("order") == "asc" {
		dir = "ASC"
	}

	rows := []productRow{}
	err := filter(h.baseQuery()).
		Select(productSelect).
		Order(orderBy + " " + dir + ", p.created_at DESC, p.id").
		Limit(pageSize).Offset((page - 1) * pageSize).
		Scan(&rows).Error
	if err != nil {
		respondErr(c, err)
		return
	}
	for i := range rows {
		rows[i].StockStatus = models.StockStatus(rows[i].Quantity)
	}
	c.JSON(http.StatusOK, productPage{Items: rows, Total: total, Page: page, PageSize: pageSize})
}

func (h *ProductHandler) Get(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	var d productDetail
	res := h.baseQuery().Select(productSelect).Where("p.id = ?", id).Limit(1).Scan(&d.productRow)
	if res.Error != nil {
		respondErr(c, res.Error)
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	d.StockStatus = models.StockStatus(d.Quantity)
	var tr models.ProductTranslation
	if err := h.DB.Where("product_id = ? AND language_code = ?", id, models.DefaultLanguage).First(&tr).Error; err != nil {
		respondErr(c, err)
		return
	}
	d.Description = tr.Description
	d.Images = []string{}
	if err := h.DB.Model(&models.ProductImage{}).Where("product_id = ?", id).
		Order("sort_order").Pluck("image_url", &d.Images).Error; err != nil {
		respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *ProductHandler) Create(c *gin.Context) {
	in, ok := bindProduct(c)
	if !ok {
		return
	}

	var id string
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := ensureCategory(tx, in.CategoryID); err != nil {
			return err
		}
		p := models.Product{
			OwnerID:            c.GetString(middleware.CtxUserID),
			CategoryID:         in.CategoryID,
			SourceLanguageCode: models.DefaultLanguage,
			ProductionYear:     in.ProductionYear,
			ProductionMonth:    in.ProductionMonth,
			Quantity:           in.Quantity,
			PricePoints:        in.PricePoints,
			Status:             in.Status,
		}
		if err := tx.Create(&p).Error; err != nil {
			return err
		}
		id = p.ID
		if err := tx.Create(&models.ProductTranslation{
			ProductID:    p.ID,
			LanguageCode: models.DefaultLanguage,
			Name:         in.Name,
			Description:  in.Description,
		}).Error; err != nil {
			return err
		}
		return replaceImages(tx, p.ID, in.Images)
	})
	if err != nil {
		respondErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *ProductHandler) Update(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	in, ok := bindProduct(c)
	if !ok {
		return
	}

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		var p models.Product
		if err := tx.Where("id = ?", id).First(&p).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &apiError{http.StatusNotFound, "not_found"}
			}
			return err
		}
		if err := ensureCategory(tx, in.CategoryID); err != nil {
			return err
		}
		p.CategoryID = in.CategoryID
		p.ProductionYear = in.ProductionYear
		p.ProductionMonth = in.ProductionMonth
		p.Quantity = in.Quantity
		p.PricePoints = in.PricePoints
		p.Status = in.Status
		if err := tx.Model(&p).
			Select("CategoryID", "ProductionYear", "ProductionMonth", "Quantity", "PricePoints", "Status").
			Updates(&p).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.ProductTranslation{}).
			Where("product_id = ? AND language_code = ?", id, models.DefaultLanguage).
			Updates(map[string]any{"name": in.Name, "description": in.Description}).Error; err != nil {
			return err
		}
		return replaceImages(tx, id, in.Images)
	})
	if err != nil {
		respondErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *ProductHandler) UpdateStatus(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	var in struct {
		Status string `json:"status" binding:"required,oneof=published unpublished"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}
	res := h.DB.Model(&models.Product{}).Where("id = ?", id).Update("status", in.Status)
	if res.Error != nil {
		respondErr(c, res.Error)
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	c.Status(http.StatusNoContent)
}

// Delete is a soft delete: orders and chat messages keep pointing at the product.
func (h *ProductHandler) Delete(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	res := h.DB.Where("id = ?", id).Delete(&models.Product{})
	if res.Error != nil {
		respondErr(c, res.Error)
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}
	c.Status(http.StatusNoContent)
}

func bindProduct(c *gin.Context) (*productInput, bool) {
	var in productInput
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
	now := time.Now()
	if in.ProductionYear > now.Year() ||
		(in.ProductionYear == now.Year() && in.ProductionMonth != nil && *in.ProductionMonth > int(now.Month())) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "production_date_future"})
		return nil, false
	}
	for _, img := range in.Images {
		if !strings.HasPrefix(img, uploadURLPrefix) || strings.Contains(img, "..") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_image"})
			return nil, false
		}
	}
	return &in, true
}

func ensureCategory(tx *gorm.DB, id string) error {
	var n int64
	if err := tx.Model(&models.Category{}).Where("id = ?", id).Count(&n).Error; err != nil {
		return err
	}
	if n == 0 {
		return &apiError{http.StatusBadRequest, "invalid_category"}
	}
	return nil
}

func replaceImages(tx *gorm.DB, productID string, urls []string) error {
	if err := tx.Where("product_id = ?", productID).Delete(&models.ProductImage{}).Error; err != nil {
		return err
	}
	for i, u := range urls {
		if err := tx.Create(&models.ProductImage{ProductID: productID, ImageURL: u, SortOrder: i + 1}).Error; err != nil {
			return err
		}
	}
	return nil
}

func queryInt(c *gin.Context, key string, def, lo, hi int) int {
	v, err := strconv.Atoi(c.Query(key))
	if err != nil {
		return def
	}
	return min(max(v, lo), hi)
}

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}
