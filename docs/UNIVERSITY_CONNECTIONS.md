# University connection handoff

Updated September 13, 2026. No university credentials or approved API access have been supplied. This package adds an executable gateway framework, a typed adapter interface, a records/action client, and local preparation tools. It does **not** contain working Canvas, Brightspace, SIS, email, payment, or campus-service adapters. Those must be implemented and tested against the institution's approved systems.

## What is built

- `packages/institution/contract.ts`: 37 service areas, six roles, connection state, paginated records, action form fields, immutable review, and receipt shapes.
- `server/institution/auth.ts`: Supabase Auth server validation through `getUser(token)`; university membership comes only from server-controlled `app_metadata.semester`. Editable profile preferences and `user_metadata` do not grant access.
- `server/institution/adapter.ts`: approved adapter contract for status, list, get, review, execute, and reconciliation. Adapters receive verified user/institution identity and must enforce the provider's per-record grants and policy rules.
- `server/institution/gateway.ts`: exact-origin policy, authenticated requests, tenant-scoped adapter lookup, capability checks, input limits, user rate limits, validation, current-record-version checks, ten-minute reviews and explicit confirmation.
- `server/institution/journal.ts`: encrypted prepared payloads/receipts in a durable SQLite journal, atomic execution claims, audit metadata, and duplicate suppression for processing, pending, or uncertain operations. A single review ID is the upstream idempotency key.
- `src/screens/University.tsx`: service launcher, local role-oriented preparation drafts, read-only school connection status, paginated record search, provider-supplied action forms, review/confirm and receipt lookup. School records and receipts remain in memory; they are not copied into browser draft storage or AI context.
- `supabase/`: the original application's backend functions and schemas, restored from the supplied original repository. No migrations were applied and no functions were deployed.

## Connect an approved institution later

1. Register the deployment with the school. Establish the data agreement, system owners, approved scopes, identity provider and account lifecycle. Use a sandbox before real student records.
2. Keep the existing frontend Supabase account configuration. Copy `server/institution/.env.example` to `server/institution/.env` and configure the **same** Auth project, exact application origin, institution name, private journal path and a random journal encryption key. Keep this file outside source control and the frontend build.
3. Assign verified membership on the server through the approved identity provisioning process. Example **shape only**, never accepted from a client:

   ```json
   { "semester": { "institutionId": "school-id", "roles": ["student"] } }
   ```

   This lives in the authenticated user's `app_metadata`; it is not a role-picker setting. The `institutionId` must match a server-registered adapter. Cross-institution users need a future verified membership-switching flow; the current contract resolves one active institution.
4. Implement `InstitutionAdapter` for each approved service and register the implementation in `server/institution/adapters.ts`. Its registry is intentionally empty today. Map vendor IDs consistently to the existing `packages/contract` course/item IDs; do not replace the core store or overwrite student edits.
5. Supply provider credentials through the server's secret manager and implement delegated OAuth/SSO, refresh, revocation and disconnect as required by that provider. The generic gateway does not implement vendor OAuth flows. Scope `status`, `list`, `get`, `review`, `execute` and `reconcile` to the authenticated person. Validate ownership, roster grants, authorized payer/advisee consent, prerequisites, holds, eligibility and every object version at the upstream transaction boundary.
6. Run the gateway on Node 24.19 or later:

   ```sh
   npm run check:university
   npm run dev:university
   ```

   The default listener is `127.0.0.1:8787`. Use an HTTPS reverse proxy for deployment. Configure the frontend's public `VITE_UNIVERSITY_GATEWAY_URL` with that trusted gateway URL and rebuild. This URL is an address, never a secret. Do not enable a gateway belonging to a different operator: Semester's session token is sent to the configured gateway for verification.
7. Test one service at a time with school-provided fixtures and test accounts. In Semester, open **University → School connections → Check school access**. Then use **Connected records** to load records. Official action buttons are rendered only for capabilities and actions returned by the school adapter.

## HTTP interface

All endpoints except `/health` require `Authorization: Bearer <Semester Auth access token>`. All responses use `Cache-Control: no-store`. POST requests must use JSON, at most 128 KB. No uploaded document bytes or arbitrary proxy URLs are accepted by this interface.

