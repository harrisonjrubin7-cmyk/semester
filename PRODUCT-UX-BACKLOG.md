# Product and UX backlog

| Priority | Persona / issue | Harm and evidence | Proposed change | Metric / acceptance criteria |
| --- | --- | --- | --- | --- |
| P1 | All institutional users — product can look “live” before operational gates are complete | Repository go/no-go register still has unmet production evidence | Show activation state and evidence freshness in admin surfaces; never translate repository capability into tenant approval | No tenant marked active without every required evidence item and named owner |
| P1 | Community participant — images can remain pending forever | Media scanner is documented but absent | Keep uploads disabled until scanner/deletion workers and status UI exist | Safe file reaches published state inside SLO; unsafe/failed file never renders; user sees retry/help state |
| P1 | Student/admin using source evidence — endpoint can be abused or made unreliable | No shared rate limit; broad `.edu` policy | Tenant-approved source hosts, clear unavailable/blocked states, shared quota | 429 is understandable; legitimate checks meet SLO; private/rebinding hosts always fail |
| P2 | Student — dense navigation across 93 routes | Many powerful tools compete with the next task | Make **Now / Today / This Week / Plan / Explore** the primary student IA; keep institution tools role-gated in Explore/workspaces | First useful action reachable in ≤2 interactions; task-completion study shows less route switching |
| P2 | Keyboard/screen-reader user — React/ref/effect warnings in overlay/call/sheet paths | Lint reports ref reads and effect-driven state across interactive surfaces | Remove warnings with behavior tests for focus return, dialog trapping, call teardown and sheet edits | Zero React warnings; keyboard scripts pass at 200% zoom and narrow width |
| P2 | Dyslexic or cognitively overloaded student — settings exist but density remains high | Accessibility tools are present; dense screens remain large | Optional readable type, line/paragraph spacing, reduced density, plain-language labels, reduced motion; preserve user choice | Settings persist, do not claim medical benefit, and pass reflow/contrast/keyboard tests |
| P2 | Mobile student — large editors and dialogs risk overflow | Sheet/Calendar/Write are multi-thousand-line interactive screens | Characterize 320px/400% reflow, sticky actions, internal dialog scrolling, 44px touch targets | No page-level horizontal scroll; all actions reachable by keyboard/touch |
| P2 | Student during provider outage | Multiple integrations have bespoke error states | Shared outage envelope: what failed, what was preserved, retry time, safe fallback | No data loss; retry is idempotent; errors do not expose internals |
| P3 | New student — first-run breadth can obscure one action | 93 routes and multiple workspaces | Onboarding asks for the smallest useful input, then lands on Now with one primary action | Course/task creation completion and time-to-first-plan improve |
| P3 | Privacy-conscious user — retention is comprehensive but difficult to understand | `RETENTION.md` is operator-oriented | Human-readable “what we keep and why” linked from export/delete; show pending requests and legal-hold exception plainly | Every personal data class maps to export/delete/retention owner; copy tested for comprehension |

## IA acceptance outline

- **Now:** one recommended action with provenance/confidence and dismiss/undo.
- **Today:** dated commitments, class context, recovery mode and support.
- **This Week:** workload/risk with source freshness and adjustable assumptions.
- **Plan:** calendar, courses, assignments, registration and long-horizon work.
- **Explore:** study modes, creation tools, community and role-appropriate institutional workspaces.

Power features remain available; progressive disclosure changes prominence, not capability.
