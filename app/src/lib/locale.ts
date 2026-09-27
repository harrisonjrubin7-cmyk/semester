import type { FeatureState } from '../intelligence/contracts';

/**
 * Which locale dates, times and numbers are written in, and the one way to
 * write them.
 *
 * Before this file the app answered that question two ways at once. `date.ts`
 * drew every month and weekday from hard-coded English names, and about forty
 * other places called `toLocaleDateString(undefined, …)`, which follows the
 * device. On an English device the two agree; on a Spanish one the calendar
 * said "Sep" while the Downloads sheet said "27 de septiembre". Neither was
 * a choice anybody made.
 *
 * So there is one answer, `appLocale()`:
 *
 * - **Nothing chosen** — `undefined`, which is exactly what those forty calls
 *   passed before, and `date.ts` keeps its English names. With no choice the
 *   app formats every value byte-for-byte as it did; `locale.test.ts` checks
 *   that against the calls it replaced.
 * - **A locale chosen** — that tag, everywhere, including `date.ts`'s names.
 *
 * The choice is the student's, made on the Appearance page. It is never
 * inferred from a name, a school, a location or a network (see
 * `docs/LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md`). And it is only
 * honoured while `VITE_ME_LANGUAGE` is on: with the flag off a stored choice is
 * ignored, so turning the flag off is a complete rollback.
 *
 * This is formats only. The interface is still written in English, so a
 * chosen locale changes how "27 September" is written, not the words around
 * it — which is also why `<html lang>` and `dir` stay as they are until a
 * message catalogue exists for the language.
 *
 * `locale.guard.test.ts` refuses a new `toLocale…String` or `new Intl.…Format`
 * anywhere else, with a short list of exceptions that each say why they must
 * not follow the student's choice.
 */

export const LOCALE_KEY = 'semester.locale.v1';

export type Direction = 'ltr' | 'rtl';

export interface LocaleOption {
  /** A BCP 47 tag `Intl` accepts. */
  tag: string;
  /** The locale's own name for itself, which is how a speaker looks for it. */
  name: string;
  /** The same in English, for the line under it. */
  english: string;
}

/**
 * The locales offered. A short list on purpose: every one is exercised by the
 * formatting tests, and a tag that is offered but untested is the one that
 * turns out to write dates backwards.
 */
export const FORMAT_LOCALES: readonly LocaleOption[] = [
  { tag: 'en-US', name: 'English (United States)', english: 'English (United States)' },
  { tag: 'en-GB', name: 'English (United Kingdom)', english: 'English (United Kingdom)' },
  { tag: 'es', name: 'Español', english: 'Spanish' },
  { tag: 'fr', name: 'Français', english: 'French' },
  { tag: 'de', name: 'Deutsch', english: 'German' },
  { tag: 'pt-BR', name: 'Português (Brasil)', english: 'Portuguese (Brazil)' },
  { tag: 'ar', name: 'العربية', english: 'Arabic' },
  { tag: 'zh-CN', name: '中文（简体）', english: 'Chinese (Simplified)' },
  { tag: 'ko', name: '한국어', english: 'Korean' },
  { tag: 'hi', name: 'हिन्दी', english: 'Hindi' },
];

const OFFERED = new Set(FORMAT_LOCALES.map((l) => l.tag));

const STATES: readonly FeatureState[] = ['off', 'preview', 'sandbox', 'production'];

/** `VITE_ME_LANGUAGE`, read the way `experience-flags.ts` reads its own. Absent is off. */
export function languageFlag(env: Record<string, unknown>): FeatureState {
  const value = env.VITE_ME_LANGUAGE;
  return STATES.includes(value as FeatureState) ? (value as FeatureState) : 'off';
}

/*
 * Read defensively: `video/` type-checks and runs this file outside Vite, where
 * `import.meta.env` does not exist, and there the flag is simply off.
 */
export const LANGUAGE_FLAG: FeatureState = languageFlag((import.meta as { env?: Record<string, unknown> }).env ?? {});

/*
 * The flag in force. The build's value, except where a test sets another and
 * puts it back — module state, so a test that sets it and does not restore it
 * would leak into every file after it in the shared project.
 */
let flagInForce: FeatureState = LANGUAGE_FLAG;

export function setLanguageFlag(flag: FeatureState | null): void {
  flagInForce = flag ?? LANGUAGE_FLAG;
}

export const languageOn = (flag: FeatureState = flagInForce): boolean => flag !== 'off';

