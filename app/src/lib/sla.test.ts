import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CREDIT_SCHEDULE,
  allowedDowntime,
  availability,
  credit,
  formatDuration,
  meets,
  periodMinutes,
} from './sla';

/**
 * `docs/trust/SLA.md` prints the numbers a procurement office will read as
 * contract terms. This holds every one of them to `sla.ts`, so that a figure
 * typed by hand, or copied from somewhere that got February wrong, fails here
 * rather than in a negotiation.
 */

const DOC = join(process.cwd(), '..', 'docs', 'trust', 'SLA.md');

/** The table that follows an `<!-- sla:name -->` marker, as rows of cells. */
function table(name: string, text = readFileSync(DOC, 'utf8')): string[][] {
  const after = text.split(`<!-- sla:${name} -->`)[1] ?? '';
  const lines = after.split('\n').map((l) => l.trim());
  const start = lines.findIndex((l) => l.startsWith('|'));
  const out: string[][] = [];
  for (const line of lines.slice(start)) {
    if (!line.startsWith('|')) break;
    if (/^\|\s*-/.test(line)) continue;
    out.push(line.split('|').slice(1, -1).map((c) => c.trim()));
  }
  return out.slice(1); // drop the header
}

const pct = (cell: string) => Number(cell.replace('%', ''));

describe('the arithmetic', () => {
  it('computes the worked example the document gives', () => {
    expect(availability(periodMinutes(30), 37)).toBeCloseTo(99.914, 3);
    expect(meets(99.9, periodMinutes(30), 37)).toBe(true);
    expect(meets(99.95, periodMinutes(30), 37)).toBe(false);
  });

  it('treats a month exactly on the target as meeting it', () => {
    const month = periodMinutes(30);
    const exactly = allowedDowntime(99.99, month); // 4.32 minutes
    // The failure this exists for: a percentage comparison calls this a breach.
    expect(availability(month, exactly) >= 99.99).toBe(false);
    expect(meets(99.99, month, exactly)).toBe(true);
    expect(meets(99.99, month, exactly + 0.01)).toBe(false);
    const february = allowedDowntime(99.5, periodMinutes(29));
    expect(availability(periodMinutes(29), february) >= 99.5).toBe(false);
    expect(meets(99.5, periodMinutes(29), february)).toBe(true);
    // And the credit bands sit on the same comparison.
    const band = allowedDowntime(99.9, month);
    expect(credit(month, band)).toBe(0);
    expect(credit(month, band + 0.01)).toBe(10);
  });

  it('puts every availability in exactly one credit band', () => {
    const month = periodMinutes(30);
    // 99.895% is in the gap the range-written schedule left unowned.
    const inTheGap = month * (1 - 99.895 / 100);
    expect(credit(month, inTheGap)).toBe(10);
    expect(credit(month, allowedDowntime(99.0, month))).toBe(10);
    expect(credit(month, allowedDowntime(95.0, month))).toBe(25);
    expect(credit(month, allowedDowntime(95.0, month) + 1)).toBe(50);
    expect(credit(month, month)).toBe(50);
  });

  it('refuses periods and downtime that cannot happen', () => {
    expect(() => availability(0, 0)).toThrow(RangeError);
    expect(() => availability(100, 101)).toThrow(RangeError);
    expect(() => availability(100, -1)).toThrow(RangeError);
    expect(() => allowedDowntime(0, 100)).toThrow(RangeError);
  });

  it('formats durations as the tables print them', () => {
    expect(formatDuration(43.2)).toBe('43m 12s');
    expect(formatDuration(432)).toBe('7h 12m');
    expect(formatDuration(5256)).toBe('3d 15h 36m');
    expect(formatDuration(0)).toBe('0s');
  });
});

describe('docs/trust/SLA.md', () => {
  const downtime = table('downtime');
  const credits = table('credits');

  it('parses both tables — an empty parse would pass everything below', () => {
    expect(downtime.map((r) => r[0])).toEqual(['99.0%', '99.5%', '99.9%', '99.95%', '99.99%']);
    expect(credits.length).toBe(CREDIT_SCHEDULE.length);
  });

  it('prints the allowed downtime the code computes, for every target and period', () => {
    const days = [28, 30, 31, 365];
    for (const [target, ...cells] of downtime) {
      expect(cells.length, target).toBe(days.length);
      days.forEach((d, i) => {
        expect(cells[i], `${target} over ${d} days`).toBe(
          formatDuration(allowedDowntime(pct(target), periodMinutes(d))),
        );
      });
    }
  });

  it('prints the credit schedule the code applies', () => {
    credits.forEach(([atLeast, creditCell], i) => {
      expect(pct(atLeast), `band ${i}`).toBe(CREDIT_SCHEDULE[i].atLeast);
      expect(pct(creditCell), `band ${i}`).toBe(CREDIT_SCHEDULE[i].creditPercent);
    });
  });

  it('catches a hand-typed figure — the check above, pointed at a wrong one', () => {
    const wrong = table(
      'downtime',
      '<!-- sla:downtime -->\n| Target | a | b | c | d |\n| --- |\n| 99.9% | 43m 12s | 43m 12s | 43m 12s | 8h 45m 36s |\n',
    );
    // A 28-day month copied from the 30-day column: the mistake this guards.
    expect(wrong[0][1]).not.toBe(formatDuration(allowedDowntime(99.9, periodMinutes(28))));
  });
});
