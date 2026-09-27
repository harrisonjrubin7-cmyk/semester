# Localization, plain language and internationalization

Part 7 of the expansion command. Phase 4. **Can start now** — it depends on
nothing in flight, and it is where `main` has least.

## What exists on main

- `app/index.html` declares `lang="en"`. There is no message catalogue, no
  `t()`, no locale setting.
- `app/src/lib/date.ts` hard-codes English month and day names.
  `toLocale*` is called in about 35 places, mostly with an undefined locale, and
  twice with `'en-US'`. There is no `Intl.NumberFormat`, `PluralRules` or
  `RelativeTimeFormat`.
- Time zones are handled deliberately: `npm run test:zones` runs the suite in
  America/Chicago and Pacific/Kiritimati.
- Plain language exists in places (`app/src/lib/controls.ts`, the NIL
  explainer) but not as a mode.
- `docs/SCHOOL_DATA_PACK.md` defines what a school supplies; an
  international-resources section fits there.

## In flight

Nothing. #777 and #792 touch shared chrome and styles, so the string extraction
in step 2 below rebases onto them rather than racing them.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `locales` | **Code**: a list of supported locale tags | |
| `localized_content` | **Message files** in the repository, one per locale | Interface strings version with the code |
| `translation_records`, `translation_provenance` | **One field** on each translated string: `official_translation · machine_translated · student_entered` | |
| `terminology_glossary` | **Data file**, per school override in the school pack | "Bursar", "hold", "audit" — defined once |
| `plain_language_variants` | **A second message** keyed by the same id | |
| `timezone_preferences` | **Profile field** | |
| `international_resource_directory` | **School pack section** | Official links only, per school |
| `language_accessibility_preferences` | **Device preference** | |

## Order of work

1. Replace `date.ts`'s hard-coded names with `Intl.DateTimeFormat` for the
   chosen locale, and route every `toLocale*` call through one helper. This is
   the change with the most regression risk, so it goes first and alone, with
   `test:zones` green.
2. Introduce the catalogue for the five destinations' chrome only. Do not
   extract every string in one change.
3. Glossary and plain-language mode.
4. RTL: logical CSS properties (`margin-inline-start`) in new code; an audit of
   `app/src/styles` for physical ones.

## Capabilities and flags

- No capability: language is a student setting. Schools edit their glossary and
  international directory through the school pack, as they edit everything
  else in it.
- Flag `me.language`, `off` until at least one non-English catalogue is complete
  for the five destinations. A half-translated interface is worse than none.

## Hard boundaries

- **Official policy is never machine-translated as authoritative.** A
  translated policy shows the original language, a link to the official text,
  and "Machine translated — the official version is in English".
- **No immigration, tax or legal advice.** The international directory routes to
  the school's offices and official government pages, and says it is routing.
- Locale is chosen by the student, never inferred from name, location or
  network.

## Tests

- Dates, times, numbers and currency in `en`, `es`, `ar` and `zh` against
  `Intl` expectations; `test:zones` stays green.
- A machine-translated policy renders the caveat and the original link.
- RTL: the five destinations at `dir="rtl"` have no horizontal overflow (a
  browser smoke).
- A missing translation falls back to English, never to a key.