/*
 * The stored choice, read once. `undefined` means not read yet; `null` means
 * read and nothing chosen. Storage can throw (a private window, blocked site
 * data), and a throw here would take every date on every screen with it, so
 * any failure reads as "nothing chosen".
 */
let chosen: string | null | undefined;

export function chosenLocale(): string | null {
  if (chosen === undefined) {
    let stored: string | null = null;
    try {
      stored = globalThis.localStorage?.getItem(LOCALE_KEY) ?? null;
    } catch {
      stored = null;
    }
    chosen = stored && OFFERED.has(stored) ? stored : null;
  }
  return chosen;
}

/** Choose a locale, or `null` to go back to matching the device. */
/**
 * Returns whether the choice was stored. When the browser will not store it,
 * it is kept for this page only — so a caller must not reload after a
 * `false`, which would throw the choice away.
 */
export function setChosenLocale(tag: string | null): boolean {
  const next = tag && OFFERED.has(tag) ? tag : null;
  chosen = next;
  try {
    if (next) globalThis.localStorage?.setItem(LOCALE_KEY, next);
    else globalThis.localStorage?.removeItem(LOCALE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** For tests: forget the cached read so the next call reads storage again. */
export function resetLocaleCache(): void {
  chosen = undefined;
}

/** The locale every format uses. `undefined` is the device's, as before. */
export function appLocale(flag: FeatureState = flagInForce): string | undefined {
  if (!languageOn(flag)) return undefined;
  return chosenLocale() ?? undefined;
}

const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'dv', 'yi', 'ku', 'sd', 'ug']);

/**
 * Which way a locale's text runs. Not applied to the page yet — the interface
 * is English whatever is chosen — but every layout that will need it asks
 * here, so the day a catalogue lands there is one answer to change.
 */
export function directionOf(tag: string): Direction {
  const language = tag.toLowerCase().split(/[-_]/)[0];
  return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
}

type When = Date | number | string;

const asDate = (when: When): Date => (when instanceof Date ? when : new Date(when));

/**
 * A right-to-left value, fenced off from the English around it.
 *
 * Found by looking, not by testing: with Arabic chosen, "Written as: Sunday
 * 27 September · 2:45 PM · 80,000" rendered as "80,000 · م 2:45 · الأحد، 27
 * سبتمبر" — the bidirectional algorithm treats the three Arabic runs and the
 * neutral dots between them as one right-to-left stretch and reverses their
 * order inside the English sentence. First Strong Isolate and Pop Directional
 * Isolate (U+2068, U+2069) make each value its own island. They are invisible,
 * screen readers skip them, and in a left-to-right locale nothing is added, so
 * no existing string changes.
 */
const FSI = '\u2068';
const PDI = '\u2069';

function isolated(text: string, locale: string | undefined): string {
  return locale && directionOf(locale) === 'rtl' ? `${FSI}${text}${PDI}` : text;
}

/*
 * The four formatters. Each calls the same method the code it replaces called,
 * with the same options, and swaps only the locale argument — so with nothing
 * chosen the output is identical by construction, not by coincidence. Going
 * through `Intl.DateTimeFormat` instead would have changed the defaults:
 * `toLocaleDateString({ hour })` adds a date, `DateTimeFormat({ hour })` does
 * not.
 */

export function formatDate(when: When, options?: Intl.DateTimeFormatOptions): string {
  const locale = appLocale();
  return isolated(asDate(when).toLocaleDateString(locale, options), locale);
}

export function formatTime(when: When, options?: Intl.DateTimeFormatOptions): string {
  const locale = appLocale();
  return isolated(asDate(when).toLocaleTimeString(locale, options), locale);
}

export function formatDateTime(when: When, options?: Intl.DateTimeFormatOptions): string {
  const locale = appLocale();
  return isolated(asDate(when).toLocaleString(locale, options), locale);
}

export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  const locale = appLocale();
  return isolated(n.toLocaleString(locale, options), locale);
}

/** A reusable date formatter, for the few places that format in a loop. Isolated like the rest. */
export function dateFormatter(options?: Intl.DateTimeFormatOptions): Pick<Intl.DateTimeFormat, 'format'> {
  const locale = appLocale();
  const format = new Intl.DateTimeFormat(locale, options);
  return { format: (when?: Date | number) => isolated(format.format(when), locale) };
}

/**
 * The device's time zone. Read here so the two places that send it to a
 * server read it the same way, and so a future time-zone setting has one
 * place to take over.
 */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
