package handlers

import "testing"

func TestSlugify(t *testing.T) {
	cases := map[string]string{
		"Tem Việt Nam":                   "tem-viet-nam",
		"Thời kỳ Đông Dương (1889-1945)": "thoi-ky-dong-duong-1889-1945",
		"  Sau   1975  ":                 "sau-1975",
		"日本の切手":                          "",
		"Tem Nhật Bản!!":                 "tem-nhat-ban",
	}
	for in, want := range cases {
		if got := slugify(in); got != want {
			t.Errorf("slugify(%q) = %q, want %q", in, got, want)
		}
	}
}
