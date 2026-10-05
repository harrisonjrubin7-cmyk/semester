# Action explainability and student control

Part 2 of the expansion command. Phase 1b. **Waits for #767 and #768.**
Nothing here is built yet.

## What exists on main

- `app/src/lib/today-decision.ts` `nextTodayDecision()` returns one decision
  with a `why` and a `source`, rendered by
  `app/src/components/TodayDecisionSurface.tsx`. Its dismissal is component
  state and does not survive a reload.
- `app/src/lib/notify.ts` has quiet hours (`Quiet`, `inQuiet`), per-course mute
  and `dueReminders`. `app/src/components/MuteCourses.tsx` is the control.
- `app/src/lib/myrules.ts` holds a student's own alert rules, capped.
- `public.institution_actions` (expansion migration) is the feed of holds,
  deadlines and resources an office publishes to a student or cohort.
- `public.contact_channels.quiet_hours` stores quiet hours per channel.

## In flight

The chain [#766](https://github.com/harrisonjrubin7-cmyk/semester/pull/766) →
[#767](https://github.com/harrisonjrubin7-cmyk/semester/pull/767) →
[#768](https://github.com/harrisonjrubin7-cmyk/semester/pull/768) →
[#769](https://github.com/harrisonjrubin7-cmyk/semester/pull/769) builds most of
the substrate this part needs:

- `lib/source.ts` — one `SourceLabel` for the whole app.
- `lib/actions.ts` — the canonical `Action` with `whyItMatters`, a `source`, an
  `Explanation`, nine statuses including `blocked` and `snoozed`, a transition
  table, a per-action history, and `Scored.parts`: urgency, impact,
  actionability, confidence and fatigue, where fatigue comes from how often
  *the student* snoozed it.
- `components/ActionCenter.tsx` — the list that replaces the single next step.

**This part extends that model. It does not add a second one.**

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `action_decision_records` | **Computed**, not stored | The record is `Action` + `Explanation` + `Scored.parts` at render time. A stored copy would go stale the moment a source refreshed. Server-published actions keep their own row in `institution_actions` |
| confidence (five values) | **Mapped onto `SourceLabel`**, not a new enum | `institution_verified` → official, `imported` → verified, `student_entered` → student_created, `estimated` → estimate, `needs_review` → needs_confirmation |
| `action_impact_previews` | **Field** on `Action`: `impact?: { says, doesNotChange, subjectTo }` | Always written with its caveat ("subject to official audit") |
| `action_dependencies` | **Field** `blockedBy: ActionId[]` | `blocked` status already exists; this says by what, without revealing a hold's reason |
| `action_bundles`, `action_bundle_items` | **Client model** first; a table only when an office publishes a bundle (then a column on `institution_actions`) | Registration readiness, research submission and advisor preparation are all computable from actions the student already has |
| `action_quiet_hours` | **Reuse** `notify.ts` `Quiet` on the device and `contact_channels.quiet_hours` for channels | One quiet-hours setting; see [ethical engagement](ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md) |
| `action_fatigue_budgets` | **Preference** + suppression reason on each hidden card | Student sets the cap; a system floor stops anything past a safe limit |
| `action_priority_preferences` | **Device preference** | A short-term focus reorders what is shown; it is not sent anywhere |
| `human_recommended_actions` | **Extend** `institution_actions` with author role, office and reason | It is already the table for actions a person published |
| `action_explanation_views` | **Declined** | Logging when a student opens an explanation is behavioural data with no benefit to the student. If product needs to know whether explanations help, #772's "Did this help?" asks the student directly |

## Capabilities and flags

- Publishing a human recommendation: `institution_action:publish` (exists).
- Flag: rides #768's `today_action_center`.

## Hard boundaries

- Priority uses urgency, impact, actionability, confidence and the student's own
  snoozes. **It never reads grades, GPA, health, disability, counseling,
  conduct, immigration, financial aid, private messages, location or inferred
  wellbeing.** A structural test lists the imports of the scoring module.
- No completion score exists, so none can be used for discipline, grades, aid,
  admissions, housing, employment or ranking.
- A routine action never uses an emergency style. Only an action whose source
  is an official alert, and whose school allows it, may break quiet hours.
- A human-recommended action is labelled with the person's role and office and
  is visually distinct from a system action — never the same card with a
  different word.
- A dependency says "blocked until your hold is resolved", never what the hold
  is for.

## Tests

- Decision-record completeness: every `Action` the app can produce renders all
  eleven parts the command lists (why, source, updated, rule, what changes, what
  does not, who sees it, why ranked, controls, freshness, rule version) — a
  table test over every action generator.
- The scoring module's import graph contains none of the prohibited modules
  (grades, bill, accommodation, health, mail, location).
- Quiet hours suppress a routine action and admit an official alert only when
  the school allows it.
- A fatigue cap of N shows N and records a suppression reason for the rest.
- A student priority reorders cards and changes no deadline or date.
- Human and system actions differ in their accessible name, not only colour.
