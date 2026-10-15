# Semester UX and responsive audit

Date: 2 October 2026
Scope: student app, institutional surfaces, and `company-site/index.html`

## Outcome

Semester's current foundation is sound and should remain the foundation. The
application has one responsive shell, five canonical destinations, seven
task-language areas, an exhaustive route union, route governance, lazy screen
modules, shared page/state primitives, and explicit provenance. This pass did
not find a P0 navigation, data-loss, or reflow failure. It found and corrected
two cross-surface P1 defects: shell-owned routes announced the document title
“Today,” and the company site could extend the root canvas by 13px at the
smallest supported width. It also reserved intrinsic image space on the company
site to reduce layout shift.

This is repository and local-runtime evidence. It does not establish university
approval, configured credentials, production activation, or observed
institutional operation.

## Method and evidence

- Reconciled the `Screen` union, lazy screen registry, navigation registries,
  route governance, shared frames, state primitives, tokens, and company site.
- Ran the source census: 96 routed screens from 90 modules, with onboarding as
  the first-run surface. The census classified 29 system-ready, 55 targeted
  migration, and 12 specialized/redesign-before-expansion surfaces.
- Exercised 21 representative app routes at 320, 375, and 430 CSS pixels:
  `home`, `calendar`, `courses`, `gradebook`, `study`, `write`, `career`,
  `pathway`, `mine`, `sheet`, `university`, `connect`, `import`, `account`,
  `profile`, `help`, `support`, `community`, `directory`, `maps`, and `costs`.
  Each rendered one `main`, no page-level horizontal overflow, and a usable
  heading after asynchronous content settled.
- Exercised the company site at 320, 375, 430, 768, 1024, 1280, and 1440 CSS
  pixels. Its navigation, visible page heading, controls, copy disclosures, and
  local tab scrollers remained operable. The 320px root overflow was corrected
  while retaining local horizontal tab scrolling.
- Reviewed focus handling, reduced motion, forced colors, labels, target-size
  tests, loading/empty/error/permission states, and source/trust labels.
- Did not replace guarded institutional states with fabricated success states.

Limits: the route sample used populated local/demo data. Automated checks and
browser accessibility trees complement, but do not replace, a manual screen
reader session with students or an institutional accessibility review.

## Information architecture

The five canonical destinations remain the stable product spine:

1. **Today** — the next safe action.
2. **My Path** — the academic path beyond the current task.
3. **Search** — trusted discovery across the product.
4. **Plan** — dated commitments and scheduling.
5. **Me** — progress, work, privacy, connections, and controls.

The seven task-language areas—Today, Plan, Learn, Help, Campus, Progress, and
You—are a useful directory layer, not seven competing global tabs. Specialized
tools remain contextual children. This avoids turning the roughly one hundred
routes into one hundred peers.

## Screen inventory and disposition

Every `Screen` route is accounted for below. “Profile” refers to the responsive
contract in `RESPONSIVE-CONTRACTS.md`; the recommendation applies to the whole
row unless a route is called out later.

| Product category | Routes | Profile | Recommendation |
| --- | --- | --- | --- |
| Core daily workflow | `home`, `gap`, `notifs`, `hub`, `mine`, `note`, `activity`, `whatsnew`, `recovery` | hub/list or detail | Keep the next action first; disclose history and recovery after the current state. |
| Academic planning/workflow | `calendar`, `event`, `courses`, `course`, `item`, `import`, `edit`, `sources`, `registrar`, `registration`, `gradebook`, `degree`, `runway`, `pathway`, `applying`, `launchpad`, `career`, `opportunities`, `costs`, `yes` | hub/list, detail, or data-dense | Preserve official-system boundaries and source dates; collapse supporting columns before actions. |
| Academic learning and creation | `study`, `guide`, `quiz`, `drill`, `guess`, `lesson`, `update`, `ask`, `analyse`, `solve`, `exam`, `work`, `clocks`, `groupwork`, `draw`, `deck`, `slides`, `write`, `essay`, `sheet`, `equations`, `proof`, `brief`, `create` | editor/tool or focused session | Consolidate discovery through Study/Create; keep specialist workspaces focused and autosave-visible. |
| Communication/community | `classmates`, `community`, `mail`, `call`, `meet`, `people`, `family`, `volunteers`, `volunteer`, `agreements` | list/detail or conversation | Keep identity, audience, unread boundary, and send/share consequences explicit. |
| Campus and student life | `maps`, `links`, `university`, `activities`, `meals`, `dining`, `housing`, `athletics`, `nil` | hub/list or institutional | Prefer directions and official handoff; never imply access where an adapter is unavailable. |
| Utility/tool | `search`, `directory`, `help`, `behind`, `support`, `data`, `export`, `onboarding` | shell, import, or reference | Use one obvious field/action, one visible heading, and an escape back to the canonical destination. |
| Settings/account/trust | `me`, `profile`, `account`, `settings`, `connect`, `privacy`, `setLook`, `setNav`, `setAlerts`, `setCourses`, `setGrading`, `setWorkload`, `setAbout`, `setAssistant` | settings/detail | Explain scope, storage, reversibility, and destructive consequences beside the control. |
| Specialized/internal/low-frequency | `moderation`, `console` | institutional console | Retain role/tenant/capability checks, audit trail, and fail-closed empty/permission states. |

