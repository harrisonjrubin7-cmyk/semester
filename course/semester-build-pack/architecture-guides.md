# Semester architecture guides - proposed implementation baseline

## Evidence and status
The uploaded docs/platform/DEVELOPER_PLATFORM_AND_MARKETPLACE.md describes a design-stage platform and no published API. docs/guides/Developer Guide.html documents strict TypeScript, Zod validation, user-scoped access, worker-only service roles and audited mutations. This pack does not establish current live repository status. No certifications or production guarantees are claimed.

## 1. System and trust boundaries
Reuse the Semester account, Action Center, search, workspace and design system. The developer console is a control plane, not unrestricted database administration. Public documentation, publisher organization membership, app permissions and institutional approval are separate boundaries. Learning drafts remain private until an authorized submission; official grades require institutional authority. Native domain services own canonical entities; connector adapters carry source identifiers, freshness and reconciliation evidence.

## 2. Gateway request sequence
TLS/edge limits -> route/environment resolution -> content and size validation -> token verification -> principal/app resolution -> active installation/grant -> tenant/purpose policy -> service object/property policy -> tenant-aware transaction -> audit/outbox -> response allowlist -> redacted telemetry. Database RLS is defense in depth. Never authorize from a supplied tenant header alone. Fail closed if required policy dependencies are unavailable. Protected mutation audit metadata commits transactionally.

## 3. Identity profiles
Portal: server-managed session/BFF, secure cookies and CSRF defenses. Public native clients: authorization code with PKCE S256. Confidential clients: code/PKCE plus supported client authentication. Machine integrations: approved client-credentials profile, narrowly scoped to environment and installation. Workers: dedicated workload identity. No implicit or password grants. Validate signatures, allowed algorithms, issuer, audience, token type and time claims; ID tokens are not access tokens. Key discovery uses trusted issuer configuration, not token-supplied URLs. Publish token lifetimes and refresh/rotation rules only after review.

## 4. Authorization and revocation
Evaluate identity, app, environment, installation, active grant, tenant, purpose, resource and property policy. Scope alone is insufficient. Tenant/environment appear in cache keys, storage policy and cursor bindings. Reauthorize queued jobs, retries and replay. Revocation invalidates caches, blocks issuance/access, pauses subscriptions, stops queued work and starts offboarding. Measure propagation before adopting a target.

## 5. API contract rules
The accompanying OpenAPI 3.1 contract proposes 70 operations. Base URLs are deliberately absent; identity.example.invalid is a placeholder. Errors carry code/message/retryable/requestId. Collections have opaque cursors bound to query and authorization context. Writes require idempotency keys bound to principal/app/tenant/environment/operation/request digest. Same key/different digest conflicts. Store result atomically with the operation. PATCH uses If-Match; successful mutable reads and writes must publish ETag in implementation. Schema fields not in the allowlist are rejected. Membership and credential changes require recent reauthentication. No public generic state setter may bypass approval workflows.

## 6. Events and webhooks
Use a transactional outbox and bounded workers. Assume duplicates and no global ordering. Envelope: eventId, type, schemaVersion, resourceId, resourceVersion, occurredAt and provenance; include minimal payload. Sign raw bytes with a reviewed signature scheme, timestamp and key identifier; recipients enforce replay windows and deduplication. Publish canonical signing rules before implementation. Constrained egress validates destination at registration and connect time, rejects internal/private/link-local/metadata destinations, handles DNS rebinding, disables redirects and bounds responses. The week-13 literal-IP drill is not a production SSRF defense.

## 7. SDK design
Proposed packages: @semester/contracts, @semester/sdk, @semester/sdk-server, @semester/testing. Generate transport types from an approved contract; validate unknown network values at runtime. strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes and useUnknownInCatchVariables enabled. Branded identifiers distinguish resources but do not authorize. Browser package excludes secrets and server dependencies. Inject token providers; no automatic persistent storage. Retry only transient operations with explicit idempotency for writes, bounded attempts/elapsed time and Retry-After handling. Support cancellation and timeouts. Contract drift, type misuse and browser-bundle leakage tests gate release.

## 8. Learning and grading boundary
Learner code never executes in the portal server. Production grading requires disposable isolated workers, no credentials, network disabled by default, bounded CPU/memory/time/output, no host mounts or privileged runtime, pinned dependencies, inaccessible hidden tests and cleanup. The included grader is ONLY for trusted local exercises: a subprocess timeout is not a sandbox. Learner code can access the local account and tamper with tests; therefore results are instructional feedback, not trusted institutional assessment.

## 9. AI policy
Existing project standard says no student records to AI. Use approved documentation and synthetic fixtures only. AI cannot grant permissions, certify, publish official grades or independently change registration. Student declarations explain allowed assistance; instructor remains assessment authority.

## 10. Release and recovery
Inventory current repository before introducing duplicate infrastructure. CI gates types, contracts, unit tests, RLS, negative authorization, end-to-end and accessibility. Preview/staging are not production. Evidence ties digest, environment, test version and verifier. Activation requires certification, institution decision, reconciled pilot, rollback and support. Recovery drills include connector outage, duplicate events, partial import and grant revocation. Do not promise recovery metrics until measured.

## 11. Contract omissions and decisions before production
This control-plane contract does not implement OAuth endpoints, binary artifact uploads, marketplace billing, domain-record APIs or curriculum APIs. Evidence references artifacts provisioned by a separately reviewed artifact service. Signing algorithm, lifetimes, retention windows, rate quotas, incident timelines and legal terms remain approval decisions. Full OpenAPI semantic validation and implementation conformance are still required.

## Sources
Project: docs/platform/DEVELOPER_PLATFORM_AND_MARKETPLACE.md and docs/guides/Developer Guide.html are cited by the project brief but are not in this repository, so the project-specific claims above are not verified against them here.
OAuth security baseline: RFC 9700 (https://www.rfc-editor.org/rfc/rfc9700.html).
API risk baseline: OWASP API Security Top 10 2023 (https://owasp.org/API-Security/editions/2023/en/0x11-t10/).
These are references for implementation review, not claims of compliance.
