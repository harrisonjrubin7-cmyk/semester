# Semester design standards

Consistency beyond the visuals: what words mean, how screens are shaped, how
flows start and end, how status and trust are shown, and who owns all of it.

| Document | What it settles |
|---|---|
| [SEMESTER-CONTENT-STANDARDS.md](SEMESTER-CONTENT-STANDARDS.md) | Vocabulary, labels, tone, source language, message patterns |
| [INTERACTION-STANDARDS.md](INTERACTION-STANDARDS.md) | Screen families, object contracts, flows, status, states, motion and sound, preferences |
| [GOVERNANCE.md](GOVERNANCE.md) | Owners, new-pattern approval, PR checklist, screen audit, visual regression plan, adoption metrics |
| [DESIGN-DEBT.md](DESIGN-DEBT.md) | Every known inconsistency, with evidence and a canonical fix |
| [LAYOUT-CONTRACT.md](LAYOUT-CONTRACT.md) | Required screen anatomy, responsive modes, content budgets and Focus View |
| [PROGRESSIVE-DISCLOSURE-RULES.md](PROGRESSIVE-DISCLOSURE-RULES.md) | Layer 1/2/3 placement and explicit reveal triggers |
| [STATUS-SOURCE-VISUAL-LANGUAGE.md](STATUS-SOURCE-VISUAL-LANGUAGE.md) | One visual and verbal grammar for state, certainty and provenance |
| [RECOVERY-STATE-LIBRARY.md](RECOVERY-STATE-LIBRARY.md) | Empty, loading, saving, error, offline, permission and success contracts |
| [SCREEN-QUALITY-CHECKLIST.md](SCREEN-QUALITY-CHECKLIST.md) | Review and regression gate for every screen and state |
| [DESIGN-SYSTEM-PRODUCT-SPEC.md](DESIGN-SYSTEM-PRODUCT-SPEC.md) | The system as governed infrastructure: component inventory and contracts, five-axis provenance, versioning and deprecation, Figma parity, visual regression, role density, dyslexia-aware mode, QA and handoff, build plan |

The visual foundations — tokens, grounds, type, spacing — are
[`app/src/lib/look.ts`](../../app/src/lib/look.ts), described in
[../DESIGN-SYSTEM-IMPROVEMENTS.md](../DESIGN-SYSTEM-IMPROVEMENTS.md). These
documents build on that system and do not replace any of it.

## Design-system adoption (phase D0, 2026-10-04)

Audit only; nothing here changed behaviour. Start with the adoption audit.

| Document | What it settles |
|---|---|
| [DESIGN_SYSTEM_ADOPTION_AUDIT.md](DESIGN_SYSTEM_ADOPTION_AUDIT.md) | Findings, conflicts U-1..U-6, gate recommendation |
| [DESIGN_MIGRATION_MATRIX.md](DESIGN_MIGRATION_MATRIX.md) | Every element mapped to a bucket, phase and risk |
| [VISUAL_DEBT_REGISTER.md](VISUAL_DEBT_REGISTER.md) | VD-001..VD-045, cross-referenced to DESIGN-DEBT.md |
| [COMPONENT_INVENTORY.md](COMPONENT_INVENTORY.md) | Target library against what exists |
| [STATUS_AND_PROVENANCE_AUDIT.md](STATUS_AND_PROVENANCE_AUDIT.md) | Four vocabularies, AI, consequence preview |
| [ACCESSIBILITY_GAP_AUDIT.md](ACCESSIBILITY_GAP_AUDIT.md) | Accessibility gaps and the seven manual scripts |
| [RESPONSIVE_SHELL_AUDIT.md](RESPONSIVE_SHELL_AUDIT.md) | Rail, tab bar, breakpoints, staff shells, routes |
| [CONTENT_AND_VOICE_AUDIT.md](CONTENT_AND_VOICE_AUDIT.md) | Copy rules measured |
| [adr/README.md](adr/README.md) | ADR-0030 to ADR-0040, Proposed |

## What is enforced by code

| Rule | Command | Where |
|---|---|---|
| Retired words cannot increase per file | `npm run lint:terms` (part of `npm run lint`) | `app/src/content/terms.ts`, `ledger.ts` |
| Type, leading and spacing stay on the scale | `npm run lint:styles` | `app/src/styles/rules.ts`, `budget.ts` |
| Every control has an accessible name | `npm run lint:labels` | `app/src/a11y/labels.ts` |
| Nothing is said only with colour or shape | `npm test` | `app/src/a11y/tellings.test.ts` |
| Reduced motion and calm mode are honoured | `npm test` | `app/src/a11y/motion.test.ts`, `calm.test.ts` |
| Contrast on every ground | `npm test` | `app/src/lib/contrast.test.ts` |
| Adoption figures | `npm run census:design` | `app/scripts/design-census.mjs` |
| The generated token export is in step with `tokens.css` and `look.ts` | `npm run tokens:check` | `app/src/lib/tokenexport.test.ts` |
| No new raw colour, z-index, shadow, radius, duration or easing, and no raw CSS spacing or type, beyond each file's ledger | `npm run design-system:audit` | `app/src/styles/designsystem.ts`, `rawbudget.ts` |
| Every Figma mapping resolves to a real token or pattern | `npm run design-system:check` | `docs/design-system/figma-mapping.json` |
| One report of all of the above, uploaded by CI | `npm run design-system:report` | [`docs/design-system/README.md`](../design-system/README.md) |
| Every design-system component has a story; the gallery does not read the clock | `npm test` | `app/src/gallery/gallery.test.tsx` |
| Visual regression of the stories against a runner-made baseline (not in CI) | `npm run gallery:shots` | `app/scripts/gallery-shots.mjs` |

## A coherent screen

A screen is done when it uses the shared frame and its family's order, has
one obvious primary action, uses the canonical words, shows source and
freshness where a fact could be mistaken for official, handles loading,
empty, error, permission, stale and success, works from 320 px to desktop and
at 200 % zoom, works by keyboard and screen reader, and keeps navigation where
the student expects it.
