package models

import (
	"time"

	"gorm.io/gorm"

	"ds-pen/backend/internal/ids"
)

const (
	ProductStatusPublished   = "published"
	ProductStatusUnpublished = "unpublished"

	// Stock status is derived from quantity: 0 = out of stock, 1..LowStockThreshold = low, above = in stock.
	LowStockThreshold = 5

	StockIn  = "in_stock"
	StockLow = "low_stock"
	StockOut = "out_of_stock"

	MaxProductImages = 2
)

func StockStatus(quantity int) string {
	switch {
	case quantity <= 0:
		return StockOut
	case quantity <= LowStockThreshold:
		return StockLow
	default:
		return StockIn
	}
}

type Product struct {
	ID                 string `gorm:"primaryKey"`
	OwnerID            string
	CategoryID         string
	SourceLanguageCode string
	ProductionYear     int
	ProductionMonth    *int
	Quantity           int
	PricePoints        int
	Status             string
	CreatedAt          time.Time
	UpdatedAt          time.Time
	DeletedAt          gorm.DeletedAt
}

func (p *Product) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == "" {
		p.ID, err = ids.New(tx, "products")
	}
	return err
}

type ProductTranslation struct {
	ProductID           string `gorm:"primaryKey"`
	LanguageCode        string `gorm:"primaryKey"`
	Name                string
	Description         *string
	IsMachineTranslated bool
}

type ProductImage struct {
	ID        int64 `gorm:"primaryKey"`
	ProductID string
	ImageURL  string
	SortOrder int
	CreatedAt time.Time
}