### Major-screen audit

| Screen | User goal | Primary / secondary actions | Compact / medium / wide behavior | Accessibility and state risks | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Today | Know what matters now | Complete next item / inspect the week | One feed; tabs lead their content / two-column breathing room / supporting rail may appear | Date semantics, tab order, stale/offline context | One H1; selected tab announced; current action precedes “More”; no 320px overflow. |
| Plan | See and change commitments | Add/schedule / filter or inspect | Agenda first / split agenda-detail / calendar plus detail | Dense dates, drag alternatives, moved-source provenance | All changes keyboard-operable; source and moved date preserved; tables locally scroll. |
| Courses | Find course work and record | Open course / switch Due or Grades | List/card / split list-detail / denser comparison | Official-grade ambiguity, long titles | Grade-of-record boundary visible; truncation never hides the only action. |
| Study | Start an effective session | Start recommended mode / choose specialist mode | Mode picker folds / two-pane selection / persistent context rail | Time pressure, quiz feedback, motion | Prompt and answer relationship announced; progress survives reflow and reduced motion. |
| Search | Find a trusted answer | Search / open All apps | Full-width field / bounded results / shortcut rail | Wrong document title, result focus, empty query | Document title is “Search”; one visible H1; result focus is deterministic. |
| All apps | Discover a capability | Open destination / change view/category | Single-column grouped list / category split / list or grid | Category semantics, lazy heading | Document title is “All apps”; one visible H1; all destinations keyboard reachable. |
| My Path | Understand progress over time | Review next step / inspect evidence | Stacked milestones / split summary-detail / comparison rail | Estimates mistaken for records | Estimates and official facts are labeled; recommended next action has rationale. |
| Me / Settings | Control personal state | Review or change / export/recover | Stacked sections / two-pane settings / persistent subnav | privacy, credentials, destructive controls | Persistent labels; secrets not echoed; recovery and scope precede destructive actions. |
| University | Reach the right official service | Open verified route / inspect capability | Service list / grouped services / status matrix | implied integrations, permission denial | Unavailable is explicit; official handoff works; no repository state is presented as approval. |
| Company site | Understand product and request access | Explore product / request invite | Menu + stacked story / split story / full nav and proof | hidden SPA pages, claims, overflow, CLS | Exactly one visible H1; no root overflow at supported widths; beta/pricing/demo disclosures remain truthful. |

## Findings by priority

### P0

No reproducible P0 remained in this pass.

### P1 — corrected

1. **Incorrect shell document titles.** Search, All apps, and onboarding owned
   their visible headings but inherited the fallback “Today” title. They now
   have explicit document-title metadata without adding duplicate visual
   headers.
2. **Company-site minimum-width containment.** At a 320px outer viewport, a
   locally scrollable product tab row could extend the root canvas by 13px. The
   document now clips only root-level horizontal escape while the tab row keeps
   its own horizontal scrolling.
3. **Company-site layout stability.** Three embedded product screenshots now
   declare their 800×1024 intrinsic dimensions.

### P2 — maintain as measured work

1. Migrate the 55 targeted screens toward shared frames only where that reduces
   cognitive load or duplicated behavior. Specialized editors and sessions are
   not defects merely because they are frameless.
2. Reduce the remaining React compiler warnings in small, behavior-covered
   groups. Do not suppress event-time or mutable-ref warnings globally.
3. Profile the largest production chunks on a cold mobile load before changing
   split points; heavy tools are already lazy.
4. Run moderated keyboard and screen-reader sessions for Today, Search, Plan,
   Study, registration/gradebook boundaries, privacy/export, and recovery.

### P3

- Decorative motion and extra elevation remain deferred. Calm hierarchy,
  reliable state, and source clarity have higher value for this product.

## Release acceptance checklist

- TypeScript, institutional boundary, lint/policy, tests, and production build pass.
- Representative 320/375/430px app routes have no page-level horizontal overflow.
- Tablet and desktop retain readable line lengths and do not strand actions.
- One visible H1 and one `main` exist per active route.
- Loading, empty, error, offline, permission, stale, and success states use shared patterns.
- Focus is visible and restored after dialogs/sheets; reduced motion is honored.
- Company-site claims remain private-beta/proposal/demo-qualified.
- Security scanning passes in an environment with the Hawk runtime and API key.
