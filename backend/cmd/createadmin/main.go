package main

import (
	"flag"
	"log"
	"strings"

	"ds-pen/backend/internal/config"
	"ds-pen/backend/internal/db"
	"ds-pen/backend/internal/handlers"
	"ds-pen/backend/internal/models"
)

func main() {
	email := flag.String("email", "", "admin email")
	password := flag.String("password", "", "admin password (min 8 chars)")
	username := flag.String("username", "Admin", "display name")
	flag.Parse()

	if *email == "" || len(*password) < 8 || len(*password) > 72 {
		log.Fatal("usage: createadmin -email you@example.com -password <8-72 chars> [-username Admin]")
	}

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

	hash, err := handlers.HashPassword(*password)
	if err != nil {
		log.Fatal(err)
	}
	user := models.User{
		Email:        strings.ToLower(strings.TrimSpace(*email)),
		PasswordHash: hash,
		Username:     *username,
		Role:         models.RoleAdmin,
		Status:       models.UserStatusActive,
		LanguageCode: models.DefaultLanguage,
	}
	if err := gdb.Create(&user).Error; err != nil {
		log.Fatalf("create admin: %v", err)
	}
	log.Printf("created admin #%s %s", user.ID, user.Email)
}
