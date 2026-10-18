# Semester layout contract

Every Semester screen uses the same attention architecture. This contract is
the short, reviewable form of the broader
[UI constitution](SEMESTER-UI-CONSTITUTION.md); it does not create a second
shell or component system.

## Required regions

1. **Global shell** — brand, current context, command/search, system state and
   profile. Owned by `app/src/App.tsx`.
2. **Local context** — destination plus course, term, project or service. Owned
   by `app/src/headers.ts` and contextual bars.
3. **Primary decision** — one dominant action or focused workspace. It is first
   in DOM order as well as visually dominant.
4. **Supporting context** — no more than five next items and two warnings in
   the first viewport. Ordinary reading is a flat section, not another card.
5. **Progressive detail** — source, rationale, alternatives, history and
   advanced controls opened deliberately.
6. **Recovery** — empty, loading, save, stale, offline, permission and error
   states preserve the last usable context and provide a next step.

`app/src/components/Page.tsx` is the shared frame. A screen may bypass it only
when it is an edge-to-edge editor, call, reader or presentation and is named
with a reason in `app/src/pageframe.test.ts`.

## Responsive modes

| Situation | Mode | Contract |
|---|---|---|
| Large desktop | Planning workspace | Rail, main canvas, optional context rail |
| Laptop/tablet | Focused workspace | Rail and canvas; detail becomes a drawer |
| Small tablet | Single pane | Main content; context collapses |
| Mobile | Decision flow | One primary card/step; detail uses a sheet or full page |
| Focus View | One-task workspace | Navigation and optional modules hide; source, help, save state and Exit focus remain |
| Reduced motion | Stable mode | No decorative movement or auto-scrolling |
| Screen reader / high zoom | Semantic mode | Logical landmarks and one-column reading order |

Do not shrink a desktop visualization until its labels are unreadable. A
calendar becomes an agenda, a chart gains a text/table equivalent, and a
comparison becomes sequential cards when space is limited.

## Content budgets

Layer 1 permits one heading, one summary sentence, one primary action, two
status signals, three to five supporting items and at most two warnings.
Components collapse or reject excess content. They never grow the first
viewport to absorb it.

Never hide the page context, primary action, consequential blocker,
source/freshness, save state, back/exit or official fallback. Collapse optional
suggestions, secondary metrics, history, related content, advanced filters and
analytics first.

## Focus View

Focus View is student-controlled presentation only; it never changes access or
data. `app/src/components/unity/modes.tsx` owns the persistent Exit focus route.
On Today, only the dominant decision remains while focused. Its source,
rationale, help and action controls remain available.

## Enforcement

- `app/src/pageframe.test.ts` guards the shared frame.
- `app/src/styles/tokens.test.ts` guards Focused-mode layout behavior.
- `app/src/a11y/landmarks.test.ts` guards landmarks.
- `app/src/styles/taps.test.ts` and `app/src/a11y/focus.test.ts` guard operation.
- `npm run audit:screens` and [SCREEN-QUALITY-CHECKLIST.md](SCREEN-QUALITY-CHECKLIST.md)
  are the review gate for rules that are not yet machine-checkable.
