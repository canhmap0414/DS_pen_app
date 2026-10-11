package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"ds-pen/backend/internal/auth"
	"ds-pen/backend/internal/middleware"
	"ds-pen/backend/internal/models"
)

type AuthHandler struct {
	DB     *gorm.DB
	Tokens *auth.TokenManager
}

type registerRequest struct {
	Email        string `json:"email" binding:"required,email,max=255"`
	Password     string `json:"password" binding:"required,min=8,max=72"`
	Username     string `json:"username" binding:"required,min=1,max=100"`
	LanguageCode string `json:"language_code" binding:"omitempty,max=10"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type authResponse struct {
	Token     string       `json:"token"`
	ExpiresAt time.Time    `json:"expires_at"`
	User      *models.User `json:"user"`
}

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-password"), bcrypt.DefaultCost)

func HashPassword(password string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(h), err
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}

	hash, err := HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	user := models.User{
		Email:        strings.ToLower(strings.TrimSpace(req.Email)),
		PasswordHash: hash,
		Username:     strings.TrimSpace(req.Username),
		Role:         models.RoleUser,
		Status:       models.UserStatusActive,
		LanguageCode: req.LanguageCode,
	}
	if user.LanguageCode == "" {
		user.LanguageCode = models.DefaultLanguage
	}

	var activeLanguages int64
	if err := h.DB.Table("languages").Where("code = ? AND is_active", user.LanguageCode).Count(&activeLanguages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	if activeLanguages == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_language"})
		return
	}

	if err := h.DB.Create(&user).Error; err != nil {
		switch {
		case errors.Is(err, gorm.ErrDuplicatedKey):
			c.JSON(http.StatusConflict, gin.H{"error": "email_taken"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		}
		return
	}

	h.respondWithToken(c, http.StatusCreated, &user)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}

	var user models.User
	err := h.DB.Where("LOWER(email) = ?", strings.ToLower(strings.TrimSpace(req.Email))).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_credentials"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_credentials"})
		return
	}
	if user.Status != models.UserStatusActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "account_locked"})
		return
	}

	now := time.Now()
	if err := h.DB.Model(&user).UpdateColumn("last_login_at", now).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	user.LastLoginAt = &now

	h.respondWithToken(c, http.StatusOK, &user)
}

func (h *AuthHandler) Me(c *gin.Context) {
	var user models.User
	err := h.DB.Where("id = ?", c.GetString(middleware.CtxUserID)).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	if user.Status != models.UserStatusActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "account_locked"})
		return
	}
	c.JSON(http.StatusOK, &user)
}

func (h *AuthHandler) respondWithToken(c *gin.Context, status int, user *models.User) {
	token, expiresAt, err := h.Tokens.Issue(user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(status, authResponse{Token: token, ExpiresAt: expiresAt, User: user})
}
