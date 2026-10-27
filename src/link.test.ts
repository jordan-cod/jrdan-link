import { describe, expect, it } from 'bun:test';

import { generateSlug, normalizeUrl, shortUrl, validateExpiresIn, validateSlug } from './link';

describe('normalizeUrl', () => {
  it('normaliza uma URL válida', () => {
    expect(normalizeUrl('https://github.com')).toBe('https://github.com/');
  });

  it('aceita espaço em volta', () => {
    expect(normalizeUrl('  https://github.com  ')).toBe('https://github.com/');
  });

  it('rejeita protocolo que não é http(s)', () => {
    expect(normalizeUrl('ftp://arquivo')).toBeNull();
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejeita o que não é string ou está vazio', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl(42)).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
  });
});

describe('validateSlug', () => {
  it('aceita um slug no formato', () => {
    expect(validateSlug('git')).toBeNull();
    expect(validateSlug('meu-link_2')).toBeNull();
  });

  it('rejeita curto demais, longo demais e com espaço', () => {
    expect(validateSlug('ab')).not.toBeNull();
    expect(validateSlug('a'.repeat(33))).not.toBeNull();
    expect(validateSlug('a b')).not.toBeNull();
  });

  it('rejeita os caminhos reservados', () => {
    expect(validateSlug('favicon.ico')).not.toBeNull();
    expect(validateSlug('ROBOTS.TXT')).not.toBeNull();
  });
});

describe('validateExpiresIn', () => {
  it('aceita ausente ou inteiro positivo', () => {
    expect(validateExpiresIn(undefined)).toBeNull();
    expect(validateExpiresIn(3600)).toBeNull();
  });

  it('rejeita zero, negativo, fracionário e texto', () => {
    expect(validateExpiresIn(0)).not.toBeNull();
    expect(validateExpiresIn(-1)).not.toBeNull();
    expect(validateExpiresIn(1.5)).not.toBeNull();
    expect(validateExpiresIn('3600')).not.toBeNull();
  });
});

describe('generateSlug', () => {
  it('gera um código no tamanho e no alfabeto', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSlug()).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
    }
  });

  it('não repete em 500 sorteios', () => {
    expect(new Set(Array.from({ length: 500 }, generateSlug)).size).toBe(500);
  });
});

describe('shortUrl', () => {
  it('junta origem e slug', () => {
    expect(shortUrl('https://jrdan.link', 'git')).toBe('https://jrdan.link/git');
  });
});
