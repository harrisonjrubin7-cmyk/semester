# Native capability matrix

**As of** 2026-10-05 · **Base** `origin/main` `3bd382dc`

Existing-versus-native. "Existing" is what a reader can find in `app/`, `supabase/migrations/`, or project `lzrqvlugnawcgywkhqlz`. "Native target" is the PDF. Readiness uses the same words as [`docs/master/SEMESTER_CAPABILITY_MATRIX.md`](../master/SEMESTER_CAPABILITY_MATRIX.md).

**Ready for pilot: none. Ready for production: none. Ready to become authoritative: none.**

Review flags: SEC security, PRIV privacy, A11Y accessibility, INST institutional approval, MIG migration, REC reconciliation, RBK rollback. A mark means the review is owed and not evidenced.

| PDF capability | Existing | Native target | Maturity | Reviews | Readiness |
| --- | --- | --- | --- | --- | --- |
| Student OS daily loop | Today, 7 areas, 63 destinations | One loop with source labels | Native but incomplete | SEC PRIV A11Y | Conditional: invitation-only individual validation |
| Workspace (tasks, notes, files, docs) | Calendar, Mine, Write, Sheet, Deck, productivity server | Education workspace | Native but incomplete | SEC PRIV A11Y | Conditional individual |
| Path and degree plan | Pathway, Degree | Plan beside an official audit | Transitional | SEC PRIV A11Y INST MIG REC | Not ready |
| Course Studio | Course screens, guidance RPCs | LMS-capable studio | Native but incomplete | SEC PRIV A11Y INST MIG REC RBK | Unsafe to activate |
| Assessment and gradebook | Gradebook screen and RPCs | Official gradebook | Native but incomplete | SEC PRIV A11Y INST REC RBK | Unsafe to activate |
| Registrar / SIS | Registrar screen, section/term RPCs | Authoritative SIS | Transitional | SEC PRIV A11Y INST MIG REC RBK | Unsafe to activate |
| Registration | Enrol/drop/withdraw RPCs | Registration engine | Native but incomplete | SEC PRIV A11Y INST MIG REC RBK | Unsafe to activate |
| Academic record | Ledger tables and chains | Record of record | Native but incomplete | SEC PRIV A11Y INST MIG REC RBK | Unsafe to activate |
| Advising / success | Shares, help, office actions | Caseload and plans | Native but incomplete | SEC PRIV A11Y INST | Not ready |
| Student finance | Account ledger schema, bill UI | Bursar ledger | Transitional | SEC PRIV A11Y INST MIG REC RBK | Unsafe to activate |
| Aid handoff | Directory | Handoff only | Transitional | SEC PRIV INST | Not ready |
| Campus / dining / housing | Screens and dining RPCs | Service routing | Native but incomplete | SEC PRIV A11Y INST | Not ready |
| Community | Posts, moderation, appeals | Moderated community | Native but incomplete | SEC PRIV A11Y INST | Unsafe to activate |
| Career | Career screen, skills tables | Lifelong record | Pilot-only employer side | SEC PRIV A11Y INST | Not ready |
| Family | Family screen and grant RPCs | Consent platform | Native but incomplete | SEC PRIV A11Y INST | Unsafe to activate |
| Identity, SSO, SCIM | Auth, scim tables, deprovision migration | Membership on an institution IdP | Native but incomplete | SEC PRIV A11Y INST MIG | Unsafe to activate |
| Policy, consent, retention, holds | Migrations for policy, holds, DSR, erasure | One policy engine | Native but incomplete | SEC PRIV INST | Not ready |
| AI gateway | Claude function, spend migration, assistant settings | Full decision flow | Native but incomplete | SEC PRIV A11Y INST | Not ready |
| Integrations | 16 integration tables, LTI and Canvas functions | Bridge, then retirement | Integrated only | SEC PRIV INST MIG REC | Unsafe to activate |
| Control plane | Tenant, module, kill switch, cohorts | Institution admin | Native but incomplete | SEC PRIV A11Y INST | Not ready |
| Trust / HECVAT | Docs, trust room, privacy center | Evidence program | Designed/documented | SEC PRIV A11Y INST | Not ready |
| Command center | Console, 10 tabs | Full operator OS | Native but incomplete | SEC PRIV A11Y | Not ready |
| Commercial / CS | Commercial tables, billing functions, GTM schema | Company revenue system | Pilot-only checkout flag | SEC PRIV INST | Not ready |
| Company finance / people | Docs, runway screen | Operating company | Designed/documented | — | Not ready |
| Developer platform | One productivity OpenAPI, docs | API gateway and SDKs | Designed/documented | SEC | Not ready |
| Marketplace | Governance defers it | Partner apps | Not started | SEC PRIV INST | Not ready |
| Outcomes / analytics | Device data studio | Tenant outcomes | Native but incomplete | SEC PRIV A11Y | Not ready |
| Reliability | CI, SLO docs, restore-drill project exists | Measured SLOs | Designed/documented | SEC | Not ready |
| Global | English product | Locale, RTL, residency | Designed/documented | A11Y PRIV | Not ready |

## What "native and verified" would require

Held by an automated test, and the launch gap for that behavior closed. Examples that are tested and still not verified in this sense:

- Registration RPCs have screen tests (`screens/registration.test.tsx`) and remain unsafe to activate.
- Gradebook has `screens/gradebook.test.tsx` and remains the LMS's record.
- Dining has `screens/dining.test.tsx` and has no verified partner.
- Contrast and token tests pass for the design system and do not make a domain authoritative.

## Design-system capability

| Capability | Existing | Gap |
| --- | --- | --- |
| Semantic colour | `look.ts`, `tokens.css` | Do not add a second palette as default (D-1293) |
| Type | Barlow, Barlow Condensed, Cinzel already the product fonts | Keep Cinzel rare |
| Components | `components/ui.tsx`, `components/unity/` | PDF names without exports stay mapped, not rebuilt |
| Source chips | Provenance components | Coverage not proven on every new screen |
| Recovery states | Shared empty/error/loading | Per-screen adoption still uneven |
| Raw-value ledger | `design-system:audit` | May shrink, may not grow |

## Security capability versus exposure

| Control | Existing | Open |
| --- | --- | --- |
| RLS on every public and private table | Measured 321 and 31 | F-01 school isolation off |
| RLS with no policy | 63 tables, default deny | Confirm each is intentional |
| Anon GraphQL visibility | 32 tables, SELECT granted, policies exist | Predicates not executed |
| Definer RPCs callable by signed-in users | 207 | Body-level capability review not done |
| Audit | `audit_event` pattern | Tamper-evidence open |
| Secrets in the client | Prior finding F-02, tokens in localStorage | Not re-tested |
| Alerting | Prior finding F-08, no alert to a person | Still the incident gap |
