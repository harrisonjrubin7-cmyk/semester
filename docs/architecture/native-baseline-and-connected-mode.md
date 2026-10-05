# Native baseline and connected mode

Status: Phase A gap matrix. “Implemented” means inspectable repository behavior, not production or institutional activation.

## Contract

Every major domain must expose a useful Semester-owned workflow without a provider. Connected mode may improve accuracy or automation only when tenant, authority, scope, freshness, health, receipt and recovery state are known. Official records remain authoritative in their owning system.

| Domain | Native baseline now | Connected mode now | Factual gap / release gate |
| --- | --- | --- | --- |
| Courses | Manual/import course, meeting, instructor and term workflows | Provider-neutral contracts and source labels | No live adapter registered; tenant map and reconciliation/UAT absent |
| Assignments | Manual dates, rubrics, attachments, checklists, plans and reminders | LMS/LTI models and receipt rules | No verified tenant feed; submission requires provider receipt |
| Calendar | Native events, schedules and imports | Feed clients and connection states | Provider coverage, recurring/export parity, health and tenant UAT incomplete |
| Grades | Personal tracker labeled as student-owned/unofficial | Official source models | No verified SIS/LMS grade feed; exclude raw grades from default offline storage |
| Degree | What-if pathway and requirement planning | Catalog/audit contracts and sandbox data | No approved authoritative map or registrar sign-off |
| Financial life | Cost planning and personal tracking | Bursar/aid contracts and sandbox flows | No live ledger/provider, finance approval or transaction authority |
| Campus services | Directory, discovery and bounded request concepts | Tenant-bound adapter contracts and sandbox services | No institution-owned directory/API activation or service UAT |
| Dining | Meal-plan estimates and hours/menu UI | Campus-card/dining contracts | Current verified feed, owner and reconciliation absent |
| Housing | Preferences, checklist and planning | Housing adapter/sandbox structures | Verified inventory, safety/moderation and tenant activation absent |
| Career | Profile, portfolio, application tracking and preparation | Institution/partner concepts | Verified opportunity, mentor and career-service network absent |
| Marketplace | Opportunity discovery, application preparation and moderation pieces | Partner/data-sharing contracts partial | Partner verification, disclosure delivery, outcome and retention operations absent |
| Family | Planning, invitations and consent concepts | Server grants and database foundations | Production relationship verification and projection-only delivery/revocation evidence absent |
| AI | Planning, study and writing assistance with policy/kill-switch patterns | Institution/provider configuration | Provider approval, evaluation, support and tenant scope evidence required |
| Support | Native request/status UI, grants and runbooks | Institution escalation/ticket integration partial | Staffed queue, response evidence and tenant routing external |
| Community | Groups, chat and moderation/reporting components | Institution roster/channel concepts | Durable moderated service, safety staffing, retention and tenant policy incomplete |
| Notifications | In-app/push preference foundations | Delivery providers and announcements partial | Unified delivery ledger, retry evidence and operated ownership incomplete |
| Search/command | App search and commands | Source-aware results in several surfaces | No single server-authorized tenant/purpose index shared with AI |

## Operating rules

- Native data says `student-entered`, `personal`, `estimate`, or `unofficial` when appropriate.
- Connected data carries tenant, connection, provider object ID, source time, ingest time, sync run, freshness and reconciliation state.
- Disconnecting a provider does not erase student-owned work.
- Unhealthy or stale connected mode falls back to native/manual mode where safe; official writes fail closed.
- Navigation exposure is controlled by the capability resolver, entitlement, tenant policy and current evidence—not route existence.

The repository has a stronger student-native baseline than its external readiness. “All categories from inception” is credible only with truthful native workflows and institution-controlled connected surfaces that remain unavailable until per-tenant evidence is current.
