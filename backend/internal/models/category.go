package models

import (
	"time"

	"gorm.io/gorm"

	"ds-pen/backend/internal/ids"
)

type Category struct {
	ID                 string `gorm:"primaryKey"`
	ParentID           *string
	Slug               string
	SourceLanguageCode string
	IsActive           bool
	SortOrder          int
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

func (c *Category) BeforeCreate(tx *gorm.DB) (err error) {
	if c.ID == "" {
		c.ID, err = ids.New(tx, "categories")
	}
	return err
}

type CategoryTranslation struct {
	CategoryID          string `gorm:"primaryKey"`
	LanguageCode        string `gorm:"primaryKey"`
	Name                string
	Description         *string
	IsMachineTranslated bool
}
