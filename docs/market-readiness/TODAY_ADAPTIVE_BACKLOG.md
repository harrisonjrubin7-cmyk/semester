# Adaptive Today dashboard backlog

**Status: `QUEUED`** — added 25 September 2026 from the approved Today-dashboard
brief. This is a product requirement, not a claim about the current build.

## Outcome

Today becomes a daily decision surface with one shared priority model and two
different jobs by available width:

- compact layouts provide awareness and one immediate action;
- expanded layouts provide planning, comparison and persistent context.

In one glance a student should understand their progress. In one action they
should know what to do next.

## Non-negotiable product constraints

- Preserve the current Semester visual language, routes, stored data and broad
  capability set. Build this around the existing app rather than replacing it
  with a separate portal.
- Use one underlying status, recommendation and timeline model across widths.
  Responsive layouts may disclose different amounts, but must not disagree.
- Order the information as status, next step, time, momentum and context.
- Do not put every available metric on Today. Detail remains available through
  the existing screens and searchable capability directory.
- Use only three student-facing path states: moving forward, review recommended
  and plan incomplete. Never label a student at risk, failing or behind here.
- Qualify every timeline claim when data is student-entered, incomplete,
  synthetic, stale or not institution-authorized.
- Every recommendation must be specific, actionable, explainable, dismissible
  or snoozable, non-punitive and linked to its source.
- Drag and drop may be an enhancement, never the only way to plan.
- Role exposure must remain deliberate: student planning belongs on student
  Today; staff, applicant, family and alumni roles should receive only their
  applicable home content rather than student-only cards.

## Shared priority model

- [ ] Path status and provenance
- [ ] One next-best action
- [ ] Immediate commitments across the next 24–72 hours
- [ ] Recent momentum
- [ ] Relevant resources, people and future choices
- [ ] Lower-priority notifications and recently viewed items only on demand

## Approved implementation order

1. [ ] Mobile Path Snapshot
2. [ ] Mobile Next Best Step card
3. [ ] Mobile Today timeline
4. [ ] My Path drill-in screen
5. [ ] Desktop Path Overview
6. [ ] Desktop Upcoming context rail
7. [ ] Desktop Plan Health module
8. [ ] Global search and direct-action command palette
9. [ ] Scenario comparison
10. [ ] Personalized future and career discovery

## Compact layout requirements

- [ ] Under 600 px, show a calm single-column briefing.
- [ ] Use five stable top-level destinations: Today, My Path, Search, Plan and
  Me, mapped onto the existing routes and navigation contracts.
- [ ] Keep the greeting compact and subordinate to useful information.
- [ ] Show a Path Snapshot with status, credits, percentage, unresolved choice
  count and a direct My Path action.
- [ ] Show exactly one primary next action, with Why, snooze and dismiss paths.
- [ ] Limit the timeline to the next 24–72 hours and link to the full plan.
- [ ] Show at most two adaptive This Week cards.
- [ ] Keep career/future discovery below immediate academic needs.
- [ ] Drill from summary to exact requirement, focused flow and full detail
  instead of expanding a data wall in place.
- [ ] Support complete, snooze and hide without requiring swipe or long press.

## Expanded layout requirements

- [ ] At 840 px and above, compose a navigation zone, flexible planning
  workspace and 280–340 px upcoming/context rail without duplicating content.
- [ ] Keep global search visible and support both discovery queries and direct
  actions.
- [ ] Expand Path Snapshot into category-level Path Overview with My Path and
  Compare Scenarios actions.
- [ ] Add at most two secondary recommendations beneath the single primary
  next step.
- [ ] Add Plan Health for load, conflicts, prerequisites and unmapped
  requirements, each linking to the exact item needing attention.
- [ ] Use the right rail only for time-sensitive events, deadlines, milestones
  and preparation actions.
- [ ] Show momentum and future context without displacing status or next step.
- [ ] Provide keyboard-operable alternatives for course movement, pinning,
  comparison and sharing.

## Responsive states

- [ ] Compact phone under 600 px: bottom navigation, one column, one primary
  action and detail in a sheet or dedicated screen.
- [ ] Medium 600–839 px: bottom navigation or rail, main pane and optional
  contextual drawer.
- [ ] Expanded 840–1239 px: navigation rail, main workspace and right context
  rail.
- [ ] Large 1240 px and above: full navigation drawer, planning workspace and
  context rail.
- [ ] Reflow at dynamic text sizes without clipped text, horizontal scrolling
  or hidden actions.

## Required content states

- [ ] New student: invite program and graduation-goal setup; do not show 0% or
  empty widgets.
- [ ] Incomplete data: request completed credits and current courses before
  estimating a path.
- [ ] Active plan: explain that the entered plan aligns with the stated target
  and name the next unresolved choice.
- [ ] Potential conflict: explain the decision and its possible timeline effect
  without claiming certainty.
- [ ] Offline, stale and disconnected states: retain useful device data, label
  source status and expose the last successful sync time.

## Trust and accessibility acceptance gates

- [ ] Text accompanies every meaningful icon and color is never the only status
  signal.
- [ ] Credit progress has a screen-reader name such as “84 of 120 credits
  complete, 70 percent.”
- [ ] Cards, tabs, chips, search, disclosures and all alternative planning
  controls work by keyboard and screen reader.
- [ ] Touch targets pass the project target-size sweep at compact widths.
- [ ] No auto-advancing content or motion that hides important status.
- [ ] Why explanations name the source, logic, caveat and last-sync state.
- [ ] Students can correct, hide or report inaccurate personal-plan data.
- [ ] Empty and error states name a concrete next step.

## Repository anchors to preserve

- `app/src/screens/Today.tsx` currently owns the existing Today variants and
  their mature deadline, task, calendar, workload and recovery behavior.
- `app/src/lib/chrome.ts` is the current navigation-to-home-shape contract.
- `app/src/components/institutional/FlightPlanHome.tsx` provides an existing
  next-decision slice; its synthetic status must remain visibly synthetic.
- Existing Calendar, Degree/My Path, Search, Study, Career, support and role
  routes remain the detailed destinations rather than being duplicated inside
  Today.

## Definition of done

This backlog is complete only when the shared priority model is deterministic,
every approved stage above is implemented, all four width classes and content
states are browser-verified, role applicability is proven, accessibility and
production gates pass, and the released build lets a student answer:

1. Am I on track, based on what source and caveat?
2. What matters now?
3. What should I do next?

Reference guidance supplied with the brief:
[Material adaptive layouts](https://m3.material.io/foundations/layout/breakpoints),
[Material navigation bar](https://m3.material.io/components/navigation-bar/overview),
and [Nielsen Norman Group progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
