package link

import (
	"crypto/rand"
	"math/big"
)

// Alfabeto sem caracteres ambíguos (0/O, 1/l/I).
const alphabet = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"

func newShortID(n int) (string, error) {
	b := make([]byte, n)
	max := big.NewInt(int64(len(alphabet)))
	for i := range b {
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		b[i] = alphabet[idx.Int64()]
	}
	return string(b), nil
}
