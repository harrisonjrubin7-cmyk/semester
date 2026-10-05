# Adaptive Today dashboard backlog

**Status: `IN PROGRESS`** — added 25 September 2026 from the approved
Today-dashboard briefs. Stages 1–3 are implemented locally; later stages and
the notification backlog remain product requirements, not release claims.

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

- [x] Path status and provenance
- [x] One next-best action
- [x] Immediate commitments across the next 24–72 hours
- [ ] Recent momentum
- [ ] Relevant resources, people and future choices
- [ ] Lower-priority notifications and recently viewed items only on demand

## Approved implementation order

1. [x] Mobile Path Snapshot
2. [x] Mobile Next Best Step card
3. [x] Mobile Today timeline
4. [ ] My Path drill-in screen
5. [ ] Desktop Path Overview
6. [ ] Desktop Upcoming context rail
7. [ ] Desktop Plan Health module
8. [ ] Global search and direct-action command palette
9. [ ] Scenario comparison
10. [ ] Personalized future and career discovery

## Compact layout requirements

- [x] Under 600 px, show a calm single-column briefing.
- [ ] Use five stable top-level destinations: Today, My Path, Search, Plan and
  Me, mapped onto the existing routes and navigation contracts.
- [ ] Keep the greeting compact and subordinate to useful information.
- [x] Show a Path Snapshot with status, credits, percentage, unresolved choice
  count and a direct My Path action.
- [ ] Show exactly one primary next action, with Why, snooze and dismiss paths.
- [x] Limit the timeline to the next 24–72 hours and link to the full plan.
- [ ] Show at most two adaptive This Week cards.
- [ ] Keep career/future discovery below immediate academic needs.
- [ ] Drill from summary to exact requirement, focused flow and full detail
  instead of expanding a data wall in place.
- [ ] Support complete, snooze and hide without requiring swipe or long press.

## Mobile briefing refinements

The compact experience is a 5–15 second academic briefing, not a miniature
desktop or another activity feed. Its exact order is:

1. [ ] Compact greeting and full date.
2. [x] Honest Your Path snapshot with one attention signal.
3. [x] One explainable Next Best Step.
4. [x] Immediate commitments, with four or fewer visible rows.
5. [ ] A compact quick-action row for Search, Build plan, Add course, Schedule
   and advising preparation, mapped to existing routes.
6. [ ] No more than two adaptive This Week widgets, chosen from plan health,
   registration readiness, advising, schedule conflict and contextual support.

- [ ] Open recommendation reasoning in a focused sheet or dedicated compact
  view that names inputs, logic, caveat, source and last successful sync.
- [ ] Let students complete, snooze, hide and open an exact commitment with
  visible controls; swipe and long-press may enhance but never gate an action.
- [ ] Keep future/career discovery below immediate academic needs.
- [x] Never invent a graduation target, institutional credit denominator or
  verified status when the current record does not provide one.

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

## Side-by-side planning requirements

- [ ] Requirement and course-options view: keep the selected requirement in
  context while browsing qualifying choices and their source confidence.
- [ ] Schedule and workload view: show the week beside credit load, conflicts,
  open study blocks and the consequences of a proposed addition.
- [ ] Current-plan and proposed-scenario view: compare graduation assumptions,
  credits, requirements and conflicts before a student explicitly saves.
- [ ] Advisor-meeting mode: pair the shared plan with an agenda, open questions
  and accessible mark-discussed/add-note controls.
- [ ] Preserve selection when panes, widths or views change.
- [ ] Highlight consequences before saving and never overwrite the current plan
  automatically.
- [ ] Give every scenario an explicit Draft, Current, Shared or Archived state.
- [ ] Provide non-drag actions such as Move to Fall, Add to plan, Remove and
  Compare.

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
- [x] Incomplete data: request completed credits and current courses before
  estimating a path.
- [ ] Active plan: explain that the entered plan aligns with the stated target
  and name the next unresolved choice.
- [ ] Potential conflict: explain the decision and its possible timeline effect
  without claiming certainty.
- [ ] Offline, stale and disconnected states: retain useful device data, label
  source status and expose the last successful sync time.

## Immediate commitments and ranking

- [ ] Rank 0–14 day commitments by time sensitivity, student relevance,
  required action and source confidence; low-confidence generic content must
  not outrank a verified actionable event.
- [ ] Support contextual variants for registration readiness, advising week,
  verified deadlines, schedule conflicts, plan health, academic milestones,
  saved-item follow-up and opted-in personal commitments.
- [ ] Do not duplicate the LMS, calendar or task manager. Exclude raw activity
  counts, login warnings, generic motivation, leaderboards, risk labels, long
  announcements and competing countdowns.

## Notification system backlog

- [ ] Use three layers: contextual in-app notices, opt-in push only when delay
  reduces value, and email for summaries, receipts, account events and selected
  reminders.
- [ ] Group the notification center by purpose: Needs attention, Upcoming,
  Updates, Completed and Earlier. Collapse repeated reminders for one event.
- [ ] MVP categories are registration milestones, advisor meetings, schedule
  conflicts and student-saved deadlines.
- [ ] Every alert deep-links to the exact item and is actionable, explainable,
  configurable, dismissible and snoozable.
- [ ] Ask for push permission only in context after the student saves a
  deadline, meeting or plan; show a dismissible value explanation first.
- [ ] Let students choose category, channel, frequency, quiet hours, eligible
  data sources and whether recommendations may trigger reminders.
- [ ] Enforce per-event and per-category frequency caps and avoid guilt-based
  re-engagement messages.
- [ ] Announce non-blocking results with polite status semantics; reserve
  assertive alerts for urgent blocking errors or possible data loss.

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
- [x] Empty and error states name a concrete next step.

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
