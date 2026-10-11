package handlers

import (
	"errors"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"ds-pen/backend/internal/ids"
	"ds-pen/backend/internal/middleware"
	"ds-pen/backend/internal/models"
)

type UserHandler struct {
	DB *gorm.DB
}

type userListQuery struct {
	Q        string `form:"q" binding:"max=255"`
	Role     string `form:"role" binding:"omitempty,oneof=admin user"`
	Status   string `form:"status" binding:"omitempty,oneof=active locked"`
	Page     int    `form:"page" binding:"omitempty,min=1"`
	PageSize int    `form:"page_size" binding:"omitempty,min=1,max=100"`
}

type userListResponse struct {
	Items    []models.User `json:"items"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
}

type createUserInput struct {
	Email     string  `json:"email" binding:"required,email,max=255"`
	Password  string  `json:"password" binding:"required,min=8,max=72"`
	Username  string  `json:"username" binding:"required,max=100"`
	BirthDate *string `json:"birth_date" binding:"omitempty,datetime=2006-01-02"`
	Location  *string `json:"location" binding:"omitempty,max=255"`
	Bio       *string `json:"bio" binding:"omitempty,max=2000"`
}

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// List returns non-deleted users, newest first, filtered by email/username, role and status.
func (h *UserHandler) List(c *gin.Context) {
	var in userListQuery
	if err := c.ShouldBindQuery(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}
	if in.Page == 0 {
		in.Page = 1
	}
	if in.PageSize == 0 {
		in.PageSize = 20
	}

	q := h.DB.Model(&models.User{})
	if s := strings.TrimSpace(in.Q); s != "" {
		pattern := "%" + likeEscaper.Replace(strings.ToLower(s)) + "%"
		q = q.Where("LOWER(email) LIKE ? OR LOWER(username) LIKE ? OR id = ?", pattern, pattern, ids.Normalize(s))
	}
	if in.Role != "" {
		q = q.Where("role = ?", in.Role)
	}
	if in.Status != "" {
		q = q.Where("status = ?", in.Status)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		respondErr(c, err)
		return
	}
	items := []models.User{}
	err := q.Order("created_at DESC, id DESC").
		Offset((in.Page - 1) * in.PageSize).
		Limit(in.PageSize).
		Find(&items).Error
	if err != nil {
		respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, userListResponse{Items: items, Total: total, Page: in.Page, PageSize: in.PageSize})
}

func (h *UserHandler) Get(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	var user models.User
	if err := h.DB.Where("id = ?", id).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			err = &apiError{http.StatusNotFound, "not_found"}
		}
		respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, &user)
}

// Create adds a regular app user. Admin accounts are only made via cmd/createadmin.
func (h *UserHandler) Create(c *gin.Context) {
	var in createUserInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}
	username := strings.TrimSpace(in.Username)
	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": "username is required"})
		return
	}
	var birthDate *time.Time
	if in.BirthDate != nil {
		d, _ := time.Parse(time.DateOnly, *in.BirthDate)
		if d.After(time.Now()) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_birth_date"})
			return
		}
		birthDate = &d
	}

	hash, err := HashPassword(in.Password)
	if err != nil {
		respondErr(c, err)
		return
	}
	user := models.User{
		Email:        strings.ToLower(strings.TrimSpace(in.Email)),
		PasswordHash: hash,
		Username:     username,
		BirthDate:    birthDate,
		Location:     trimmedOrNil(in.Location),
		Bio:          trimmedOrNil(in.Bio),
		Role:         models.RoleUser,
		Status:       models.UserStatusActive,
		LanguageCode: models.DefaultLanguage,
	}
	if err := h.DB.Create(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			c.JSON(http.StatusConflict, gin.H{"error": "email_taken"})
			return
		}
		respondErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, &user)
}

func trimmedOrNil(s *string) *string {
	if s == nil {
		return nil
	}
	v := strings.TrimSpace(*s)
	if v == "" {
		return nil
	}
	return &v
}

type adjustPointsInput struct {
	Mode   string  `json:"mode" binding:"required,oneof=add subtract"`
	Amount int     `json:"amount" binding:"required,min=1,max=1000000000"`
	Note   *string `json:"note" binding:"omitempty,max=500"`
}

// AdjustPoints adds or subtracts points by hand and records it in the ledger.
func (h *UserHandler) AdjustPoints(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	var in adjustPointsInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}
	adminID := c.GetString(middleware.CtxUserID)

	var user models.User
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", id).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &apiError{http.StatusNotFound, "not_found"}
			}
			return err
		}
		amount, txType := in.Amount, models.PointTxAdminGrant
		if in.Mode == "subtract" {
			if in.Amount > user.Points {
				return &apiError{http.StatusConflict, "insufficient_points"}
			}
			amount, txType = -in.Amount, models.PointTxAdminDeduct
		} else if user.Points > math.MaxInt32-in.Amount {
			return &apiError{http.StatusBadRequest, "points_overflow"}
		}
		if err := addPoints(tx, id, amount, txType, nil, adminID, trimmedOrNil(in.Note)); err != nil {
			return err
		}
		return tx.Where("id = ?", id).First(&user).Error
	})
	if err != nil {
		respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, &user)
}