| Endpoint | Behavior |
| --- | --- |
| `GET /health` | Version and service name; no school records. |
| `GET /status` | Verified institution, roles and per-service connection/permission status. |
| `GET /records?area=...&search=...&cursor=...` | Adapter-paginated records scoped to the person. |
| `POST /actions/prepare` | Validate action fields and source record version; save a ten-minute, user-bound review. Does not submit anything. |
| `POST /actions/commit` | Requires `reviewId` and `confirmed: true`; rechecks access, version and displayed terms, then atomically claims the operation. |
| `POST /actions/reconcile` | Looks up a previous operation by review ID without performing it again. |

A completed receipt is evidence of the adapter's official outcome, not merely a successful HTTP request. If a system only acknowledges a queue, return `pending`. A timeout or uncertain write must be reconciled using the same upstream idempotency key. The framework prevents another review from executing the same record/action while its previous operation is pending or uncertain. Provider-side idempotency and record version checks are also required; a local journal alone cannot make an upstream system transactional.

## Data and deployment limits

- The journal is for a single host with persistent storage. Multi-instance deployment needs a shared transactional database and distributed limits. Do not place SQLite on an ephemeral filesystem or directly expose the gateway port.
- Payloads and receipts use AES-256-GCM; keep the 32-byte key in managed secret storage with backup/rotation procedures. Losing the key makes retained content unreadable. Actor, institution, service and event metadata are retained for audit and need a protected volume.
- Default cleanup removes abandoned ready reviews after one day, completed reviews after 90 days and audit metadata after 180 days. Pending, processing and uncertain rows remain until reconciled. Adapt retention to the institution's approved policy. The startup timer runs cleanup hourly.
- The UI's local preparation drafts are stored per browser origin, account key and term. They are not institution-approved student records or part of the original cloud backup. Export them separately. Avoid medical details, card data and identity documents in these drafts.
- Payments require a separately approved hosted/tokenized payment flow and signed webhook verification. Do not add card-number fields to generic action forms.
- File submissions need provider-scoped uploads, size/type validation, malware scanning, retention and receipt handling. This gateway currently transports metadata/form text only.
- High-stakes assessments still need native attempt lifecycle, server-enforced timing, accommodations, autosave, grading, submission recovery and institution acceptance testing. Existing quizzes/exams are practice tools.
- Full faculty gradebooks, advisor rosters, admin provisioning, reporting, campus inventories and live university inbox behavior remain domain-specific implementation work.
- This is an integration foundation, not a FERPA certification, a WCAG compliance claim, a VPAT, a penetration test, or a production security approval.

## Validation references

The auth boundary follows [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser) and its distinction between [editable user data and protected identity metadata](https://supabase.com/docs/guides/auth/users). The durable journal uses [Node's SQLite API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html). Tests use controlled identities and adapters; no university API or real transaction was exercised.

## Family and lifecycle integration boundary

`packages/institution/family-policy.ts` is a deny-by-default policy function with focused tests. It is not wired into a family API and it must never be fed browser permission plans as authoritative grants. Before enabling family services, implement a protected grant store, single-use expiring invitation tokens, recipient verification and acceptance, student resource selection, field-level projection, immediate revocation, access-event logging and consent changes. Apply policy on every read, search, file download, AI context retrieval and payment preparation/execution. A `payer` role alone never authorizes a student's record. Payment-only grants do not expose statements. Family members cannot act as the student or submit career applications.

`src/screens/Family.tsx` stores private local plans and a manually selected preview. It has no invitation endpoint and sends no messages. Family and Pathway stores are independent of academic term; signing in changes their storage scope but does not migrate local drafts automatically.

Additional service IDs include student records/transcripts, admissions, orientation, graduate education, research/ethics, international services, accessibility, appeals, directory, graduation, family and support. These remain generic preparation and transport surfaces. Implement per-service schemas, verified membership, lifecycle transitions, records retention, officially sourced data, uploads, signatures and upstream receipts before marking them operational.

The Pathway stage selector and self-reported application statuses are not trusted identity attributes. The local workflow history is not an institutional audit log. Clinical, medical, identity and protected research data must stay out of local preparation notes.
