# Frontend usability review — 1 October 2026

## Scope and evidence

Follow-up to the calm, unified-interface release, prompted by the Accessibility
panel visibly extending behind the workspace sidebar. This is a frontend
implementation and visual review, not authorization to activate institutional
services or replace the backend. The existing React/Vite, Supabase, route tree,
navigation choices and student-controlled workflows are retained.

The source inventory contains 96 screen components plus onboarding. All 97
routes below were opened in the isolated local preview at actual browser
viewports of approximately 1297 × 811 and 391 × 847 CSS pixels. Screenshots and
DOM measurements covered screen tops and lower sections where scrollable.
Contact sheets were visually inspected, not merely counted. Targeted additional
checks cover 1024px tablet mail/compose and 320px Accessibility with Large text
and More space. Workspace navigation was the primary shell because it reproduces
the reported clipping. Existing shared-menu behavior tests cover other callers.

Local screenshot evidence is kept in the ignored `.ui-review/` directory. It is
not a public upload of the user's screenshots or academic information.

## Findings and implemented changes

| Priority | Finding | Correction |
| --- | --- | --- |
| P1 | Accessibility panel's left edge was about 125px behind the clipped workspace sidebar. Decision Trail used the same positioning pattern. | Reuse the existing portaled Popover shell through one ToolDisclosure adapter. Measure actual size, clamp both axes, react to lazy content growth and window resize. |
| P1 | Expanded tools lacked predictable closing and focus return. | Explicit close control, Escape, outside-pointer dismissal, opener toggle and focus restoration. Closed stateful tools remain mounted but hidden and inactive. |
| P1 | Compact header shortcuts squeezed the search input to about 31px at 320px with larger text. | Give compact search its own row, retain shortcuts in the toolbar, shorten the responsive prompt without changing its accessible name or suggestion behavior. |
| P2 | Native select chrome and workflow controls differed from the app's visual system. | Theme existing native selects with shared tokens; retain native keyboard behavior and forced-color rendering. Wrap context actions and abbreviate the duplicated workflow trail label. |
| P2 | Accessibility actions looked like a block of unrelated text links. | Group preferences, label toggle states visibly On/Off, separate audio actions, disable Stop when there is no active narration, retain all settings access. |
| P2 | Sign-in placeholders disappeared during entry; a disabled submit did not explain missing prerequisites. | Persistent visible labels, password guidance, explicit readiness explanation, wrapping providers and links, long account-identity wrapping. Auth rules and account-service boundaries unchanged. |
| P2 | Guide preferences and import-review controls had inconsistent field grouping and reading rhythm. | Shared token-based form spacing, labelled field grids, touch-sized preference labels and responsive review corrections. |
| P2 | Fixed-height shared actions could cut off long or enlarged labels. | Minimum target height with expandable content and padding for ActionButton, EmptyState and credential submission. |
| P2 | The daily briefing stayed above Hours, This week and Done, making the tabs look unchanged and burying their content. | Hide the briefing outside Today without unmounting its state. Retain it in Focus View, where the tab switcher is intentionally hidden. |
| P2 | The concise visible Steps trigger was absent from its accessible name. | Separate trigger and dialog names, include the visible label and step count for voice control; add a label-in-name guard. |
| P2 | Quick Add's save-for-later action used unthemed native chrome, and its close/dictation controls had small hit areas. | Reuse ActionButton for the quiet capture action and the app's minimum-height targets for closing/dictation. Parsing and confirmation behavior unchanged. |
| P2 | New responsive tests were not registered in the width-parity and mock-isolation inventories. | Add exact evidence entries and test registration; keep the guards intact. |
| P3 | Dead-CSS guard repeatedly searched a 27.7MB source corpus and exceeded its 10-second cap. | Preserve substring semantics with a collective token/trie search. Add overlap/fallback equivalence controls; do not increase the timeout or exempt selectors. Focused run: 1.89 seconds for the main guard. |

## Audit categories

- Accessibility: keyboard dismissal/focus and labelled controls checked; Larger
  text and More space exercised. This is not a screen-reader certification or a
  completed 200–400% zoom/assistive-technology protocol.
- Responsive design: desktop, phone, targeted tablet and 320px tools checked.
  Horizontal tab strips, template galleries and map tiles are intentional
  clipped/scrollable surfaces, not page overflow findings.
- Theming: existing near-black/silver identity, type scale, borders, spacing and
  target tokens reused. No new brand identity, generated kit or parallel UI
  framework introduced.
- Performance: existing production bundle budgets retained; no animation or
  graphics package added for this polish.
- Anti-patterns/usability: preserve progressive disclosure, clear source status,
  one navigation system and explicit student control. No hidden automation,
  surveillance, risk inference or institution-verified claims added.

## Complete route inventory

```text
home search directory university athletics nil career family pathway launchpad
hub support opportunities create privacy data help courses course item calendar
event me profile notifs settings setLook setNav setAlerts setCourses setGrading
setWorkload setAbout setAssistant mine note import study guide drill guess quiz
lesson update connect links ask work maps mail export yes draw solve edit analyse
classmates community moderation console volunteer agreements volunteers activities
clocks proof applying behind degree meet people brief essay deck write sheet
equations exam announce costs gap groupwork call meals dining housing runway
registrar registration gradebook sources account slides activity whatsnew recovery
onboarding
```

## Verification and boundaries

New guards were observed failing against the previous behavior before their fixes
were restored: panel containment/closing, resize clamping, visible credentials
and responsive search. Exact locked dependencies are used. Type, lint, label,
style, university-server and production-build gates run separately from browser
review; the full and shuffled suites are release gates. Independent Standards
and Spec reviews were performed separately. The Standards label-in-name finding
was corrected; its optional heading-level recommendation was also implemented.
The Spec review found no actionable requirement or scope regression.

Authenticated Classmates, operator console, official gradebook/enrollment,
institutional approval and third-party integrations were reviewed in their real
unconfigured/gated states, not bypassed or fabricated. Credential behavior has
component-test coverage; no real account was created or password entered during
this review. Additional interaction checks cover tablet mail composition,
Guide preferences, blank document/sheet/deck editors, phone editor menus,
Today tabs and shared tool/launcher overlays. Blank drafts were local preview
test artifacts; no email or document was sent. A route visit is not proof of every
possible data, permission, error or integration state.

HawkScan uses the repository's hosted workflow because this local environment
has neither its runtime nor key. JavaScript crawling is enabled additively for
the frontend. A successful frontend scan is not a backend security certification;
signed-in API coverage and URI-level completeness must not be inferred from a
green workflow alone.
