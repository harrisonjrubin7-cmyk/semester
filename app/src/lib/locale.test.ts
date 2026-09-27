// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FORMAT_LOCALES,
  LOCALE_KEY,
  appLocale,
  chosenLocale,
  dateFormatter,
  directionOf,
  formatDate,
  formatDateTime,
  formatNumber,
  formatTime,
  languageFlag,
  resetLocaleCache,
  setChosenLocale,
  setLanguageFlag,
} from './locale';
import { clock, decorateEvent, longLabel, monthShort, weekdayShort } from './date';

/*
 * Module state, in a shared-isolation project: every test here leaves the
 * flag, the stored choice and the cached read exactly as it found them, or the
 * next file to format a date inherits a Spanish calendar.
 */
beforeEach(() => {
  localStorage.removeItem(LOCALE_KEY);
  resetLocaleCache();
  setLanguageFlag(null);
});
afterEach(() => {
  localStorage.removeItem(LOCALE_KEY);
  resetLocaleCache();
  setLanguageFlag(null);
});

const AT = new Date(2026, 8, 27, 14, 45); // Sunday 27 September 2026, 2:45 pm local

describe('the flag', () => {
  it('is off unless the build says otherwise', () => {
    expect(languageFlag({})).toBe('off');
    expect(languageFlag({ VITE_ME_LANGUAGE: 'nonsense' })).toBe('off');
    expect(languageFlag({ VITE_ME_LANGUAGE: 'preview' })).toBe('preview');
  });

  it('off, a stored choice is ignored — so turning it off is the whole rollback', () => {
    setChosenLocale('de');
    expect(chosenLocale()).toBe('de');
    expect(appLocale()).toBeUndefined();
    expect(formatDate(AT, { month: 'long' })).toBe(AT.toLocaleDateString(undefined, { month: 'long' }));
  });

  it('on, with nothing chosen, still follows the device', () => {
    setLanguageFlag('preview');
    expect(appLocale()).toBeUndefined();
  });

  it('on, with a choice, uses it', () => {
    setLanguageFlag('preview');
    setChosenLocale('es');
    expect(appLocale()).toBe('es');
  });
});

describe('with nothing chosen, every format is what the code it replaced wrote', () => {
  /*
   * The equivalence the call-site change rests on: `formatX(v, o)` against
   * `v.toLocaleXString(undefined, o)` for the option sets the app actually
   * passes. If one of these differs, a screen changed for a student who chose
   * nothing.
   */
  const DATE_OPTIONS: (Intl.DateTimeFormatOptions | undefined)[] = [
    undefined,
    { month: 'short', day: 'numeric' },
    { day: 'numeric', month: 'long' },
    { weekday: 'long' },
    { weekday: 'long', month: 'long', day: 'numeric' },
    { weekday: 'long', month: 'short', day: 'numeric' },
    { month: 'short', day: 'numeric', year: 'numeric' },
  ];

  it.each(DATE_OPTIONS.map((o) => [JSON.stringify(o) ?? 'none', o] as const))('dates, %s', (_, o) => {
    expect(formatDate(AT, o)).toBe(AT.toLocaleDateString(undefined, o));
    expect(formatDate(AT.getTime(), o)).toBe(AT.toLocaleDateString(undefined, o));
    expect(formatDate(AT.toISOString(), o)).toBe(AT.toLocaleDateString(undefined, o));
  });

  it('times, date-times and numbers', () => {
    const hm: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
    expect(formatTime(AT)).toBe(AT.toLocaleTimeString());
    expect(formatTime(AT, hm)).toBe(AT.toLocaleTimeString(undefined, hm));
    expect(formatDateTime(AT)).toBe(AT.toLocaleString());
    expect(formatDateTime(AT, { month: 'short', day: 'numeric', ...hm })).toBe(
      AT.toLocaleString(undefined, { month: 'short', day: 'numeric', ...hm }),
    );
    expect(formatNumber(80000)).toBe((80000).toLocaleString());
    expect(dateFormatter({ weekday: 'short' }).format(AT)).toBe(
      new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(AT),
    );
  });

  it("date.ts keeps its English names and its own clock", () => {
    expect(longLabel(AT)).toBe('Sun Sep 27');
    expect(monthShort(AT)).toBe('Sep');
    expect(weekdayShort(AT)).toBe('Sun');
    expect(clock(14 * 60 + 45)).toBe('2:45p');
    const e = decorateEvent({ month: 8, day: 27 } as Parameters<typeof decorateEvent>[0], AT);
    expect([e.mon, e.dow]).toEqual(['Sep', 'Sun']);
  });
});

