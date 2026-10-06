# Complete catalog (index)

**As of** 2026-10-05 · **Status** Phase 0. This is an index, not a copy: the catalogs already exist and are larger than anything that should be duplicated here.

| Catalog | File | Size / count |
| --- | --- | --- |
| Domains | `SEMESTER_DOMAIN_CATALOG.md` | 1,409 lines |
| Screens | `SEMESTER_SCREEN_CATALOG.md` | 589 catalogued screens (the PDFs say 673; the difference is **unreconciled** — the PDFs' catalog was not supplied) |
| Workflows | `SEMESTER_WORKFLOW_CATALOG.md` | 319 steps in the repo audit |
| Roles | `SEMESTER_ROLE_CATALOG.md` | PDFs say 51; live `app_roles` has 69 rows |
| Capabilities | `SEMESTER_CAPABILITY_MATRIX.md` | live `app_capabilities` has 96 rows |
| Data authority | `SEMESTER_DATA_AUTHORITY_MATRIX.md` | — |
| Interoperability | `SEMESTER_INTEROPERABILITY_MATRIX.md` | — |
| Tables | live project | ~230 public tables, all RLS-enabled |
| Edge Functions (repo) | `supabase/functions/` | lti, lead-intake, billing-checkout/portal/webhook/cancel, claude, calendar, canvas, fetchcal, integration-tick, push, support-reply-notify, trust-room, delete-account, productivity-sourcecheck |
| Migrations | `supabase/migrations/` | 184 files, latest `20261005000000_client_roles_lose_table_ddl_privileges.sql` |
| Design components | [role/screen matrix §3](SEMESTER_ROLE_SCREEN_WORKFLOW_MATRIX.md) | 51 requested; 18 found by name |

Classification vocabulary (Native and verified … Ready to become authoritative) is applied in [`SEMESTER_GAP_AND_STATUS_REGISTER.md`](SEMESTER_GAP_AND_STATUS_REGISTER.md). No domain is classified above *Ready for internal use* in this pass because no release evidence was gathered.
