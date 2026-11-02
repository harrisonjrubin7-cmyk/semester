# Product-template to developer contract mapping
Source baseline: 4b4f8ca742242132f5b2dd254d23422ae70eaa7a.
- Institution console: GET /status + GET /records; adapter and membership gates. Source route exists, real records not established.
- Registrar readiness: POST /v1/registration-readiness/evaluations and /:id/evaluate; gateway handlers exist, inspected start.ts does not pass registrationReadiness dependency. Wiring, service schema and institution approval remain required.
- Consequential action/registrar: POST /actions/prepare, /commit, /reconcile. No generic create-course API is inferred from these routes.
- Course Studio: domain target needs authoring, immutable release, section scopes, submissions, feedback and grades. Gateway adapter boundary is a potential integration surface, not verified Course Studio CRUD endpoints. No new route name invented here.
- AI answer/coplan: GET /v1/intelligence/policy, POST /respond, POST /actions/:id/confirm. Provider/policy/data/budget gates remain.
- Device/privacy: app preference, OS permission, consent and session revocation are different contracts. Gateway auth revalidation is only one layer; privacy CRUD endpoints not verified in this inspection.
- Board/investor: company-only sources and immutable approved aggregates; financial reporting/data-room endpoints not verified here. Do not send raw student records to company reports.
- Company deck/policy/training/research: controlled documents, not necessarily APIs. Stable IDs/version/review/disclosure and ownership required.
Exact new code changes in this delivery: documentation, API catalog and reviewed test orchestration. No runtime gateway, adapter, auth, DDL or feature enablement modifications. A production implementation diff requires inspecting the relevant existing service, schema and test seams first.
