package models

import (
	"time"

	"gorm.io/gorm"

	"ds-pen/backend/internal/ids"
)

const (
	RoleAdmin = "admin"
	RoleUser  = "user"

	UserStatusActive = "active"
	UserStatusLocked = "locked"

	DefaultLanguage = "vi"
)

type User struct {
	ID           string         `gorm:"primaryKey" json:"id"`
	Email        string         `json:"email"`
	PasswordHash string         `json:"-"`
	Username     string         `json:"username"`
	AvatarURL    *string        `json:"avatar_url"`
	BirthDate    *time.Time     `gorm:"type:date" json:"birth_date"`
	Location     *string        `json:"location"`
	Bio          *string        `json:"bio"`
	Role         string         `json:"role"`
	Status       string         `json:"status"`
	LanguageCode string         `json:"language_code"`
	Points       int            `gorm:"->" json:"points"`
	LastLoginAt  *time.Time     `json:"last_login_at"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `json:"-"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == "" {
		u.ID, err = ids.New(tx, "users")
	}
	return err
}
