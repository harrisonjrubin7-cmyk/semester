# Stream 29: Semester Account & Identity + Semester Mail

Source: `docs/system/Semester Account and Mail.pdf`. Prototype: `#/os/account` (`AccountIdentity.jsx`). Extends the canonical identity/tenant/membership model and stream 02; not a second auth system. Prerequisite: the security/tenancy NO-GO items (security-definer/RLS, tenant AI policy) are fixed.

## Rules
- Four separate things: immutable account ID, username (controlled change), Semester email (only if Mail activated), institutional status (only from the school's SSO/invitation/verified membership).
- External sign-in keys on provider `sub`, never email.
- Signup: existing email → verify recovery → username (format, reserved/impersonation list, uniqueness) → passkey + recovery codes → personal workspace → optional institution → optional mail.
- Account Center: profile, contacts, passkeys, recovery, sessions (revoke), institutions, authorized apps, privacy/export/deletion, entitlements, security events, support access. Username change, linking, recovery change, export, deletion are workflows.
- Linking never merges on matching email strings; require proof of control of both, show contents, user chooses, audit.
- Mail states, labelled honestly: reserved username · forwarding · full mailbox. Never call forwarding an inbox.
- Deliverability gate: SPF + DKIM + DMARC alignment before sending; rate limits, progressive privileges, spam/phishing/malware, bounces/complaints, reputation monitoring, abuse owner. Subdomains don't isolate reputation.
- Mail → education suggestions (calendar, career, task) show source, uncertainty, approval; mail never becomes an official record. Email, messages, notifications, Action Center stay distinct. AI drafts; user sends.
- Offboarding: re-evaluate roles, preserve personal identity, explain remaining services, export, retain official records, remove expiring access, audit record. Personal vs institution-governed spaces never mix.
- "Continue with Semester": OIDC, minimal scopes, app-specific identifiers, explicit consent screen; records/affiliations separately governed; ships last.
- Domain: Semester legal entity owns it; no .edu (accredited institutions only); no implied affiliation or discounts.

## Releases
0 reconciliation · 1 Semester Account · 2 institutional continuity · 3 forwarding pilot · 4 Semester Mail · 5 education connections · 6 identity ecosystem — each with the activation gate in the prototype.

## Acceptance (13)
See prototype Releases tab; all must have evidence before production.

## Architecture blueprint (Oct 7 2026)
Source: `docs/system/Education Ecosystem Architecture Blueprint.pdf`. Prototype tabs: Architecture, Multiple schools, Mail architecture, Roadmap.
- Layers: experience → identity & policy (Semester OIDC provider + school federation broker OIDC/SAML) → native domain services (modular monolith) → data & integration (tenant-isolated).
- Web: Authorization Code + PKCE (S256) via backend-for-frontend; tokens server-side; Secure HttpOnly SameSite cookie + CSRF. Native: system browser + PKCE + OS secure storage. Validate signature, iss, aud, exp, nonce. No shared broad cookie across subdomains.
- Access = active account + membership + capability + scope + policy + consent + workflow state → allowed / denied / step-up / approval required. School permissions not in long-lived tokens.
- Linking: authenticate both, confirm, check conflicts, add mapping (unique per connection issuer+subject), security event + notice, resolve membership separately.
- Workspace switch verified server-side; client tenant ID never authority; search/files/notifications/exports/AI share the boundary. Ending one school preserves others and personal data.
- Mail: inbound MX → validation/auth → spam/malware → queue → store → scoped index → UI; outbound composer → JMAP/submission → send-as auth → quota/abuse → queue → DKIM + SMTP → bounces. Control vs data plane. Personal / institution-managed / shared mailboxes. No open relay; tested backup/restore/export. Email text is untrusted input for AI. Not end-to-end encrypted unless built.
- Roadmap gates: software ecosystem → managed device experience (no personal-device surveillance; session revoke ≠ wipe) → partner reference hardware only with demonstrated need and economics.

## OIDC IdP, domain routing, JMAP storage, phases 1–3 (Oct 7 2026)
Source: `docs/system/OIDC IdP, Domain Routing and Mail Storage Spec.pdf`. Prototype tabs: Domains & issuer, Mail storage, Phases 1–3.
- Contract: one identity + many memberships; authn ≠ authz; personal vs institution scopes; addresses/usernames/affiliations are attributes; shared primitives; reconciliation/rollback/portability; routes and client tenant IDs never grant authority.
- Hosts D, app.D, identity.D, account.D, mail.D, status.D (placeholders); Host allowlist; ignore untrusted forwarded host; exact redirect URIs (RFC 9700); host-scoped cookies; monitored certs; approved DNS changes. Custom school domain: authorization → DNS challenge → mapping → cert → isolation tests → activation; removal revokes mapping without deleting records.
- Identity: decide extend / front / migrate the current authority first. Maintained OIDC library. Discovery, authorize, token, jwks, userinfo, revocation, logout. Clients: first-party web (confidential, BFF), native (public, PKCE), partner, workload identity. PKCE S256 everywhere; implicit + password disabled. 9-step transaction. Federation connection record with secrets by reference and status lifecycle. Records: account, external identity (connection+issuer+subject unique), membership, role assignment, session, OAuth grant, security event (no raw tokens). Pairwise subjects for partners.
- Mail: the engine is the single mailbox source of truth; Semester holds ownership, mappings, entitlements, policy. Provisioning state machine with idempotency + reconciliation worker. Inbound success only after durable acceptance; outbound statuses accepted/queued/accepted-by-recipient/failed; no exactly-once promise. JMAP opaque states; cannotCalculateChanges → invalidate + bounded resync. Deletion across 7 layers; export round-trip tested.
- Phases: 1 identity/domains/tenancy (blocked by RLS/definer findings), 2 mail pilot, 3 multi-school suite; exit evidence and rollback per phase (never delete pilot mailboxes to roll back).

## Account resolution, TLS automation, four-quarter plan (Oct 7 2026)
Source: `docs/system/System Blueprint - Federation, Domains, TLS.pdf`. Prototype tab: Resolution, TLS, quarters.
- Resolution: no identity → approved signup/provisioning only; mapped → sign in; signed-in + new unmapped school identity → link after both auths; mapped elsewhere → conflict case; email match without mapping → no merge, prove control; suspended connection → deny.
- TLS: requested → authority → ownership challenge → verified → provider binding → routing DNS → cert pending → issued → HTTPS + isolation probes → active. Ownership proof, CA validation, routing, authorization are separate. Use the hosting provider’s managed certs if on Vercel; wildcards only when justified (*.D ≠ files.school.D). Monitor expiry, DNS drift, verification, chain, tenant mapping. Removal: suspend, revoke callbacks/sessions, purge caches, remove binding, stale-DNS notice, tombstone, re-verify before reuse; a new certificate never reactivates.
- Quarters (relative): Q1 reconcile + harden; Q2 federation + domain pilot; Q3 invitation-only mail; Q4 multi-school suite. Gates listed in the prototype. First artifact: identity-and-domain reconciliation register.

## RFC 9700 controls + RFC 8555 (Oct 7 2026)
Source: `docs/system/Security Hardening - RFC 9700 and 8555.pdf`. Prototype tab: Security hardening.
PKCE S256 for every client; exact redirect match; explicit per-host callbacks (no wildcards); state + nonce bound to session; issuer binding (mix-up); implicit and password grants disabled; refresh rotation with family reuse detection; short-lived audience-bound access tokens; private_key_jwt/mTLS for confidential clients; BFF-held tokens; no CORS on authorize; no open redirects. Reject: missing/plain PKCE, wildcard redirect, reused code (revoke family), refresh reuse (revoke family), verifier mismatch. ACME: platform-managed first, DNS-01 where needed, vaulted account keys, monitored renewal; issuance never activates routing.

## Compliance monitor (Oct 7 2026)
Source: `docs/system/RFC 9700 and 8555 Compliance Audit.pdf`. 27 controls (AUTH-01…14, OIDC-01…05, FED-01…05, SESSION-01…02, RECOVERY-01), each tested per client class (first-party web, native, school OIDC, school SAML, custom-domain callbacks, partner clients, each API audience, recovery/linking/offboarding). Record what/where/when/build; statuses not tested / pass / fail / evidence stale. No “compliant” badge from configuration. Audit hosting-provider ACME by configuration and outcomes only.
