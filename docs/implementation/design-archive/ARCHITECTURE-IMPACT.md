# Architecture impact

## Current authorities to preserve

| Concern | Repository authority | Consequence |
| --- | --- | --- |
| Design/appearance | `app/src/lib/look.ts`, `app/src/styles/tokens.css`, `app/src/lib/tokenexport.ts` | Map archive tokens/themes; preserve saved choices |
| Routes/navigation | `app/src/lib/route.ts`, `app/src/screens.tsx`, `app/src/lib/nav.ts`, `app/src/lib/navareas.ts` | Reconcile names before adding screens; preserve deep links/history |
| Local persistence | `semester-store`, collection stores, settings, `semester.v1` rollback | Require forward migrations, unknown-field preservation, rollback analysis, and tests |
| Server policy/data | Supabase migrations/functions, RLS/capabilities, saga/outbox/read-model seams | Institutional truth and controlled actions remain server-authoritative and auditable |
| Deployment/security | Workflows, Vercel configs, `stackhawk.yml`, production smoke checks | Each code slice needs appropriate build, test, scan, and deployment evidence |

Components require comparison and consolidation, not a second shell. Screens require route, role, state, and data-contract proof. Workflows require server transitions, idempotency, recovery, and owners. Roles require capability and negative-access tests. Tokens/themes need an explicit mapping decision. Documents must separate policy intent from operating evidence.

Compatibility risks include broken saved links, theme/contrast regressions, stranded IndexedDB versions, client-fabricated authority, schema/RLS conflicts, and keyboard/responsive regressions from wholesale replacement.

Before implementation, decide the normalized screen identity ledger, token aliases/rejections, role/capability/RLS lifecycle, controlled workflow contracts, persistence migration/rollback rules, and evidence required for each claim-bearing state.
