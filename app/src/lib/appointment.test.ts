import { describe, expect, it } from 'vitest';
import { readAppointments } from './appointment';
import { hourWindow } from '../components/HourGrid';

const appt = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  title: 'Advisor',
  date: '2026-09-10',
  at: 600,
  time: '10:00a',
  where: '',
  note: '',
  created: 0,
  ...over,
});

describe('reading a stored appointment', () => {
  it('leaves a complete one exactly as it is', () => {
    const a = appt();
    expect(readAppointments([a])).toEqual([a]);
  });

  /*
   * The record carries the hour twice — as a number the grids lay out from and
   * as the words somebody typed. A build that saved only the words is the
   * shape `kind` on the same interface is documented as optional for.
   */
  it('takes the hour from the words when the number is missing', () => {
    const [a] = readAppointments([appt({ at: undefined, time: '6:30p' })]);
    expect(a.at).toBe(18 * 60 + 30);
  });

  it('does not invent an hour it cannot read', () => {
    // Midnight would be a fact the app made up, and it would sort an
    // appointment nobody timed to the top of the day as if it were first.
    const [a] = readAppointments([appt({ at: null, time: 'after lab' })]);
    expect(a.at).toBe(-1);
  });

  it('refuses an `at` that is not a finite number', () => {
    for (const bad of ['600', NaN, Infinity, {}]) {
      const [a] = readAppointments([appt({ at: bad, time: '' })]);
      expect(Number.isFinite(a.at)).toBe(true);
    }
  });

  it('takes anything that is not a list as nothing', () => {
    expect(readAppointments(null)).toEqual([]);
    expect(readAppointments({ 0: appt() })).toEqual([]);
  });
});

/**
 * One block must not be able to take the axis with it.
 *
 * `Math.min(8 * 60, ...starts)` is NaN if a single start is, and everything an
 * hour grid draws comes off that number: the hour lines are
 * `Array.from({ length: hi - lo })`, which is empty for NaN, and every block's
 * `top` is NaN, which React reports and the browser ignores. Measured on the
 * calendar with one appointment carrying no `at`: no hour lines, and the day's
 * classes — which were perfectly well formed — stacked at the top.
 */
describe('the window an hour grid draws', () => {
  it('is the day’s own, padded an hour either side', () => {
    expect(hourWindow([{ at: 9 * 60, minutes: 50 }], 18)).toEqual({ lo: 7, hi: 19 });
  });

  it('opens up for something early or late', () => {
    expect(hourWindow([{ at: 6 * 60, minutes: 60 }], 18).lo).toBe(5);
    expect(hourWindow([{ at: 21 * 60, minutes: 60 }], 18).hi).toBe(23);
  });

  it('survives a block with no hour, rather than losing every hour', () => {
    const window = hourWindow(
      [{ at: 9 * 60, minutes: 50 }, { at: undefined as unknown as number, minutes: 50 }],
      18,
    );
    expect(window).toEqual({ lo: 7, hi: 19 });
    expect(Number.isFinite(window.lo)).toBe(true);
    expect(window.hi - window.lo).toBeGreaterThan(0);
  });

  it('survives a block with no length', () => {
    const window = hourWindow([{ at: 21 * 60, minutes: NaN }], 18);
    expect(Number.isFinite(window.hi)).toBe(true);
    expect(window.hi).toBe(22);
  });

  it('still has a window when there is nothing at all', () => {
    expect(hourWindow([], 18)).toEqual({ lo: 7, hi: 19 });
  });
});
