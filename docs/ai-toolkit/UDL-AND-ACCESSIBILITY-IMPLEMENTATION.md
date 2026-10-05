# UDL and accessibility

## Multiple means of engagement

- Nine goals to start from; the student picks, nothing is inferred.
- Recommendations are optional: *Hide*, *Show fewer*, *Browse all tools* (unranked).
- Due dates are framed as "this breaks it into finite stages", not as pressure.
- *Plan a way back after missed work* links to *When you are behind*, which uses
  non-shaming language already.

## Multiple means of representation

- Every chart-worthy number has **alt text written from the numbers** and a
  **captioned data table** (Data Studio).
- Read-aloud, text size, contrast and motion come from the app's existing settings;
  the toolkit's *Text size, contrast and motion* button goes there.
- Source kinds, tool states and audit states are **words** (*Not verified*,
  *Needs review before use*), never colour alone.

## Multiple means of action and expression

Write (stage notes), structure (templates), tabulate (evidence matrix, data
dictionary), diagram (Draw it), present (Deck). Teach-back by audio or video is not
built.

## Accessibility in the markup

- Every form control has a name — enforced by `npm run lint` (`scripts/labels.mjs`),
  which passes on this branch.
- Font sizes stay on the type scale — enforced by `scripts/styles.mjs`; the toolkit
  adds no inline styles and no new CSS values.
- Tabs use the shared `TabList` (roles, arrow keys, `aria-selected`).
- Goal buttons expose `aria-pressed`. Recommendations use `<details>` for *Why this
  workspace?*, which works by keyboard and screen reader without script.
- Tables have `<caption>`, `scope="col"` and `scope="row"`.
- Refusals use the shared `Notice` (`role="status"`, or `alert` for storage failure).
- Nothing is hover-only.
- Layout is the existing `portal-*` classes, which collapse to one column at 640px.

## Not built

Captions and transcript editing within the toolkit (they exist for course audio),
teach-back recording, a focus timer inside the toolkit (the app has one), syllabus
parsing into actions (the app's import does this with confirmation).
