package ids

import "testing"

func TestRandomLetters(t *testing.T) {
	for range 1000 {
		id := randomLetters(5) + "20261010"
		if !Valid(id) {
			t.Fatalf("invalid id %q", id)
		}
	}
}

func TestValid(t *testing.T) {
	cases := map[string]bool{
		"KQZMB20261010":  true,
		"kqzmb20261010":  false,
		"KQZM20261010":   false,
		"KQZMB2026101":   false,
		"KQZMB20261010X": false,
		"12345":          false,
		"":               false,
	}
	for in, want := range cases {
		if got := Valid(in); got != want {
			t.Errorf("Valid(%q) = %v, want %v", in, got, want)
		}
	}
	if !Valid(Normalize(" kqzmb20261010 ")) {
		t.Error("Normalize should upper-case and trim")
	}
}
