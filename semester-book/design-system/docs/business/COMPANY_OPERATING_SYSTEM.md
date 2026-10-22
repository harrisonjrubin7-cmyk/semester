# Company operating system

_Semester Company OS · 2026-10-05 · Source: uploads/what else on the bussnius and opprations site also.pdf._

> Semester must operate with the same coherence, evidence, reliability and trust it promises to institutions.

| Function | Owner | System of record | Priority | Next action | Doc |
| --- | --- | --- | --- | --- | --- |
| Corporate governance and legal | Founder + fractional counsel | Contracts register in /ops legal; corporate records folder | P0 | Counsel review of MSA, DPA and order form before pilot launch | CORPORATE_GOVERNANCE_AND_LEGAL_OPS.md |
| Finance, accounting and capital | Founder + bookkeeper | /ops finance (invoices, AR, dunning); accounting ledger (bookkeeper); bank | P0 | Open business bank account and accounting ledger; set the monthly close date | FINANCE_AND_CAPITAL_SYSTEM.md |
| Product and engineering operations | Founder → founding engineer | GitHub (code, PRs), /ops product operations (backlog, flags, releases) | P1 | Run execute stream 00 and approve the design-system baseline | PRODUCT_AND_ENGINEERING_OPERATIONS.md |
| Security, privacy, accessibility and compliance | Founder + fractional security lead | /ops trust & compliance (controls, evidence, HECVAT, data requests) | P0 | Bind insurance; submit HECVAT Full; complete vendor reviews for Supabase, Vercel, AI provider | TRUST_PROGRAM.md |
| Go-to-market and revenue operations | Founder | /ops GTM pipeline (CRM) | P1 | Build the 40-account target list in /ops | REVENUE_OPERATIONS.md |
| Marketing, brand and communications | Founder | Company site + content register; /ops social | P2 | Publish pilot, pricing and trust pages | MARKETING_AND_BRAND_SYSTEM.md |
| Customer success and implementation | Founder → implementation lead | /ops customer success (implementation, health, QBR) | P0 | Kick off Vanderbilt implementation with the mutual action plan | CUSTOMER_SUCCESS_AND_IMPLEMENTATION.md |
| Support and service operations | Founder → support specialist | /ops support desk | P1 | Write the first 10 KB articles from the pilot paths | SUPPORT_AND_SERVICE_OPERATIONS.md |
| Partnerships, marketplace and developer relations | Founder | /ops partnerships | P3 | List the integration partners the pilot depends on (SIS, LMS, IdP, AI provider) | PARTNERSHIPS_AND_MARKETPLACE.md |
| People, hiring and culture | Founder | /ops people (hiring, onboarding); payroll provider (embedded) | P2 | Engage counsel and bookkeeper as the first contractors | PEOPLE_AND_HIRING_SYSTEM.md |
| Data, research and outcomes | Founder | Analytics (aggregate), research repository | P1 | Define the pilot event taxonomy (no PII) | DATA_RESEARCH_AND_OUTCOMES.md |
| Procurement, vendors and supply chain | Founder | /ops vendors | P1 | Record reviews for Supabase, Vercel, AI provider, email provider | VENDOR_AND_PROCUREMENT_SYSTEM.md |
| Risk, resilience and continuity | Founder | /ops risk register, incidents, SLOs | P1 | Write the key-person continuity plan (credentials escrow, runbooks, counsel contact) | RISK_RESILIENCE_AND_CONTINUITY.md |
| Board, investor and stakeholder operations | Founder | /ops board/investor reports; investor portal | P3 | Draft the data room index (deferred) | BOARD_AND_INVESTOR_OPERATIONS.md |
| Operations command center | Founder | /ops | P1 | Start the weekly operating review from the executive overview | OPERATIONS_COMMAND_CENTER.md |

## Systems-of-record map

Everything runs in Semester's /ops console (see ui_kits/one-place). Regulated systems stay external and embedded: bank, payment processor, payroll, accounting ledger (bookkeeper), e-sign provider, GitHub, Vercel, Supabase.
