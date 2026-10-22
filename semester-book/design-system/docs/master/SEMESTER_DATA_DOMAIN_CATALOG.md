# Data domain catalog

_Generated 2026-10-05 from ui_kits/master-catalog/catalog-data.js, ui_kits/workflow-runner/runner-data.js and os-map-data.js. Design-level only: nothing here is verified until repo code, RLS/tenant isolation, accessibility, tests, monitoring, support, documentation and release evidence exist._

Design-level data domains by classification, from the system rules and handoff/semester-platform migrations.

| Classification | Systems | Rule |
| --- | --- | --- |
| Education record | Registration, Academic Record, Gradebook, Assessment, Degree Audit, Transfer | FERPA; RLS + tenant_id; never sent to AI; company roles never read |
| Education record · financial | Financial Account, Payment Plan | FERPA; RLS + tenant_id; never sent to AI; company roles never read |
| Education record · sensitive | Student Success | FERPA; RLS + tenant_id; never sent to AI; company roles never read |
| Personal · consent-bound | Privacy, Family/Guardian | Scoped, time-limited, revocable grant; access logged |
| Directory | Identity | Role-scoped; audited |
| Classified per request | AI Gateway | Role-scoped; audited |
| Company internal | Billing, Release | Role-scoped; audited |
| Restricted | Security | Role-scoped; audited |
| Personal (minimum context) | Support | Role-scoped; audited |
| Personal · student-controlled | Career, Community | Role-scoped; audited |
| Aggregate, de-identified | Analytics | Minimum cell size; no row-level export |

## Tables in handoff/semester-platform (not yet run)

- 010 core: core.institutions, core.profiles, audit.events
- 020 community: groups, members, posts, reports, events, rsvps
- 030 market: listings, offers, drops, bids
- 040 ops: staff, accounts, invoices, social_posts, settings
