package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

const (
	uploadURLPrefix = "/uploads/"
	maxImageBytes   = 5 << 20
)

var imageExts = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type UploadHandler struct {
	Dir string
}

// Image stores a product image under Dir/products and returns its public URL.
// The type is sniffed from the content, never trusted from the filename or header.
func (h *UploadHandler) Image(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxImageBytes+1<<20)
	fh, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_image"})
		return
	}
	if fh.Size > maxImageBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "image_too_large"})
		return
	}
	src, err := fh.Open()
	if err != nil {
		respondErr(c, err)
		return
	}
	defer src.Close()

	head := make([]byte, 512)
	n, _ := io.ReadFull(src, head)
	ext, ok := imageExts[http.DetectContentType(head[:n])]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_image"})
		return
	}
	if _, err := src.Seek(0, io.SeekStart); err != nil {
		respondErr(c, err)
		return
	}

	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		respondErr(c, err)
		return
	}
	name := hex.EncodeToString(buf) + ext
	dir := filepath.Join(h.Dir, "products")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		respondErr(c, err)
		return
	}
	dst, err := os.Create(filepath.Join(dir, name))
	if err != nil {
		respondErr(c, err)
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		respondErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"url": uploadURLPrefix + "products/" + name})
}
