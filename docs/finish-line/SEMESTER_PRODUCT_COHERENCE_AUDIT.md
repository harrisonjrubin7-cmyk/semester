# Semester product coherence audit

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05, `origin/main` `790ebbf` |
| **Owner** | Harrison Rubin |
| **Method** | Static read of `app/src` by an audit agent; spot counts by script. Nothing here was executed in a browser. Tag `static`. |
| **Changes made** | None. This document flags and orders repairs; it repairs nothing. |

## Required chain

Every user-facing feature must connect to:

Identity → Path → Action Center → Search → Support → Policy → Source authority
→ Audit where sensitive → Outcome.

## Headline

1. **There is one app.** Role changes language and hides 12 student-only
   screens (`lib/role.ts` `STUDENT_ONLY`). No role has its own home. This matches
   `docs/screenshots/README.md`, which pixel-diffed all 10 roles.
2. **Faculty, advisor, admin, staff, payer, family, alumni and operator
   surfaces are not routes.** They are tabs inside the `university` screen and
   need a flag and a verified grant, which no preview supplies. They are
   invisible in a plain build, so no reviewer can see them without setup.
3. **Source and authority labels reach about 25 of 96 screens** (import closure
   to depth 2). Nothing is labelled "official" because the production adapter
   registry is empty.
4. **Status documents contradict each other.** `docs/PRODUCT-STATUS-MAP.md`
   says 60 of 60 capabilities verified; `docs/FEATURE-TRUTH-TABLE.md` has 16
   LIVE, 15 IMPLEMENTED_NOT_RELEASED, 30 PARTIAL, 11 PLANNED, 2 MOCK_DEMO,
   2 BLOCKED; `docs/ROLE-LAUNCH-REGISTER.md` has 0 of 69 roles launch-approved.

## Surface inventory (static)

| Item | Count | Guard |
| --- | --- | --- |
| `Screen` union members | 97 | `lib/nav.registry.test.ts` |
| Routable components in `SCREENS` | 95 plus `home`, `onboarding` | type error if an id is missing |
| Registered destinations | 63 (64 with community flags) | `lib/nav.ts`, tests |
| Nested screens | 27 | `lib/nav.ts` |
| Canonical destinations | Today, My Path, Search, Plan, Me | `oneos.test.ts` |
| Roles in `lib/role.ts` | 10 | no `operator` role in this type |
| Test files in `app/src` | 1,340 (about 20,900 cases by grep) | `npm test`, ran green |

`docs/ROUTE-AND-FEATURE-CROSSWALK.md` says 59 destinations at an old baseline
and is stale.

## Duplicates and disconnected objects

| Flag | Where | Status | Repair |
| --- | --- | --- | --- |
| Two Today engines | `domains/today` (shadow, `VITE_TODAY_SHADOW`, off) beside the legacy Action Center; explained-differences list is empty | duplicate, staged | Run the shadow, close differences, flip or delete |
| Today stacks six surfaces | `screens/Today.tsx` (~2,000 lines, two render paths): OperatingLauncher, TodayDecisionSurface, CommandCenter, JourneyCards, StartToday, OfficeActionFeed | untested as a whole | One composition with one empty and one error state |
| Four task models | `PersonalTask`, `domains/tasks` `Task` (flag off), sync-engine `TaskRow` (flag off), course `Item`; plus `flight-plan` `TaskAction` | duplicate, staged | Pick the authority; the adapter in `domains/tasks/adapters/legacy.ts` is the bridge |
| Three notification surfaces | Alerts (`Me`), Notices (`Hub`), Action Center rows; push separate | duplicate | One notification model and one inbox |
| Profile and identity | `Profile.tsx`, `AccountState`, `domains/identity`, several `Account` types | duplicate, mostly deliberate (pseudonymous community identity, money) | Document each as deliberate or merge |
| Role taxonomies | `Role` (10), `FlightRole` (12), `CommunityRole` (declared twice), `ViewerRole`, `PreviewRole`; 69 database roles | duplicate | One vocabulary mapped to capabilities |
| Search | One ranker (`lib/find.ts`); two minor matchers (`taskMatch`, `searchOpportunities`) | duplicate (minor) | Fold the minor two into the ranker |
| AI conversation | One store (`useConversation`), two presentations (`ask` route and floating panel); legacy `chatlog` thread read as migration source | duplicate (legacy) | Retire `chatlog` after migration window |

Not found: a second profile that is shown to the user as theirs, a second AI
history that the user can see as separate, a second onboarding for a module.

## Orphans and dead ends

