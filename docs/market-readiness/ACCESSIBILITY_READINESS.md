# Accessibility Readiness

**Status: `IN_PROGRESS`** — stronger than most areas, short of contract-ready.

## Exists, with tests

`app/src/a11y/` is real infrastructure, not a checklist:

| Module | Guards |
| --- | --- |
| `focus.test.ts` | focus management |
| `labels.ts` / `labels.test.ts` | every form control has a screen-reader name |
| `landmarks.test.ts` | landmark structure |
| `modal.ts` / `modal.test.ts` | dialog semantics |
| `motion.test.ts` | reduced-motion respect |
| `dragging.test.ts` | drag/drop alternatives |
| `title.ts` / `title.test.ts` | document titles |
| `type.test.ts` | type scale |
| `tellings.test.ts` | announcements |

The label audit runs in `npm run lint` and currently reports:

```
labels ok — every form control has a name a screen reader can read,
and no control loses one to CSS
```

There is also a dedicated contrast workflow (`.github/workflows/contrast.yml`)
and `app/src/lib/contrast.test.ts` walking the full ramp — CLAUDE.md treats
contrast regressions as a named hazard.

`app/scripts/accessibility-smoke.mjs` also opens the production bundle's Home,
Calendar, Courses, Assignments, Registration and Degree journeys at desktop
and a 320 CSS-pixel reflow viewport (the WCAG 400% reflow equivalent from a
1280-pixel baseline). It verifies one main landmark, a route-aware title and
heading, named visible controls, valid ARIA references, unique IDs, page-level
reflow and a keyboard skip link that transfers focus to main. CI runs this
against the same base path GitHub Pages deploys. This is regression evidence,
not formal conformance evidence.

## Missing

- **No WCAG 2.2 AA audit** against the critical workflows as workflows —
  the guards are unit-level, not journey-level.
- **No screen-reader pass** recorded against registration, degree tracker,
  calendar or documents.
- **No independent 200% text-zoom review.** Automated 400% reflow coverage is
  present for six critical journeys, but it does not replace manual browser
  zoom and assistive-technology review.
- **No ACR/VPAT.** One cannot be produced from this tree; it requires formal
  evaluation. Do not fabricate one.

## Next

A journey-level audit of the six workflows a university would actually test:
home, calendar, courses, assignments, registration planning, degree tracker.
