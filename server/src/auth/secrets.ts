export function randomToken(bytes = 32): string {
	return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url');
}

export function sha256(value: string): string {
	return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}
