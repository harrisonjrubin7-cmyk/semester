import { describe, expect, it } from 'vitest';
import { publicationMode } from './publication-input';

describe('publication verification input', () => {
  it('allows a fresh checkout without external publication artifacts', () => {
    expect(publicationMode(false, false, true)).toBe('skip');
    expect(publicationMode(false, true, true)).toBe('run');
  });
  it('never skips missing artifacts that an operator explicitly requested', () => {
    expect(() => publicationMode(true, false, true)).toThrow('directory does not exist');
    expect(publicationMode(true, true, true)).toBe('run');
  });
  it('requires all tools for explicitly requested verification', () => {
    expect(() => publicationMode(true, true, false)).toThrow('pdfinfo, pdftotext and unzip');
    expect(publicationMode(false, true, false)).toBe('skip');
  });
});
