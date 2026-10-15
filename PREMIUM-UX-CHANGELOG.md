# Premium UX changelog

## 2 October 2026 — full-site responsive and accessibility pass

### Improved

- Audited the complete screen union, route registry, navigation model, shared
  frames and states, institutional boundaries, and company site against a
  common UX and responsive contract.
- Verified 21 representative application routes at 320, 375, and 430 CSS pixels
  with no page-level horizontal overflow and with one main content region.
- Verified the company site across compact, tablet, laptop, and large-desktop
  widths while preserving its existing Semester visual system and truthful
  private-beta/proposal/demo disclosures.
- Added maintainable design-system and responsive-contract documentation for
  future screens and refactors.

### Fixed

- Search now supplies “Search” as its browser/assistive-technology document
  title instead of inheriting “Today.”
- App Directory now supplies “All apps,” and onboarding supplies “Welcome.”
  These shell-owned pages keep their own visible H1 and do not gain a duplicate
  visual header.
- The company site no longer allows a local mobile tab scroller to extend the
  root document at 320px.
- Three embedded product screenshots declare their 800×1024 intrinsic size,
  reserving layout space before decoding.

### Preserved intentionally

- Five canonical destinations and seven task-language directory areas.
- The near-black/graphite, silver, brass, course-accent, typography, spacing,
  corner, and elevation system.
- Student-controlled local-first workflows and explicit source/provenance labels.
- Permission-gated and unavailable institutional states; no approval, credential,
  activation, or official-operation claim was inferred.
- Specialized frames for conversations, editors, quizzes, maps, and focused
  sessions where a generic page frame would reduce usability.
- Tested 24px AA exceptions for dense composite grips; primary touch targets and
  expanded hit areas remain 44px.

### Validation

See `UX-RESPONSIVE-AUDIT.md` for evidence and limitations, and
`RESPONSIVE-CONTRACTS.md` for the ongoing verification matrix. Final command,
browser, and security-scan outcomes are recorded in the handoff for this change.

### Remaining work

- Manual student screen-reader and usability sessions.
- Small, behavior-tested reductions of the remaining React compiler warnings.
- Cold-load profiling before any further production chunk changes.
- Institutional approval, credentials, activation, and staffed operations remain
  external to this repository change.
