# Source of truth

**As of** 2026-10-05 · **Status** Phase 0.

Which file wins when two disagree. Earlier wins; later is stale.

## Design

1. `app/src/lib/look.ts` — every colour; measured by `lib/contrast.test.ts`.
2. `app/src/styles/tokens.css` — semantic CSS tokens.
3. `app/src/lib/tokenexport.ts` — produces the export.
4. `app/design-tokens/semester.tokens.json` — **generated; never edit** (`npm run tokens:export`).
5. Tests in `app/src/styles/` and `app/src/a11y/` — contracts.
6. The Claude Design export and Figma — evidence of intent, never an authority. `docs/decisions/D-1293.md` is the standing example: the brief's palette was offered, not made default.

## Product and data

| Question | Authority |
| --- | --- |
| What routes exist | `app/src/screens.tsx`, `lib/nav.ts`, `lib/navareas.ts` |
| What a role may do | `public.app_roles`, `app_capabilities`, `role_capabilities`, `role_grants`, read through `private.has_capability()` — never browser state or user metadata |
| What the database does | `supabase/migrations/` (184 files), then the live project `lzrqvlugnawcgywkhqlz` |
| What is released to a tenant | `tenant_feature_policy`, `tenant_module_mode`, `feature_kill_switch` |
| What decisions were made | `docs/decisions/D-<PR number>.md` (log closed at D-160) |
| What is built vs requested | `docs/master/REPO_AUDIT.md` and `SEMESTER_GAP_REGISTER.md`, then this folder |
| What may be claimed publicly | `docs/PUBLIC-CLAIMS-APPROVAL-REGISTER.md`, `claims_register` |

## Known divergence to resolve before any domain move

`www.semesterintel.tech` (project `semester-shared-core`) is served from Supabase project **Semester2** (`kpuulmni…`), while the canonical build (`semester-rose.vercel.app`) uses `semester` (`lzrqvlug…`) per `docs/infrastructure/VERCEL-CONSOLIDATION.md` §2.2. The owner states the four Semester2 accounts are test accounts; that was not verified here. This task names `lzrqvlugnawcgywkhqlz` as primary, so every database finding here is from that project, not from what the live domain serves.
