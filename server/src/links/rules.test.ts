import { describe, expect, test } from 'bun:test';
import { generateSlug, normalizeUrl, slugError } from './rules';

describe('generateSlug', () => {
	test('uses only unambiguous characters', () => {
		for (let i = 0; i < 500; i++) expect(generateSlug()).toMatch(/^[2-9a-hjkmnp-zA-HJ-NP-Z]{5}$/);
	});
});

describe('slugError', () => {
	test('accepts the documented shape', () => {
		expect(slugError('my-cv_2026')).toBeNull();
	});

	test('rejects short, long and unsafe slugs', () => {
		for (const slug of ['a', 'x'.repeat(33), 'a/b', 'café']) expect(slugError(slug)).not.toBeNull();
	});
});

describe('normalizeUrl', () => {
	test('keeps http and https urls', () => {
		expect(normalizeUrl(' https://example.com/a?b=1 ', 'https://jrdan.link')).toEqual({
			url: 'https://example.com/a?b=1',
		});
	});

	test('refuses other schemes', () => {
		expect(normalizeUrl('javascript:alert(1)', 'https://jrdan.link')).toHaveProperty('error');
	});
});
