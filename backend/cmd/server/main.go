package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"ds-pen/backend/internal/auth"
	"ds-pen/backend/internal/config"
	"ds-pen/backend/internal/db"
	"ds-pen/backend/internal/handlers"
	"ds-pen/backend/internal/middleware"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	if err := db.Migrate(cfg.DatabaseURL); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	gdb, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}

	if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
		log.Fatalf("upload dir: %v", err)
	}

	tokens := auth.NewTokenManager(cfg.JWTSecret, cfg.JWTTTL)
	authH := &handlers.AuthHandler{DB: gdb, Tokens: tokens}

	r := gin.Default()
	if err := r.SetTrustedProxies(nil); err != nil {
		log.Fatal(err)
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE"},
		AllowHeaders:     []string{"Authorization", "Content-Type", "Accept-Language"},
		AllowCredentials: true,
	}))

	r.Static("/uploads", cfg.UploadDir)

	r.GET("/health", func(c *gin.Context) {
		sqlDB, err := gdb.DB()
		if err == nil {
			err = sqlDB.Ping()
		}
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "db_down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api/v1")
	api.POST("/auth/register", authH.Register)
	api.POST("/auth/login", authH.Login)

	categoryH := &handlers.CategoryHandler{DB: gdb}
	api.GET("/categories", categoryH.ListPublic)

	authed := api.Group("", middleware.RequireAuth(tokens))
	authed.GET("/me", authH.Me)

	admin := authed.Group("/admin", middleware.RequireAdmin(gdb))
	admin.GET("/categories", categoryH.ListAdmin)
	admin.POST("/categories", categoryH.Create)
	admin.PUT("/categories/:id", categoryH.Update)
	admin.DELETE("/categories/:id", categoryH.Delete)

	productH := &handlers.ProductHandler{DB: gdb}
	admin.GET("/products", productH.List)
	admin.GET("/products/:id", productH.Get)
	admin.POST("/products", productH.Create)
	admin.PUT("/products/:id", productH.Update)
	admin.PATCH("/products/:id/status", productH.UpdateStatus)
	admin.DELETE("/products/:id", productH.Delete)

	orderH := &handlers.OrderHandler{DB: gdb}
	admin.GET("/orders", orderH.List)
	admin.GET("/orders/:id", orderH.Get)
	admin.POST("/orders/:id/cancel", orderH.Cancel)

	uploadH := &handlers.UploadHandler{Dir: cfg.UploadDir}
	admin.POST("/uploads/images", uploadH.Image)

	userH := &handlers.UserHandler{DB: gdb}
	admin.GET("/users", userH.List)
	admin.POST("/users", userH.Create)
	admin.GET("/users/:id", userH.Get)
	admin.POST("/users/:id/points", userH.AdjustPoints)

	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
