import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { creditHours, creditHoursOr0 } from './credits';

describe('creditHours', () => {
  it('reads the number out of however the syllabus wrote it', () => {
    expect(creditHours('3 credits')).toBe(3);
    expect(creditHours('3')).toBe(3);
    expect(creditHours('1.5 hrs')).toBe(1.5);
  });

  it('refuses a number that cannot be a credit count', () => {
    // The failure this guard exists for: a line that starts with a year.
    expect(creditHours('Fall 2026, TR 9:30')).toBeNull();
    // A time is the one wrong reading that passes every plausibility test.
    expect(creditHours('TR 9:30–10:45')).toBeNull();
    expect(creditHours('')).toBeNull();
    expect(creditHours(undefined)).toBeNull();
    expect(creditHours('nought')).toBeNull();
  });

  it('reads past a leading year or time rather than stopping on it', () => {
    /*
     * The three lines that made five readers of one field disagree.
     * `parseFloat` takes the leading number and stops, so it read these as
     * none at all, nine, and two thousand and twenty-six.
     */
    expect(Number.parseFloat('Three (3)') || 0).toBe(0);
    expect(creditHours('Three (3)')).toBe(3);

    expect(Number.parseFloat('9:30 TR, 3 credits') || 0).toBe(9);
    expect(creditHours('9:30 TR, 3 credits')).toBe(3);

    expect(Number.parseFloat('2026 Spring · 3 credits') || 0).toBe(2026);
    expect(creditHours('2026 Spring · 3 credits')).toBe(3);
  });
});

describe('creditHoursOr0', () => {
  it('is the same reading with the silence written as nothing', () => {
    expect(creditHoursOr0('3 credits')).toBe(3);
    expect(creditHoursOr0('2026 Spring · 3 credits')).toBe(3);
    expect(creditHoursOr0('TR 9:30–10:45')).toBe(0);
    expect(creditHoursOr0(undefined)).toBe(0);
  });
});

describe('one reading, everywhere', () => {
  /**
   * The guard, rather than five call-site tests and a sixth site nobody
   * noticed.
   *
   * Four of the readers this replaced were `parseFloat` on the same field, and
   * one of them lives inside a hook in `App.tsx` that only renders. A test of
   * behaviour cannot reach it; a test of the source can, and it catches the
   * next one too — the failure here was never one wrong reading, it was five
   * readings of one string, drifting apart quietly.
   */
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const path = join(dir, d.name);
      if (d.isDirectory()) return walk(path);
      return /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [path] : [];
    });

  it('is the only reading of a credits line in the app', () => {
    const offenders: string[] = [];
    for (const file of walk('src')) {
      const text = readFileSync(file, 'utf8');
      text.split('\n').forEach((line, i) => {
        // `parseFloat` anywhere near the word is the shape that drifted.
        if (/parseFloat\([^)]*credits/i.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
