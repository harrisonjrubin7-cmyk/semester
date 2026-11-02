# Existing-to-proposed map (contract step 1)

Status: inventory taken from the repository on 2026-10-22. It shows what exists in the code and schema, not what has been tested or deployed. Stage evidence is kept in the Capability Evidence table, and a stage with no evidence stays **Unknown**.

## Apps
| App (dir) | Plane | Exists today | Proposed role (contract) | Gaps |
|---|---|---|---|---|
| semester | Personal + Institutional (mixed) | 26 pages, 24 endpoints; student routes (/today, /learn, /plan, /progress, /campus, /help, /you) + staff routes (/staff/*, /console); unit tests: aiGate, readiness, registrar, regrade, shares | Connected shell + student and institution workspaces | Personal and institutional planes share one app; needs server-side plane checks on every endpoint, not route hiding. File uploads (Progress, SectionPage) are public-by-link |
| semester-company-os | Company | /overview /requests /risks /evidence /simulator; billingSim, costModel, scenario, systemMap tests | Company workspace: invoice/approval/reconciliation slice (step 3) | No invoices, approvals or receipts; simulator only |
| implement-and-build-the-complete (not listed as a workspace app) | Company | /accounts /deals /contracts /implementation /support /audit, using the customerAccounts, deals, contracts, implementationProjects, supportTickets and companyAuditLog tables | Should merge into Company OS | **Parallel CRM risk:** a second company surface with its own audit log. The contract forbids parallel CRM and approval systems. Decide: fold it in or retire it |
| semester-security-lab | Internal governance | JWT, bucket, isolation, RLS, suites, policies, gates, artifacts, capabilities pages | Evidence registry (step 1) and simulated negative tests | Tests are simulations and don't count as release evidence |
| semester-site | Public | Marketing pages + pilot request form | Marketing draft → review → approved publication (step 6) | No draft/review workflow; pages are published straight from code |
| semester-applicants / -employers / -family | External | One endpoint each | Scoped external views | Need per-request scope checks and revocation |
| (none) | Developer | — | Sandbox, app registration, scoped install, revocation (step 5) | Nothing exists |

## Tables against canonical concepts
| Concept | Existing table(s) | Status |
|---|---|---|
| Tenant / identity | institutions, memberships, Zite users | Exists. Membership is not re-checked per transaction everywhere |
| Authorization / policy | featureStatus, consents | No central server-side policy layer |
| Audit | auditEvents, companyAuditLog | **Two audit logs** — consolidate or define the boundary between them |
| Commands / receipts / outbox | — | Missing. Zite has no atomic multi-table transactions, so per the contract these stay disabled synthetic demonstrations |
| Files | Zite uploads (public URLs) | Not allowed for private documents. Needs a private store plus a backend check on every download |
| Registrar | academicTerms, registrationRequests, studentHolds, enrollments, sections | Request queue exists; there is no atomic seat lock |
| Grades | officialGradeRecords, gradeChangeRequests, regradeRequests | Exists; official and student-private records are separate |
| Sources / freshness | sourceRegister, integrations | Exists; staleness does not yet block commands |
| Company CRM | customerAccounts, deals, contracts, implementationProjects, supportTickets, inboundRequests | Exists (see parallel CRM risk) |
| Finance (canonical list in contract) | **none**: commercial_products/plans/prices, entitlements, billing_accounts, quotes, subscriptions, invoices, payment_events, credits_refunds, dunning, cancellations, student_account_* | Missing. Migration 090 / fin ledger are references only, not proof they exist |
| Governance | capabilityRegister, capabilityEvidence, releaseGates, testSuites, labRuns, auditFindings, isolationTests, artifactInventory | Exists |

## Decisions needed before step 2
1. ~~Fold the parallel CRM app~~ — done 2026-10-22: its pages and endpoints now live in Company OS (/crm, /accounts, /deals, /contracts, /implementation, /support, /audit), and the separate app was removed.
2. Choose a controlled backend for atomic command + write + receipt + outbox, or accept that these stay synthetic and disabled.
3. Choose a private file store (uploads are currently public-by-link).
4. Decide whether student and staff surfaces stay in one app with server-side plane checks, or are split.
