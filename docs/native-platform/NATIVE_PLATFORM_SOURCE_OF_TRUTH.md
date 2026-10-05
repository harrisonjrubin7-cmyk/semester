# Native platform source of truth

**As of** 2026-10-05 · **Base** `origin/main` `3bd382dc`

When two descriptions disagree, the earlier row wins. A PDF, a Figma frame, and a generated token file do not outrank the code they were measured against.

## Design

Carried from `CLAUDE.md` and [`docs/decisions/D-1293.md`](../decisions/D-1293.md). D-1293 is a merged decision: the brief's indigo palette is **offered**, not the default.

| Order | Authority | Role |
| ---: | --- | --- |
| 1 | `app/src/lib/look.ts` | Every colour. Thirteen grounds, eleven accents. Measured by `app/src/lib/contrast.test.ts`. |
| 2 | `app/src/styles/tokens.css` | Semantic tokens: surface, text, border, action, status, focus, layer, motion. |
| 3 | `app/src/lib/tokenexport.ts` | Builds the export. |
| 4 | `app/design-tokens/semester.tokens.json` | Generated. Never hand-edit. |
| 5 | `app/src/styles/` and `app/src/a11y/` tests | Contracts. Extend them; do not loosen them. |
| 6 | Claude Design export and Figma | Evidence of intent. |

### Token and component migration map

The PDF and the earlier design brief ask for a second token namespace (`theme-light.css`, `design-tokens/*.ts`, 51 named components). Creating that namespace would split the authority above. Map, do not fork.

| PDF / brief request | Existing authority | Migration |
| --- | --- | --- |
| Ink chrome `#090A0E` | `look.ts` ground `ink`; `--app` ink values in `styles/app.css` | Use the ground. Do not hard-code the hex in a screen. |
| Parchment content `#F4F1EA` / `#FBF9F4` | `look.ts` ground `parchment`. `DEVICE_LIGHT = 'parchment'` | Already the light default. |
| Semester blue action/focus | Industry accent in `styles/industry.css` and `look.ts`. Brief indigo is accent id `semester` | Leave indigo optional per D-1293. Action colour is the accent token, not a new blue. |
| Barlow body, Barlow Condensed headings, Cinzel display | Font stacks already loaded for the product (see `styles/` and the design-system docs) | Use the existing stacks. Cinzel stays rare. |
| Radii 3/6/10, motion 130/180/240/280 | `styles/app.css` radii; `tokens.css` motion, zeroed under reduced motion | Keep. A second 2/4/7 scale in `industry.css` is the known duplicate to retire only with a measured contrast pass. |
| Separate `theme-*.css` and `design-tokens/*.ts` | Do not exist, by design | Not started, and should stay not started. |
| AppShell, Ink SideRail, mobile tab bar, context bar | Shell is `App.tsx` plus nav areas. Tab bar is `lib/tabbar.ts` (Today, Plan, Learn, Help, Progress). Context bar is `components/unity/` (`SystemContextBar`, `ContextBar`) | Extend these. A new shell needs the case in `docs/design/GOVERNANCE.md` §2. |
| PageHeader, forms, tables, empty/error/loading | `components/ui.tsx`, `components/unity/States.tsx`, `components/unity/Table.tsx`, `components/FieldMessage.tsx`, `ErrorSummary` | Reuse. Bill, Costs, Meals, and Housing already share `ErrorSummary`. |
| Source / status vocabulary | `app/src/lib/source.ts`, `lib/status.ts`, `components/unity/ProvenanceChips.tsx` | Seven source states already exist: Institution verified, Imported, Student entered, Estimated, Needs review, Stale, Unavailable. |
| AI response with citation | `ask` screen and assistant settings. No single `AIResponse` export under that name | Add a shared component only after GOVERNANCE §2 shows the ask screen cannot serve. |
| Raw colours in feature UI | Forbidden. `npm run design-system:audit` against `app/design-system-baseline.json` | Ledgers may shrink and may not grow. |

## Product and data

| Question | Authority |
| --- | --- |
| Which screen exists | `app/src/lib/types.ts` `Screen`, enforced by `app/src/screens.tsx` |
| Where it sits in the student week | `app/src/lib/navareas.ts` |
| What search finds | `app/src/lib/nav.ts` |
| What a role may do | `public.app_roles`, `app_capabilities`, `role_capabilities`, `role_grants`, checked in the database. Never browser state. |
| What the database does | `supabase/migrations/` (184) and project `lzrqvlugnawcgywkhqlz` (184 applied). They match in count. Content drift was not diffed row by row. |
| What a tenant has switched on | `tenant_feature_policy`, `tenant_module_mode`, `feature_kill_switch` |
| What is official versus guidance | `app/src/lib/source.ts`. Precedence labels: institution, connected, imported, native, AI (`docs/platform/PRIMITIVES.md`). A label is not a cutover. |
| What may be said in public | `docs/PUBLIC-CLAIMS-APPROVAL-REGISTER.md` |
| What was decided | `docs/decisions/D-<PR>.md`. The numbered log is closed at D-160. |
| What is built versus asked | `docs/master/SEMESTER_GAP_REGISTER.md`, then this folder |

## Environment

| Environment | Identity | This pass |
| --- | --- | --- |
| Canonical app database | `semester` / `lzrqvlugnawcgywkhqlz` | Read-only SQL and security advisor |
| Live marketing domain database | `Semester2` / `kpuulmnicidgdmwgfngv` | Not queried. Prior doc: four accounts called test accounts, unverified |
| Restore drill | `semester-restore-drill-2026-10-01` | Not queried. Existence only. |
| App host | Vercel project described in `docs/infrastructure/VERCEL-CONSOLIDATION.md` | Not redeployed |

## What is not a source of truth

- This folder.
- A screen that renders sample or seeded term data.
- An AI completion.
- A GraphQL schema entry.
- A table with RLS and no rows.
- A SECURITY DEFINER function existing.
- A console tab.
- A commercial price row.
- A PDF.
