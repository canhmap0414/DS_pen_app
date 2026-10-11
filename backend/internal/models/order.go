package models

import (
	"time"

	"gorm.io/gorm"

	"ds-pen/backend/internal/ids"
)

const (
	OrderStatusPaid      = "paid"
	OrderStatusShipped   = "shipped"
	OrderStatusCompleted = "completed"
	OrderStatusCancelled = "cancelled"

	PointTxAdminGrant   = "admin_grant"
	PointTxAdminDeduct  = "admin_deduct"
	PointTxPurchase     = "purchase"
	PointTxSale         = "sale"
	PointTxRefund       = "refund"
	PointTxSaleReversal = "sale_reversal"
)

var OrderStatuses = []string{OrderStatusPaid, OrderStatusShipped, OrderStatusCompleted, OrderStatusCancelled}

type Order struct {
	ID              string `gorm:"primaryKey"`
	OrderCode       string
	BuyerID         string
	SellerID        string
	ProductID       string
	ProductName     string
	ProductImageURL *string
	Quantity        int
	UnitPoints      int
	TotalPoints     int
	AddressID       *int64
	ShippingName    string
	ShippingPhone   string
	ShippingAddress string
	Status          string
	CreatedAt       time.Time
	ShippedAt       *time.Time
	CompletedAt     *time.Time
	CancelledAt     *time.Time
	CancelledBy     *string
}

func (o *Order) BeforeCreate(tx *gorm.DB) (err error) {
	if o.ID == "" {
		o.ID, err = ids.New(tx, "orders")
	}
	return err
}

type PointTransaction struct {
	ID           int64 `gorm:"primaryKey"`
	UserID       string
	Amount       int
	BalanceAfter int
	Type         string
	OrderID      *string
	CreatedBy    *string
	Note         *string
	CreatedAt    time.Time
}
