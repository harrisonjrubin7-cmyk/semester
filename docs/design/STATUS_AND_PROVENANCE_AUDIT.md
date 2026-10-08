# Status and provenance audit (phase D0)

Scope: source vocabulary, status vocabulary, AI response, consequence preview,
family sharing, sample marking. `c170dcd`, 2026-10-04. Read from source; nothing
was rendered.

## 1. Four vocabularies, not one

| File | What it holds | Glyph |
|---|---|---|
| `app/src/lib/source.ts` | `SOURCE_LABELS` (5, **tied to a DB check constraint** by `lib/source.test.ts`): institution_verified, imported, student_entered, estimated, needs_review. `TRUST_KINDS` (line 65) adds ai_assisted, external, unavailable_stale. Freshness helpers | none |
| `app/src/lib/status.ts` | `StatusKey`: the 6 `Where` keys + faculty-approved, course-provided, ai-assisted, updated-today, needs-confirmation, action-required, saving, saved, syncing, synced, offline, queued, conflict, sync-error, signed-out, device-only. Each has label, short, about, tone, glyph, `urgent` | yes |
| `app/src/lib/where.ts` | `Where`: official, connected, made, yours, sample, stale (words Official, Connected, Made here, Yours, Sample, Out of date) | no |
| `app/src/lib/factprovenance.ts` | `ORIGIN_WORD`/`ORIGIN_GLYPH` (lines 90-114), cues, lifecycle words | yes |

### Source kinds against the target

| Target | `source.ts` | `status.ts` | `factprovenance.ts` | Gap |
|---|---|---|---|---|
| official ◆ Institution verified | label, no glyph | "Official" ◆ | "Institution verified" ◆ (`OFFICIAL_WORD`, line 86) | word in `status.ts` |
| connected ⇄ Connected | **missing** | "Connected" `○` | "Connected" `↔` | glyph differs in both; `source.ts` lacks it |
| imported ↓ Imported | label, no glyph | **missing** | `↓` | `status.ts` lacks it |
| personal ○ Student entered | label, no glyph | "Yours" `○` | "Student entered" `◇` | word in `status.ts`; glyph in `factprovenance.ts` |
| ai ✦ AI-assisted | label, no glyph | "AI-assisted, source-linked" ✦ | ✦ | label in `status.ts` |
| estimated ≈ Estimated | label, no glyph | **missing** | ≈ | `status.ts` lacks it |
| review ? Needs review | label, no glyph | "Needs confirmation" ? | cue "Needs review" ? | word differs |
| stale ! Unavailable or stale | label ("unavailable_stale"), no glyph | "Out of date" ! | cue "Out of date" `↻` | word and glyph differ |
| external ↗ External | label, no glyph | **missing** | ↗ | `status.ts` lacks it |
| sample ◌ Sample | **missing** (`TrustKind` lacks it) | "Sample" ◌ | ◌ | `SourceBadge` cannot say Sample |

Extras not in the target: "Made here", "Source not recorded", "Not signed in",
"On this device only", "Age unknown", "Restricted", "Revoked", "Submitted".
Words that differ from the target: "Not approved" (target Rejected), "Pending"
(target Pending approval).

### Status vocabulary against the target

