package handlers

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

func slugify(s string) string {
	s = strings.ToLower(s)
	s = strings.NewReplacer("đ", "d").Replace(s)

	var b strings.Builder
	dash := false
	for _, r := range norm.NFD.String(s) {
		switch {
		case unicode.Is(unicode.Mn, r):
		case r < unicode.MaxASCII && (unicode.IsLetter(r) || unicode.IsDigit(r)):
			b.WriteRune(r)
			dash = false
		default:
			if !dash && b.Len() > 0 {
				b.WriteByte('-')
				dash = true
			}
		}
	}
	out := strings.TrimSuffix(b.String(), "-")
	if len(out) > 80 {
		out = strings.TrimSuffix(out[:80], "-")
	}
	return out
}
