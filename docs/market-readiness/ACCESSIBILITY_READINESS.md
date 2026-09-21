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

## Missing

- **No WCAG 2.2 AA audit** against the critical workflows as workflows —
  the guards are unit-level, not journey-level.
- **No screen-reader pass** recorded against registration, degree tracker,
  calendar or documents.
- **No zoom/reflow testing** at 200% and 400%.
- **No ACR/VPAT.** One cannot be produced from this tree; it requires formal
  evaluation. Do not fabricate one.

## Next

A journey-level audit of the six workflows a university would actually test:
home, calendar, courses, assignments, registration planning, degree tracker.