Present in `status.ts` with glyph and tone: Saving…, Saved, Syncing, Synced,
Offline, Queued, Conflict, Sync error (target "Conflict needs review", "Sync
trouble" — wording differs), Needs confirmation, Action required,
Faculty-approved, Course-provided, Updated today.
Present only as `factprovenance.ts` lifecycle cues: Pending, Approved, Not
approved, Verified.
**Missing everywhere:** Hold on account, Draft, Live, Preview (plain strings in
`lib/toolkit/templates.ts`, `lib/launchkit.ts`, `screens/Family.tsx`,
`lib/uxstates.ts`).
**Announcements:** there is no announcement text per status; only a boolean
`urgent` (offline, conflict, sync-error). `StatusChip` has no live region.
`SaveState` uses `role="alert"`/assertive when urgent, else `role="status"`/polite.

## 2. Renderers

| Component | Shows | Glyph + word? | Live region |
|---|---|---|---|
| `SourceBadge` (~33 files) | word + freshness + optional report button | **word only** | none (meaning in `title` + sr-only) |
| `unity/Status.tsx` StatusChip/SaveState/SyncState | glyph (aria-hidden), label, tone | yes | SaveState only |
| `unity/ProvenanceChips` (2 call sites) | origin chip + ≤2 cues + age | yes; visible text aria-hidden, sr-only `phrase()` | none |
| `NotOfficial` | standing sentence via `StatusChip` | yes | none, deliberately |
| `OfflineBanner` | offline notice | not checked | `role="status"` (line 71) |
| `StatusNotice` | incident notice | not checked | `role="status"` (line 49) |
| `FieldMessage` | form error | not checked | `aria-live="polite"` (line 76) |
| `IntelligenceDisclosure` | two `SourceBadge`s (ai_assisted, external) | word only | none |
| `Fresh` | "New version ready" — **not data freshness** despite the name | word | `role="status"` |
| `KindKey` | calendar-kind colour legend (not trust) | swatch + word | none |

Net: the glyph-bearing components are the least used; the dominant renderer
drops the glyph. A reader of Degree, Grades or Registrar sees a word.

## 3. Bypasses (greps, `app/src/**/*.tsx` excluding tests)

- Hand-rolled `pill|badge|chip|tag` class: 75 hits (ceiling; some are not
  status). Top: `Calendar.tsx` 6, `Opportunities.tsx` 4, `Courses.tsx` 4,
  `institutional/OperationsStudio.tsx` 4, `toolkit/ResearchPanel.tsx` 3,
  `CampusDirectory.tsx` 3.
- Colour-dot patterns (`borderRadius` 50%/999 + `background`): 32.
- `.trust-scorecard-row.is-green/yellow/red` colour-only (`app.css:10694-10696`).
- Hand-typed source words outside `SourceBadge`: ~22 (`site/more.tsx` 6,
  `site/pages.tsx` 3, `OfficeActionDesk.tsx` 2).
- `lib/syncstatus.ts:167-181` "Sync conflict", "Offline · changes waiting".
- `ai/Turns.tsx` `HowToRead` prints `data-source`/`data-policy` with no badge.
- `role="status|alert"`/`aria-live`: 386 occurrences in 214 files — so
  announcement exists, but by hand and unevenly.

## 4. AI surfaces

Files: `ai/Chat.tsx`, `Panel.tsx`, `Assistant.tsx`, `Turns.tsx`, `Answer.tsx`,
`Actions.tsx`, `Composer.tsx`, `Threads.tsx`, `components/GuideBar.tsx`,
`AiHandoffReview.tsx`, `intelligence/Disclosure.tsx`, `lib/assistant-confidence.ts`,
`lib/aispend.ts`, `lib/aistatus.ts`.

| Required | Status | Where |
|---|---|---|
| AI-assisted label | yes, word only | `Disclosure.tsx:36-37` |
| Data scope | partial, folded in `<details>` | "Information Semester used" |
| Sources/citations | yes, `<details>` per item (title, locator, excerpt, verifiedAt) | `Disclosure.tsx:46-65` |
| Confidence/uncertainty | partial: an "Uncertainty:" line; `assistant-confidence.ts` (5 levels) **unused by AI UI** | |
| Request cost | partial: monthly count "N answers this month. Estimated." | `ai/Chat.tsx:496` |
| Policy note | partial: "Policy:" line; `HowToRead` folded | `Disclosure.tsx`, `Turns.tsx` |
| Action proposal | yes: `Proposals`, button text is the change in future tense | `ai/Actions.tsx` |
| Confirmation state | **no** pending/confirmed/done; no `ConfirmDialog` on proposals | |
| Multi-step status | **no**; `DecisionTrail` is not it | |
| Source detail drawer | **no**; inline `<details>` only | |
| Live announcement | `role="log"` + `aria-live="polite"` on the thread | `Chat.tsx:164-165` |
| External-AI hand-off | yes, `role="dialog"`, says what is and is not sent | `AiHandoffReview.tsx` |

The disclosure receipt renders under the **last answer only**, and only when
`EXPERIENCE_FLAGS.semesterIntelligence !== 'off'` and a response exists
(`Chat.tsx:261`, `Panel.tsx:567`). Otherwise the fallback is `<Using>` +
`<Looked>`. So "always frame answers" is not true today.

## 5. Consequence preview

- `ConfirmDialog.tsx` (109 lines): focus starts on Cancel, Tab trap, external
  tone adds "You are leaving Semester", blocks official hand-off when offline.
  Enforces **no** what-changes / what-stays / reversible / who-can-help
  structure — each caller writes its own.
- `unity/ActionPreview.tsx` is the structured answer (subject, says, exactly,
  doesNotChange, subjectTo, required `recovery`, optional `provenance`) with no
  "who can help" field and **no real call site**.
- `ConfirmDialog` callers: `RegistrationDay`, `RegistrationDayCard`,
  `CourseDetailV2` ×2, `GraduationSimulator`, `TrustCenter` ×3, `CareerEvidence`,
  `LifeBalance`, `AdvisorMeeting` ×4, `AccountSecurity`, `OfficeActionDesk` ×2,
  `OfficeActionFeed` ×3, `SchoolClaim` ×2, `SourceLocker` ×2,
  `DemandContribution` ×2, `SemesterWrapped`; `useConfirm` in `Dining`.
- `window.confirm` ×5: `ActionCenter.tsx:94`, `ResearchPanel.tsx:328`,
  `DataPanel.tsx:185`, `AssignmentPanel.tsx:155`, `creation/Publishing.tsx:166`.
- `TypeToConfirm` for irreversible data actions: `Adopting`, `Downloads`,
  `Popover`, `Me`, `Privacy`.
- **No confirmation call found in `screens/Bill.tsx` or `screens/Grades.tsx`.**
  Not read to confirm what those screens do; flagged P0-unverified (VD-007).

## 6. Family sharing

`screens/Family.tsx:138` states what is private and not offered ("Payment · off
in the pilot, shares nothing", line 300). `FamilyInvite.tsx:94` warns "Anything
shared can be copied"; line 140 lists "Times {name} opened what you shared" —
an access history. No shared `PermissionNotice` for sharing; sentences are
bespoke per screen, and it was **not verified** that every switch says what is
and is not shared. Design doc: `docs/CONSENT-SHARING-DESIGN.md`.

## 7. Sample and tenant branding

- `SampleMark.tsx` is a whole-app banner; the institutional build suppresses it
  and shows a permanent "Demo environment · Fictional data" bar
  (`InstitutionalPreviewBar.tsx`). Per-row Sample exists in `Where`/`ProvenanceChips`,
  not in `SourceBadge`.
- Tenant branding: `BRAND-PLATFORM.md:327` forbids restyling status, provenance,
  warning colour, AI labels, consent text, accessibility controls.
  `lib/governance/config-tiers.ts:64` says `brand.accent_color` "never overrides
  focus or error tokens". **No code enforces it and no consumer of
  `brand.accent_color` was found.** `--status-success`/`--status-info` alias
  `--app-accent`, so if a tenant accent is ever applied they would move with it.
  Status warn/error use `--app-warn`/`--app-error`, structurally separable.

## 8. Existing guards

`lib/source.test.ts` (labels equal DB constraint), `lib/unity.test.ts` (every
`StatusKey` has word, sentence, glyph; one wording per state),
`lib/factprovenance.test.ts` (glyph and word per origin, ≤2 cues, official needs
an authority), `lib/ops/clm018.test.ts` (claim proposed, not approved; surfaces
in `docs/CLM-018-SOURCE-LABEL-EVIDENCE.md` §3 render `SourceBadge`),
`decisionlabels.test.ts` (Degree/Grades/Registrar contain literal
`<SourceBadge label="student_entered|estimated"`), `a11y/tellings.test.ts`
(nothing said only with shape or colour), `designcontracts.test.ts`.
**Not guarded:** every status/source uses the shared component; glyph + word
parity; `ConfirmDialog` structure; hand-rolled badges.

## 9. Recommended single source of truth

`lib/factprovenance.ts` already has origin word, glyph and fill, and
`OFFICIAL_WORD` is a one-line switch. Create one table keyed by the ten source
kinds (`{key, glyph, label, tone, meaning, dbLabel?}`); make `source.ts` text,
the provenance rows of `status.ts`, `SourceBadge` and `ProvenanceChips` read
from it, as `status.ts` already reads `where.ts`. **Leave `SOURCE_LABELS`
alone** (DB-tied). Add the missing statuses with an `announce` string and make
`StatusChip` render `role="status"`. Extend `decisionlabels`/`clm018`-style
tests to fail on new hand-rolled badges and on glyph/word drift. Make
`ActionPreview` (with `whoCanHelp`) the required body of `ConfirmDialog`.
Changing the visible word "Official" to "Institution verified" in `status.ts`
touches `unity.test.ts` and `decisionlabels.test.ts`; do it in the same change.
