import { describe, expect, it } from 'vitest';
import { institutionalPreview } from './institutional-preview';

describe('institutional preview flag', () => {
  it('is off when the variable is absent', () => {
    expect(institutionalPreview({})).toBe(false);
  });

  it('accepts only the exact string true', () => {
    expect(institutionalPreview({ VITE_INSTITUTIONAL_PREVIEW: 'true' })).toBe(true);
    for (const value of ['TRUE', 'True', '1', 'yes', ' true ', 'false', '']) {
      expect(institutionalPreview({ VITE_INSTITUTIONAL_PREVIEW: value })).toBe(false);
    }
  });
});
