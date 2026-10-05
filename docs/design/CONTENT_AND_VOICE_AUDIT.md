# Content and voice audit (phase D0)

`c170dcd`, 2026-10-04. Counts are greps over `app/src/**/*.{ts,tsx}` excluding
tests unless stated; they are heuristics and several only sample. Existing
standards: `docs/design/SEMESTER-CONTENT-STANDARDS.md`,
`docs/product-design/PRODUCT-COPY-AND-VOICE-GUIDE.md`, `BRAND-PLATFORM.md` §1.7.
This audit does not rewrite them; it measures the brief against the code.

## 1. Results

| Rule from the brief | Measured | Verdict |
|---|---|---|
| Never emoji | Pictographs U+1F300-1FAFF: 3 files, 13 codepoints, all chat reactions — `lib/roomchat.ts:51` (👍🙏🎯😄😮😕), `lib/mesh.ts:422` (👍👏😂🎉😮❤️), `components/room/Write.tsx:225` (🙂, aria-hidden). Dingbat range U+2600-27BF: 79 lines in 46 files, functional glyphs (✓ ✕ ☐ ★) | UI has none; reaction pickers are an open question (VD-043) |
| No exclamation marks | ~0 in visible strings. Only TS non-null assertions (`screens/Mine.tsx:456`, `Calendar.tsx:2245`), quoted anti-patterns (`ai/prompt.ts:173`, `lib/voice.ts:10` "Great question!"), a factorial (`lib/laplace.ts:810`) | Clean; unguarded |
| "student" not "user"/"learner" | JSX text "user": 0. Attributes: 1 (URL placeholder `Connect.tsx:542`). Quoted "user": 28, nearly all `role: 'user'` API messages. "learner": 54 quoted strings, mostly identifiers/imports for the Learner Pathways feature (`LearnerPathways.tsx:10,33`, `Pathway.tsx:12`, `RegistrationPortal.tsx:3`, `lib/automationrungs.ts:30`) | Visible wording of the Learner Pathways label not individually checked |
| Sentence case | strict regex finds 3 Title Case: `WeeklyReset.tsx:92` "Weekly Reset", `toolkit/ResearchPanel.tsx:75` "Research Studio", `OperatingRhythmWorkspace.tsx:277` "Start Here". Undercounts props/expressions. 33 `text-transform: uppercase` rules in `app.css` | Mostly sentence case; sample only |
| Never "Student OS" in public product copy | 0 occurrences in `app/src` | Clean |
| Don't overclaim replacement | "replaces": no marketing claim in JSX; "official": 142 non-comment lines, mostly truthful (`Maps.tsx:1022` "The official maps"; `Opportunities.tsx:201-203` warns "treat this as unverified" with no source). **No test ties the word "official" to a badge** | Unguarded |
| No gamification | streak 1 (`Study.tsx:1137` "says why none of this is a streak"), confetti 0, leaderboard 1 (`site/community.tsx:88` "…leaderboard of anybody"). Deliberate: `lib/connectregister.ts:171` records "No public comparison: no leaderboard, no streak…" as tested. `lib/intime.ts:58` `streak` is an internal spaced-repetition counter, not UI | Clean |
| Date "Thu 9 Oct · 23:59" | `lib/date.ts` (DOW short names; `weekdayShort:288`, day label 348, 354) yields "Thu 9 Oct". But `lib/lookup.ts` and `lib/integration/school-records.ts` call `toLocale*String('en-US', {weekday:'short', month:'short', day:'numeric'})`, which renders "Thu, Oct 9". `weekday: 'short'` appears 18 times. `lib/family.ts` uses `en-CA` ISO | Mixed order (VD-041) |
| Tabular numerals | `tabular-nums` in 26 TSX files, `app.css` 12 lines, `unity.css` 3 | Partial; no guard |
| Middle dot for compact metadata | used (`Offline · changes waiting`, `Demo environment · Fictional data`) | Present; not audited |
| Label non-live data "Sample" | `SampleMark` banner; `Where.sample`; `SourceBadge` cannot say Sample | Inconsistent (VD-038) |
| Status sentence: what is true / what it means / what to do | Pattern exists in places (known-limitations, offline, `NotOfficial`); no component forces it | Convention only |
| Consequence before consequential action; preserve drafts and say they are safe | Strong in `ActionPreview` (unused) and in individual callers; no structural enforcement | See STATUS audit §5 |

## 2. Existing guards (and what they miss)

- `scripts/terms.mjs` → `content/terms.ts` RETIRED words with per-file ledger
  (`content/ledger.ts`): to-do, task, homework, deliverable, roadmap,
  unverified, smart, "something went wrong", "click here".
- `decisionlabels.test.ts`: `<SourceBadge label=…>` literals on Degree, Grades,
  Registrar.
- `designcontracts.test.ts`, `lib/unity.test.ts` (one wording per status),
  `a11y/title.test.ts`, `rendered-words.test.ts`.
- **Not guarded anywhere:** emoji, exclamation marks, "user"/"learner", Title
  Case, date order, "Student OS", "official" without provenance.

## 3. Conflicts between the brief and existing standards

1. **"task"**: the content ledger *retires* "task" in student-facing copy
   (DD-001, closed in #849: "Your own actions"). The brief's rail and Today
   copy use **Tasks** as a destination. Naming decision needed before the rail
   is built (ADR-0035).
2. **"Official" vs "Institution verified"**: the brief settles DD-003 in favour
   of Institution verified. `status.ts` still says "Official".
3. **Date**: brief "Thu 9 Oct · 23:59"; `lib/date.ts` matches; two other
   formatters do not.

## 4. Proposed guards (D6)

A single `content/rules.ts` read by a Vitest file, on the model of `terms.ts`:
no emoji outside a ledgered chat-reaction list; no `!` in JSX text or string
literals outside a ledger; "user"/"learner" in visible strings (attributes,
JSX text, `title`, `aria-label`) outside a ledger; `toLocale*String` with
weekday outside `lib/date.ts`; "Student OS" anywhere under `app/src` or
`company-site/`; `official` within 200 characters of no `SourceBadge` in the
same file (warning first, ratchet down like `styles/budget.ts`).
