import { describe, expect, it } from 'vitest';
import { createProductionInstitutionRuntime, environmentJournalKey, exactAppOrigin } from './runtime.ts';

describe('production institution runtime', () => {
  it('requires one exact secure browser origin', () => {
    expect(exactAppOrigin({ SEMESTER_APP_ORIGIN: 'https://semester.example' })).toBe('https://semester.example');
    expect(() => exactAppOrigin({ SEMESTER_APP_ORIGIN: 'https://semester.example/' })).toThrow(/exact HTTPS/);
    expect(() => exactAppOrigin({ SEMESTER_APP_ORIGIN: 'http://semester.example' })).toThrow(/exact HTTPS/);
    expect(exactAppOrigin({ SEMESTER_APP_ORIGIN: 'http://localhost:5173' })).toBe('http://localhost:5173');
  });

  it('requires a stable 256-bit server encryption key', () => {
    expect(environmentJournalKey({ SEMESTER_JOURNAL_KEY: 'ab'.repeat(32) })).toHaveLength(32);
    expect(() => environmentJournalKey({ SEMESTER_JOURNAL_KEY: 'short' })).toThrow(/32 random bytes/);
  });

  it('refuses to construct production with partial Supabase credentials', () => {
    expect(() => createProductionInstitutionRuntime({
      SEMESTER_APP_ORIGIN: 'https://semester.example',
      SEMESTER_JOURNAL_KEY: 'ab'.repeat(32),
      SEMESTER_AUTH_URL: 'https://project.supabase.co',
    })).toThrow(/Production requires/);
  });
});