| Finding | Detail |
| --- | --- |
| No nav entry points at a missing screen | Verified by script and `nav.registry.test.ts`, `mecontrols.test.ts` |
| Routed, not in the registry, reached from a parent | `search`, `directory`, `guess`, `gap`, `activity`, `whatsnew`, `recovery`, `moderation`, `agreements`, `volunteers`, `volunteer`, `dining`, `registration`, `gradebook` |
| True orphan | `console`: no `go('console')` anywhere; reached by address only, by design (`lib/nav.ts:1039`) |
| Community absent | Not in the registry unless both community flags are on; the moderation chain is reachable only through it |
| 15 dead-end screens | End in "isn't switched on in this build", "needs the account service" or an AI key: `classmates`, `console`, `moderation`, `volunteer`, `volunteers`, `agreements`, `groupwork`, `community`, `gradebook`, `registration`, `dining`, `mail`, `account`, `solve`, `draw`. Six are registered destinations (`classmates`, `groupwork`, `mail`, `account`, `solve`, `draw`), so the door is drawn. Source: `docs/screenshots/README.md`, not re-run |

## Authority labelling

- Components: `SourceBadge.tsx`, `unity/ProvenanceChips.tsx`, the "Source &
  details" drawer in `UnityLayer.tsx`.
- 25 of 96 screens reach one. The 71 that do not include institution-flavoured
  screens: `maps`, `meals`, `housing`, `support`, `mail`, `family`, `athletics`,
  `nil`, `connect`, `account`, `launchpad`, `costs`.
- "Report incorrect information" (`onReport`) is wired at 2 call sites.
- `docs/CLM-018-SOURCE-LABEL-EVIDENCE.md` itself says the all-facts claim is
  unsupported. Guard: `lib/ops/clm018.test.ts` fails if a listed surface stops
  using `SourceBadge`.

## Support handoff

- `ScreenGuide` renders on every screen (`ShellBody.tsx:120-135`) with `FixThis`
  (7 correction paths). Tested for one screen only.
- The ticket send is behind `supportTickets`, off by default.
- `humanHelp` is off by default, on in an institutional preview.
- Only 13 of 96 screens link directly to support or help.
- `docs/DEFINITION-OF-DONE.md` row 9: "Support has no address yet."

## Empty, loading and error states

Primitives are tested (`ReadState`, `States.tsx`, `ScreenTrouble` boundary,
lazy `LoadingState`). Placement is uneven: a regex sample finds 9 of 96 screen
files carrying empty, loading and error handling themselves (13 counting one
level of imports), and 48 with none of the three in their own file. Many are
static and legitimately need none. The sample is not a precise measure.

## Mobile and desktop parity

Guarded: `widthgate`, `mediumrail`, `chrome`, `tiers`, `breakpoints`,
`layoutdevice` and the style guards (`reach`, `taps`, `density`, `textscale`).
Not guarded: automated reflow at 320 px across all screens
(`docs/RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md` lists it "Not covered yet"). The
by-hand pass at 8 widths is a document, not a recorded run.

## Flag state

On by default: `journeyNavigation`, `today_action_center`. Off by default: every
other module flag (17 of 19), the 8 community flags, all 21 registry flags, and
the writeback flags at every school. 84 distinct `VITE_*` names exist; real
deployed values live in GitHub repository variables, which this audit could not
see. Deployed truth is therefore `needs human evidence`.

## Repair order

Ranked by effect on a pilot, then by size.

| # | Repair | Size | Closes |
| --- | --- | --- | --- |
| 1 | Make one non-student role reviewable in a plain build (a synthetic grant in a seeded preview) | M | Role surfaces invisible |
| 2 | Source-label the institution-flavoured screens and wire `onReport` on each | M | Authority gaps on 12+ screens |
| 3 | One Today composition; run the shadow and close or retire it | L | Duplicate engines; stacked surfaces |
| 4 | One task authority; retire two flagged models or ship one | L | Four task models |
| 5 | One notification model and inbox | M | Three surfaces |
| 6 | Reconcile the four contradicting status documents to the code | S | Stale and contradictory claims |
| 7 | Pull the six drawn-but-dead doors from the registry or switch them on | S | Dead ends |
| 8 | Turn on support intake in the pilot build with a real address | S + human | Support handoff |
| 9 | Per-screen empty/loading/error pass on the pilot path first | M | State coverage |
| 10 | One role vocabulary mapped to capabilities | M | Inconsistent permissions |

None of these is started. Nothing is repaired by this document.

## Acceptance for "coherent"

A role may be called coherent when, for that role: its screens are reachable in
a plain build; every institution fact shown carries a source label and a report
control; every item appears once in Today with the same owner and due date;
every screen has an error, empty and loading state; support is reachable in two
actions; and the whole chain has a recorded browser run per screen width.
Today no role meets it. Evidence goes in the [evidence register](SEMESTER_EVIDENCE_REGISTER.md).
