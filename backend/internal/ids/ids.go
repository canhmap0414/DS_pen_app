// Package ids generates the public IDs of users, categories, products and orders:
// 5 random uppercase letters followed by the creation date as YYYYMMDD (Vietnam time),
// e.g. KQZMB20261010.
package ids

import (
	"crypto/rand"
	"errors"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
)

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

var (
	vietnam = time.FixedZone("ICT", 7*60*60)
	pattern = regexp.MustCompile(`^[A-Z]{5}[0-9]{8}$`)
)

// Valid reports whether s has the ID format.
func Valid(s string) bool {
	return pattern.MatchString(s)
}

// Normalize upper-cases user input so "kqzmb20261010" still matches.
func Normalize(s string) string {
	return strings.ToUpper(strings.TrimSpace(s))
}

// New returns an ID that is not yet used in table.
func New(db *gorm.DB, table string) (string, error) {
	db = db.Session(&gorm.Session{NewDB: true})
	date := time.Now().In(vietnam).Format("20060102")
	for range 10 {
		id := randomLetters(5) + date
		var n int64
		if err := db.Table(table).Where("id = ?", id).Count(&n).Error; err != nil {
			return "", err
		}
		if n == 0 {
			return id, nil
		}
	}
	return "", errors.New("ids: no free id found")
}

func randomLetters(n int) string {
	out := make([]byte, 0, n)
	buf := make([]byte, 1)
	for len(out) < n {
		if _, err := rand.Read(buf); err != nil {
			panic(err)
		}
		// Reject the top of the byte range so every letter is equally likely.
		if buf[0] < 26*9 {
			out = append(out, letters[buf[0]%26])
		}
	}
	return string(out)
}