describe('with a locale chosen', () => {
  beforeEach(() => setLanguageFlag('preview'));

  it('writes dates in that locale, in its own order', () => {
    setChosenLocale('es');
    expect(formatDate(AT, { day: 'numeric', month: 'long' })).toBe('27 de septiembre');
    expect(longLabel(AT)).toBe(AT.toLocaleDateString('es', { weekday: 'short', month: 'short', day: 'numeric' }));
    expect(longLabel(AT)).not.toMatch(/Sep|Sun/);
  });

  it("writes the time the way that locale's clock does", () => {
    setChosenLocale('de');
    expect(clock(14 * 60 + 45)).toBe('14:45');
    setChosenLocale('en-US');
    expect(clock(14 * 60 + 45)).toBe('2:45 PM');
  });

  it('groups numbers the way that locale does', () => {
    setChosenLocale('de');
    expect(formatNumber(80000)).toBe('80.000');
    setChosenLocale('fr');
    expect(formatNumber(80000)).toBe('80 000');
    setChosenLocale('hi');
    expect(formatNumber(1234567)).toBe('12,34,567');
  });

  it('draws month and weekday names in Arabic and Chinese', () => {
    setChosenLocale('ar');
    expect(monthShort(AT)).toBe(`\u2068${AT.toLocaleDateString('ar', { month: 'short' })}\u2069`);
    setChosenLocale('zh-CN');
    expect(monthShort(AT)).toBe('9月');
  });

  it('refuses a tag it does not offer, and falls back to the device', () => {
    setChosenLocale('xx-NOPE');
    expect(chosenLocale()).toBeNull();
    expect(appLocale()).toBeUndefined();
    localStorage.setItem(LOCALE_KEY, 'tlh');
    resetLocaleCache();
    expect(chosenLocale()).toBeNull();
  });

  it('survives a reload through storage, and "match this device" clears it', () => {
    setChosenLocale('pt-BR');
    resetLocaleCache();
    expect(chosenLocale()).toBe('pt-BR');
    setChosenLocale(null);
    expect(localStorage.getItem(LOCALE_KEY)).toBeNull();
    resetLocaleCache();
    expect(chosenLocale()).toBeNull();
  });
});

describe('every offered locale', () => {
  it('is one Intl formats in, not a silent fallback to English', () => {
    for (const { tag } of FORMAT_LOCALES) {
      const [supported] = Intl.DateTimeFormat.supportedLocalesOf([tag]);
      expect(supported, tag).toBeDefined();
    }
  });

  it('has a direction, and only Arabic among them runs right to left', () => {
    const rtl = FORMAT_LOCALES.filter((l) => directionOf(l.tag) === 'rtl').map((l) => l.tag);
    expect(rtl).toEqual(['ar']);
    expect(directionOf('he-IL')).toBe('rtl');
    expect(directionOf('fa')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
  });
});

describe('right-to-left values inside English text', () => {
  beforeEach(() => setLanguageFlag('preview'));

  it('are isolated, so a sentence of three of them keeps its order', () => {
    setChosenLocale('ar');
    for (const text of [
      formatDate(AT, { day: 'numeric', month: 'long' }),
      formatTime(AT, { hour: 'numeric', minute: '2-digit' }),
      formatDateTime(AT),
      formatNumber(80000),
      dateFormatter({ weekday: 'short' }).format(AT),
      longLabel(AT),
    ]) {
      expect(text.startsWith('⁨') && text.endsWith('⁩'), JSON.stringify(text)).toBe(true);
    }
  });

  it('left-to-right values get nothing added', () => {
    setChosenLocale('de');
    expect(formatNumber(80000)).toBe('80.000');
    expect(formatDate(AT, { month: 'long' })).toBe('September');
  });
});
