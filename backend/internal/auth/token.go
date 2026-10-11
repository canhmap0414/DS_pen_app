package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"ds-pen/backend/internal/ids"
)

type Claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

type TokenManager struct {
	secret []byte
	ttl    time.Duration
}

func NewTokenManager(secret string, ttl time.Duration) *TokenManager {
	return &TokenManager{secret: []byte(secret), ttl: ttl}
}

func (m *TokenManager) Issue(userID string, role string) (string, time.Time, error) {
	expiresAt := time.Now().Add(m.ttl)
	claims := Claims{
		Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	return token, expiresAt, err
}

func (m *TokenManager) Parse(tokenString string) (userID string, role string, err error) {
	claims := &Claims{}
	_, err = jwt.ParseWithClaims(tokenString, claims, func(*jwt.Token) (any, error) {
		return m.secret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithExpirationRequired())
	if err != nil {
		return "", "", err
	}
	// Tokens issued before IDs became strings carry a numeric subject and are rejected here.
	if !ids.Valid(claims.Subject) {
		return "", "", errors.New("invalid subject")
	}
	return claims.Subject, claims.Role, nil
}
