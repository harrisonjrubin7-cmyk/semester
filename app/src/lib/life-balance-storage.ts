import { finite, obj } from './device-library';

export interface Commute {
  /** Weekdays it happens on, 0 = Sunday. */
  days: number[];
  /** One way. The day counts it twice. */
  minutesEachWay: number;
}

export interface Settings {
  commute: Commute | null;
}

export const EMPTY_SETTINGS: Settings = { commute: null };
export const LIFE_BALANCE_KEY = 'semester.life-balance.v1';

/** A reader for the device store; throws on anything it did not write, so the bytes are kept. */
export function readSettings(value: unknown): Settings {
  if (!obj(value)) throw new Error('Saved balance settings are not valid.');
  if (value.commute === null || value.commute === undefined) return { commute: null };
  const c = value.commute;
  if (
    !obj(c) ||
    !Array.isArray(c.days) ||
    c.days.length > 7 ||
    !c.days.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) ||
    new Set(c.days).size !== c.days.length ||
    !finite(c.minutesEachWay, 0, 240)
  ) {
    throw new Error('A saved commute is not valid.');
  }
  return { commute: { days: [...(c.days as number[])].sort(), minutesEachWay: c.minutesEachWay } };
}
