# Semester platform implementation plan

This maps the *Complete Platform Implementation Prompt* (twelve phases) onto
what the repository already has, and records what the Community Trust & Safety
slice in `app/src/community/` adds. The prompt's own rule is one secure vertical
slice per phase, each ending in a draft pull request. This document says which
slices already exist, so nobody rebuilds them.

## Where each phase stands

| Phase | Prompt scope | State on main before this change | This change |
| --- | --- | --- | --- |
| 0 Foundations | Architecture, threat and privacy model, RLS strategy, source model | ADRs 0001–0006 (`docs/architecture/`), RLS as the authorization boundary, `private.has_capability`, `RETENTION.md`, `SECURITY.md` | Community flag registry, privacy model, permission rules |
| 1 Today | Finite action centre, sources, freshness | `lib/today-decision.ts`, `TodayDecisionSurface.tsx` (#761), `lib/sources.ts`, `lib/refresh.ts` | — |
| 2 Path / Plan / Registration | Requirement map, scenarios, term plans, readiness | `lib/degree.ts`, `lib/whatif.ts`, `lib/graduation.ts`, `RegistrationDay.tsx`, `lib/registration.ts` (#762) | — |
| 3 Search / Advising / Campus hub | Permission-aware search, advising prep, directory | `lib/search.ts` (ADR 0006), `lib/campusdirectory.ts`, support access (#759–760) | Search exclusions for Community identity are in `identity.ts` (`FORBIDDEN_FIELDS`) |
| 4 Study Studio | Source-grounded assets, integrity | `lib/studystudio.ts`, `StudyStudio.tsx`, `lib/study.ts`, `lib/cite.ts` | — |
| 5 Multimedia | Audio/video, transcripts, captions | `audio/`, `video/`, `lib/captions`, `lib/episodes.ts` | Upload metadata stripping (`metadata.ts`) for Community media |
| 6 Integrations | Adapters, consent, sync state | `lib/connect.ts`, `connections` migration, LTI, institution gateway | — |
| **7 Community foundation** | Communities, memberships, finite explained feeds, sessions, block/mute/leave | **Absent** | `communities.ts`, `feed.ts`, `identity.ts`, `pii.ts`, `metadata.ts` |
| **8 Moderation core** | Reports, P0–P3, console logic, signals, audit, appeal | `reports` table + status audit only | `moderation.ts` |
| **9 Crisis / escalation** | Professional P0/P1, disabled escalation adapter | Absent | `crisis.ts` (escalation off by default, dual approval) |
| **10 Volunteers** | Eligibility, calibration, blind queues | Absent | `volunteer.ts` (flag off, production refused) |
| **11 Pseudonymity** | Community-scoped aliases | Absent | `alias.ts` (flag off, production refused) |
| 12 Adaptive / a11y hardening | Device matrix, keyboard, reflow | Existing a11y smoke (#754), style and label audits | — |

## What this change is, and is not

It **is** the domain layer for Phases 7–11: pure TypeScript with no I/O. It holds
every rule the prompt states as a number or a prohibition, and 153 tests check
them. Each prohibition has a test that was shown to go red when its guard was
reverted.

The database half followed in `supabase/migrations/20260928032000_community.sql`:

- **Tables:** communities, members, posts, restrictions, mutes, cases, reports,
  append-only case events, decisions, venues, sessions and session places.
- **Row-level security** through `private.has_capability`.
- **RPCs:** 17, one for every write. Each is on the `grants.check.sql`
  allowlist.
- **Checks:** `supabase/community.check.sql` walks 292 checks as the accounts
  concerned. Seven guards were shown to fail when reverted: author id hidden,
  appeal independence, high-risk hold, P0 needs a senior reviewer, reporter
  hidden, roster hidden, and the three-reporter threshold.

The screens followed too:

- **Community** (`screens/Community.tsx`): communities, a finite explained
  feed, the pre-post privacy check, reporting with the emergency notice
  first, block, mute, hide, study sessions at approved venues, and decision
  notices with appeal.
- **Moderation** (`screens/Moderation.tsx`): the professional queue and
  appeals.
- **Gating:** Community is registered in the nav only while
  `VITE_COMMUNITY_FEED` and `VITE_COMMUNITY_REPORTING` are on. The console is
  opened from Community, only by an account the server says is a reviewer.

Detectors and retention followed as well:

- **Detectors:** fifteen detector rules run on every post and edit on the
  server. Every hit is recorded with its rule, confidence, version, route and
  the human outcome. Only high-confidence doxxing holds a post.
- **Brigading:** new-joiner clusters and unfounded repeat reports are set
  aside, never used to punish the post's author.
- **Escalation and safety state in the database:** four tables and six
  functions, off at every school until the service role writes both a
  `community_programs` row and, for escalation, an agreement row. Escalation
  needs a P0/P1 case in a covered category and two different reviewers,
  compared by hash; the payload is assembled in SQL from an allowlist. Safety
  entries are written only by a professional's enforcement decision, reversed
  on a granted appeal and swept after a year; a reviewer reads the number
  only with a written reason, and the student gets words. 94 more checks.
- **Image posts, held until scanned** (`VITE_COMMUNITY_IMAGES`, high-risk,
  plus the `image_posts` switch): a private bucket, one upload path per
  reserved row, metadata stripped on the device and checked again on the
  server, a known-abuse hash check that is required before anything clears,
  re-uploads of removed images caught by a perceptual hash, and reviewer
  holds. A known-abuse match can only be removed, is never shown, and is
  preserved from every deletion path. `docs/COMMUNITY-MEDIA-SAFETY.md`.
- **Retention:** a daily sweep, logged in `community_retention_runs`, removes
  expired evidence and never touches open cases.

It **is not** yet:

- **A deployed media scanner, or a known-abuse provider.** The scanner is
  written and tested (`supabase/functions/_shared/mediascan.ts`) and its job
  is parked. No provider is configured, so no image clears; the steps, and the
  legal sign-off they start with, are in `docs/COMMUNITY-MEDIA-SAFETY.md`.
- **A slur lexicon.** The hate rules are phrase patterns. A tenant's lexicon
  would be new rows in `community_detector_rules`.
- **A deployed escalation adapter.** The adapter is written and tested
  (`supabase/functions/_shared/escalation.ts`) and its job is scheduled,
  parked. It is not a function directory, because here a directory is a
  deployed function, and deploying it waits for a signed agreement.
  `docs/CAMPUS-ESCALATION-POLICY.md` has the steps.
- **Contract review in the app.** The Agreements screen records a
  reference to the signed agreement; the document itself lives outside
  Semester, and the person activating is asked what they checked against it.
- **A notice to the student that their alias was looked behind.** Deliberately
  not sent at the time: during a safety investigation it could tip off the
  person being investigated. They were told, when they chose an alias, that
  staff can check.

The moderation console's escalation and safety-state parts are built. On a
P0 or P1 case, "Escalate to the university" lists exactly what would be sent
before anyone asks; a waiting escalation is decided by a different reviewer,
and the console says so to whoever asked instead of offering buttons the
server would refuse. "Author's safety state" reads the number once, with a
reason the case history keeps. A student sees one sentence about their
standing in Community, never the number. Each part appears only when its
build flag and the case's school's `community_programs` switch are both on.

The alias panel and "Post as …" toggle (Community) and the Volunteering screen
(opened from Community) are built. Each appears only when its build flag, the
school's `community_programs` switch and, for aliases, the community's
approval all allow it.
- **Checked against Postgres 17.** The container has 16, so `check.sh` ran
  with `SEMESTER_CHECK_PG_ANY=1`.

Nothing is deployed, and no flag is on by default.

## Design basis: what Semester takes and refuses from Jodel and Yik Yak

| Mechanism | Yik Yak | Jodel | Semester |
| --- | --- | --- | --- |
| Feed scope | GPS radius. Reports vary: about 1.5, 5 or 10 miles | Hyperlocal | Affiliation and purpose. No location input (`FORBIDDEN_SIGNALS`) |
| Removal | Crowd votes. Historically about −5 hid a post | Several moderators must agree | Humans only. Reports triage and never remove (`triage`, `decide`) |
| Karma | None platform-wide | Public, with a reported −100 on a blocked post | None. Optional private 0–100 staff-only state (`safety-state.ts`) |
| Volunteer eligibility | — | Karma plus behaviour | Verification, 30 days, training, NDA, recusal, calibration. No karma |
| Volunteer accuracy | — | Last 20 control tasks at 5% each | Same, with active at ≥85 and paused below 75 |
| Reporter's vote | — | Does not count | Reporter recuses (`mustRecuse`); blind view hides the reporter |
| Brigading | Votes can be brigaded | — | Clustered reports are set aside for integrity review and never punish the target |

Published figures for both apps changed over versions and regions. No
threshold here depends on any one of them being exact.
