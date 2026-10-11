package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"ds-pen/backend/internal/auth"
	"ds-pen/backend/internal/models"
)

const (
	CtxUserID = "userID"
	CtxRole   = "role"
)

func RequireAuth(tokens *auth.TokenManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !ok || raw == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		userID, role, err := tokens.Parse(raw)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid_token"})
			return
		}
		c.Set(CtxUserID, userID)
		c.Set(CtxRole, role)
		c.Next()
	}
}

// RequireAdmin re-checks the database so a demoted or locked admin loses access
// immediately instead of when their token expires.
func RequireAdmin(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var user models.User
		err := db.Select("role", "status").Where("id = ?", c.GetString(CtxUserID)).First(&user).Error
		if err != nil || user.Role != models.RoleAdmin || user.Status != models.UserStatusActive {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}
