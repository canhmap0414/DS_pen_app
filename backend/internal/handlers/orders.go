package handlers

import (
	"errors"
	"io"
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

type OrderHandler struct {
	DB *gorm.DB
}

type orderListQuery struct {
	Q        string `form:"q" binding:"max=255"`
	Status   string `form:"status" binding:"omitempty,oneof=paid shipped completed cancelled"`
	BuyerID  string `form:"buyer_id" binding:"omitempty,max=13"`
	SellerID string `form:"seller_id" binding:"omitempty,max=13"`
	// Inclusive calendar days (YYYY-MM-DD) on created_at, in the server's time zone.
	DateFrom string `form:"date_from" binding:"omitempty,datetime=2006-01-02"`
	DateTo   string `form:"date_to" binding:"omitempty,datetime=2006-01-02"`
	Sort     string `form:"sort" binding:"omitempty,oneof=created_at total_points quantity"`
	Order    string `form:"order" binding:"omitempty,oneof=asc desc"`
	Page     int    `form:"page" binding:"omitempty,min=1"`
	PageSize int    `form:"page_size" binding:"omitempty,min=1,max=100"`
}

// OrderRow is exported: when it was unexported, GORM left its fields empty when scanning into orderDetail.
type OrderRow struct {
	ID              string     `json:"id"`
	OrderCode       string     `json:"order_code"`
	BuyerID         string     `json:"buyer_id"`
	BuyerUsername   string     `json:"buyer_username"`
	BuyerEmail      string     `json:"buyer_email"`
	SellerID        string     `json:"seller_id"`
	SellerUsername  string     `json:"seller_username"`
	SellerEmail     string     `json:"seller_email"`
	ProductID       string     `json:"product_id"`
	ProductName     string     `json:"product_name"`
	ProductImageURL *string    `json:"product_image_url"`
	Quantity        int        `json:"quantity"`
	UnitPoints      int        `json:"unit_points"`
	TotalPoints     int        `json:"total_points"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
	ShippedAt       *time.Time `json:"shipped_at"`
	CompletedAt     *time.Time `json:"completed_at"`
	CancelledAt     *time.Time `json:"cancelled_at"`
}

type orderPointTx struct {
	ID           int64     `json:"id"`
	UserID       string    `json:"user_id"`
	Username     string    `json:"username"`
	Amount       int       `json:"amount"`
	BalanceAfter int       `json:"balance_after"`
	Type         string    `json:"type"`
	CreatedBy    *string   `json:"created_by"`
	CreatorName  *string   `json:"creator_username"`
	Note         *string   `json:"note"`
	CreatedAt    time.Time `json:"created_at"`
}

type orderMessage struct {
	ID             int64     `json:"id"`
	SenderID       string    `json:"sender_id"`
	SenderUsername string    `json:"sender_username"`
	Type           string    `json:"type"`
	Content        *string   `json:"content"`
	ProductID      *string   `json:"product_id"`
	ProductName    *string   `json:"product_name"`
	CreatedAt      time.Time `json:"created_at"`
}

type orderDetail struct {
	OrderRow
	ShippingName        string         `json:"shipping_name"`
	ShippingPhone       string         `json:"shipping_phone"`
	ShippingAddress     string         `json:"shipping_address"`
	BuyerPoints         int            `json:"buyer_points"`
	SellerPoints        int            `json:"seller_points"`
	ProductDeleted      bool           `json:"product_deleted"`
	CancelledBy         *string        `json:"cancelled_by"`
	CancelledByUsername *string        `json:"cancelled_by_username"`
	PointTransactions   []orderPointTx `gorm:"-" json:"point_transactions"`
	Messages            []orderMessage `gorm:"-" json:"messages"`
}

type orderPage struct {
	Items        []OrderRow       `json:"items"`
	Total        int64            `json:"total"`
	Page         int              `json:"page"`
	PageSize     int              `json:"page_size"`
	StatusCounts map[string]int64 `json:"status_counts"`
}

const orderSelect = `o.id, o.order_code, o.buyer_id, b.username AS buyer_username, b.email AS buyer_email,
	o.seller_id, s.username AS seller_username, s.email AS seller_email,
	o.product_id, o.product_name, o.product_image_url, o.quantity, o.unit_points, o.total_points,
	o.status, o.created_at, o.shipped_at, o.completed_at, o.cancelled_at`

var orderSorts = map[string]string{
	"created_at":   "o.created_at",
	"total_points": "o.total_points",
	"quantity":     "o.quantity",
}

// Chat history shown to the admin is capped; order chats are short in practice.
const maxOrderMessages = 500

func (h *OrderHandler) baseQuery() *gorm.DB {
	return h.DB.Table("orders o").
		Joins("JOIN users b ON b.id = o.buyer_id").
		Joins("JOIN users s ON s.id = o.seller_id")
}

// List filters by q (order code, product name, buyer/seller username or email), status,
// buyer_id, seller_id and a created_at date range. status_counts ignores the status filter
// so the UI can show a count on every status tab.
func (h *OrderHandler) List(c *gin.Context) {
	var in orderListQuery
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

	filter := func(q *gorm.DB) *gorm.DB {
		if s := strings.TrimSpace(in.Q); s != "" {
			like := "%" + escapeLike(s) + "%"
			q = q.Where(`(o.order_code ILIKE ? OR o.product_name ILIKE ? OR b.username ILIKE ? OR b.email ILIKE ?
				OR s.username ILIKE ? OR s.email ILIKE ? OR o.id = ?)`, like, like, like, like, like, like, ids.Normalize(s))
		}
		if in.BuyerID != "" {
			q = q.Where("o.buyer_id = ?", ids.Normalize(in.BuyerID))
		}
		if in.SellerID != "" {
			q = q.Where("o.seller_id = ?", ids.Normalize(in.SellerID))
		}
		if in.DateFrom != "" {
			q = q.Where("o.created_at >= ?::date", in.DateFrom)
		}
		if in.DateTo != "" {
			q = q.Where("o.created_at < ?::date + 1", in.DateTo)
		}
		return q
	}

	var counts []struct {
		Status string
		N      int64
	}
	if err := filter(h.baseQuery()).Select("o.status, COUNT(*) AS n").Group("o.status").Scan(&counts).Error; err != nil {
		respondErr(c, err)
		return
	}
	statusCounts := map[string]int64{}
	for _, s := range models.OrderStatuses {
		statusCounts[s] = 0
	}
	var total int64
	for _, r := range counts {
		statusCounts[r.Status] = r.N
		if in.Status == "" || in.Status == r.Status {
			total += r.N
		}
	}

	orderBy, ok := orderSorts[in.Sort]
	if !ok {
		orderBy = "o.created_at"
	}
	dir := "DESC"
	if in.Order == "asc" {
		dir = "ASC"
	}

	q := filter(h.baseQuery())
	if in.Status != "" {
		q = q.Where("o.status = ?", in.Status)
	}
	rows := []OrderRow{}
	err := q.Select(orderSelect).
		Order(orderBy + " " + dir + ", o.created_at DESC, o.id").
		Limit(in.PageSize).Offset((in.Page - 1) * in.PageSize).
		Scan(&rows).Error
	if err != nil {
		respondErr(c, err)
		return
	}
	c.JSON(http.StatusOK, orderPage{
		Items: rows, Total: total, Page: in.Page, PageSize: in.PageSize, StatusCounts: statusCounts,
	})
}

func (h *OrderHandler) Get(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	var d orderDetail
	res := h.baseQuery().
		Select(orderSelect+`, o.shipping_name, o.shipping_phone, o.shipping_address,
			b.points AS buyer_points, s.points AS seller_points,
			(p.id IS NULL OR p.deleted_at IS NOT NULL) AS product_deleted,
			o.cancelled_by, cu.username AS cancelled_by_username`).
		Joins("LEFT JOIN products p ON p.id = o.product_id").
		Joins("LEFT JOIN users cu ON cu.id = o.cancelled_by").
		Where("o.id = ?", id).Limit(1).Scan(&d)
	if res.Error != nil {
		respondErr(c, res.Error)
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}

	d.PointTransactions = []orderPointTx{}
	err := h.DB.Table("point_transactions pt").
		Select(`pt.id, pt.user_id, u.username, pt.amount, pt.balance_after, pt.type,
			pt.created_by, cu.username AS creator_name, pt.note, pt.created_at`).
		Joins("JOIN users u ON u.id = pt.user_id").
		Joins("LEFT JOIN users cu ON cu.id = pt.created_by").
		Where("pt.order_id = ?", id).
		Order("pt.id").
		Scan(&d.PointTransactions).Error
	if err != nil {
		respondErr(c, err)
		return
	}

	d.Messages = []orderMessage{}
	err = h.DB.Table("messages m").
		Select(`m.id, m.sender_id, u.username AS sender_username, m.type, m.content,
			m.product_id, pt.name AS product_name, m.created_at`).
		Joins("JOIN conversations cv ON cv.id = m.conversation_id").
		Joins("JOIN users u ON u.id = m.sender_id").
		Joins("LEFT JOIN product_translations pt ON pt.product_id = m.product_id AND pt.language_code = ?", models.DefaultLanguage).
		Where("cv.order_id = ? AND m.deleted_at IS NULL", id).
		Order("m.id").
		Limit(maxOrderMessages).
		Scan(&d.Messages).Error
	if err != nil {
		respondErr(c, err)
		return
	}

	c.JSON(http.StatusOK, d)
}

// Cancel follows the rules in docs/ER_diagram.md §2: refund the buyer, put the stock back and,
// for a completed order, take the sale points back from the seller. All in one transaction.
func (h *OrderHandler) Cancel(c *gin.Context) {
	id, ok := pathID(c)
	if !ok {
		return
	}
	var in struct {
		Reason string `json:"reason" binding:"max=1000"`
	}
	// The body is optional: a cancel without a reason is allowed.
	if err := c.ShouldBindJSON(&in); err != nil && !errors.Is(err, io.EOF) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_failed", "detail": err.Error()})
		return
	}
	var note *string
	if r := strings.TrimSpace(in.Reason); r != "" {
		note = &r
	}
	adminID := c.GetString(middleware.CtxUserID)

	err := h.DB.Transaction(func(tx *gorm.DB) error {
		var o models.Order
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", id).First(&o).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &apiError{http.StatusNotFound, "not_found"}
			}
			return err
		}
		if o.Status == models.OrderStatusCancelled {
			return &apiError{http.StatusConflict, "order_already_cancelled"}
		}

		// Lock both users in id order so two concurrent cancellations can't deadlock.
		var users []models.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id", "points").
			Where("id IN ?", []string{o.BuyerID, o.SellerID}).Order("id").Find(&users).Error; err != nil {
			return err
		}

		if o.Status == models.OrderStatusCompleted {
			for _, u := range users {
				if u.ID == o.SellerID && u.Points < o.TotalPoints {
					return &apiError{http.StatusConflict, "seller_insufficient_points"}
				}
			}
			if err := addPoints(tx, o.SellerID, -o.TotalPoints, models.PointTxSaleReversal, &o.ID, adminID, note); err != nil {
				return err
			}
		}
		if err := addPoints(tx, o.BuyerID, o.TotalPoints, models.PointTxRefund, &o.ID, adminID, note); err != nil {
			return err
		}

		// The product may be soft-deleted by now; its stock is restored anyway.
		if err := tx.Exec("UPDATE products SET quantity = quantity + ?, updated_at = NOW() WHERE id = ?",
			o.Quantity, o.ProductID).Error; err != nil {
			return err
		}

		return tx.Model(&o).Updates(map[string]any{
			"status":       models.OrderStatusCancelled,
			"cancelled_at": gorm.Expr("NOW()"),
			"cancelled_by": adminID,
		}).Error
	})
	if err != nil {
		respondErr(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// addPoints changes a user's balance and writes the matching ledger row.
func addPoints(tx *gorm.DB, userID string, amount int, txType string, orderID *string, adminID string, note *string) error {
	var balance int
	if err := tx.Raw("UPDATE users SET points = points + ?, updated_at = NOW() WHERE id = ? RETURNING points",
		amount, userID).Scan(&balance).Error; err != nil {
		return err
	}
	return tx.Create(&models.PointTransaction{
		UserID:       userID,
		Amount:       amount,
		BalanceAfter: balance,
		Type:         txType,
		OrderID:      orderID,
		CreatedBy:    &adminID,
		Note:         note,
	}).Error
}
