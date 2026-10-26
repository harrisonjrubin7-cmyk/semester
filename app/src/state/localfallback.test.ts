import { describe, expect, it } from 'vitest';
import { DEFAULT_PERSISTED, type Persisted } from './shape';
import { localFallback } from './localfallback';

describe('the legacy localStorage fallback', () => {
  it('never serialises advising appointments in clear text', () => {
    const persisted: Persisted = {
      ...DEFAULT_PERSISTED,
      appointments: [
        {
          id: 'private-advising-record',
          title: 'Financial aid appeal with Dr. Rivera',
        },
      ] as Persisted['appointments'],
    };

    const fallback = localFallback(persisted);

    expect(fallback).not.toHaveProperty('appointments');
    expect(JSON.stringify(fallback)).not.toContain('Financial aid appeal');
    expect(fallback.nav).toBe(persisted.nav);
  });
});

