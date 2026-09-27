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

1. **Done (Phase 4a).** `app/src/lib/locale.ts` is the one place dates, times
   and numbers are written; about forty `toLocale*` calls now go through it,
   and `app/src/lib/locale.guard.test.ts` refuses new ones outside it. With
   nothing chosen every value is byte-identical to before (tested against the
   calls it replaced); `VITE_ME_LANGUAGE` gates the student's choice, which is
   offered on the Appearance page as **Dates and numbers**. Looking at the app
   with German and Arabic chosen found three things the tests had not:
   - right-to-left values reorder inside an English sentence, so the formatters
     wrap them in directional isolates (U+2068/U+2069);
   - 20 files still draw `date.ts`'s English month and day names directly
     (the calendar grid, the Today header), and
   - 22 files write their own twelve-hour clocks, and class times arrive
     pre-formatted ("9:05a") in the course data.

   Both were ratchets in the guard.
1b. **Done.** Every date and time the app *draws* now follows a chosen
   locale; with nothing chosen every string is the one the screens built by
   hand, which `app/src/lib/locale.test.ts` checks for every day of a year.
   - `app/src/lib/date.ts` has one function per drawn shape (`monthDay`,
     `dayMonthLong`, `weekdayDay`, `monthYear`, `weekdayInitialOf`…), used by
     the eighteen files that had assembled them from the English names.
   - Stored times stay canonical. "9:05a" is what a class block, a task, an
     appointment and a feed event *store*, and `readDue` parses it back, so the
     producers of stored strings keep writing it and screens draw it through
     `shownTime(time, at)`. Two producers were nearly converted by mistake —
     `yes.ts` (an imported course's schedule and `meets` line) and `drag.ts`
     (the `time` of an item dropped on the calendar) — and were caught by
     tracing callers before committing. Both are listed in the guard with that
     reason.
   - The guard's rule is now: English names or a hand-written twelve-hour clock
     only in a documented parser or stored-form producer, or in a file that
     consults the locale and keeps the English form as its "nothing chosen"
     branch. It was shown to go red on a planted example of each.

   Still English by design: parsers (`capture.ts`, `registrar.ts`), text for
   the assistant (`lookup.ts`, `brief.ts`), text sent to staff
   (`help-routes.ts`), exports, and `school-records.ts`'s UTC records. Weeks
   still start on Sunday in every locale; that is a layout change, not a format
   one, and is left for the catalogue work below.
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
