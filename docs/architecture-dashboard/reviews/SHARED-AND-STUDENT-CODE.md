# Shared-service and student-code review — repository inspection 2026-10-13
Status: source review only. Default-ref files were inspected individually; no commit-wide immutable snapshot or repository tests were run.

## Shared authorization: app/src/lib/capabilities.ts
Blob SHA: 7e27dd80a42c759841ff94fec590a508f164d96e.
readGrants accepts array-shaped rows with capability/scope_kind/scope_id string fields. forSchool matches exactly scopeKind=school and the requested non-empty scope ID; a platform grant does not implicitly become a school grant.
loadMyCapabilitiesOrThrow verifies the current authenticated account and rejects an expected-account mismatch. RPC failures throw, distinguishing failed discovery from an empty grant set. useCapabilityDiscovery is account-keyed and revision-guarded; a late response for account A cannot render as account B's grants. Navigation discovery authorizes nothing; canonical server/RLS policy still decides object/data access.
Review next: actual my_capabilities and private.has_capability SQL, object policies, negative tenant tests, expiry/revocation at execution and account-switch cache cleanup. These were not inspected or tested here.

## Device permissions: app/src/lib/permissions.ts
Blob SHA: 159465b1c31e1e92a9c00758fc2d1186b5bd8a5c.
This is browser/device permission presentation, NOT institution authorization. It reads camera/microphone/location/notification status and names fallbacks. It does not ask for all permissions on arrival. Unreported and unsupported states are separate. Camera/mic/location revocation points to browser settings; notifications have a separate push-subscription path.
Review next: feature-level two-stage ask, settings change observation, push revocation and accessible fallback. No real device permission test performed.

## Name collision: app/src/lib/membership.ts
Blob SHA: 3125f2e76f20eb248bac35737ce45496f961c2bb.
Despite the name, this module handles Semester Plus subscription/billing flows, NOT institutional organization memberships. Do not map it to shared.org.memberships by filename. Its subscription read explicitly distinguishes a failed read from no subscription, and narrows reads to individual billing accounts. Server billing authority and commercial activation were not verified.

## Institution claims: app/src/lib/readiness.ts
Blob SHA: 9adb03cafef4a29d526209da31281af4bf2fda42.
This derives institution integration/relationship claim readiness, NOT the student's registration checklist. A public data pack or URL cannot prove a connection/customer relationship. readinessOf clamps earned software capability by declared relationship ceiling. connectionsFrom counts only reported connected states; mayClaimCustomer requires institutional-customer. Do not infer institution approval from catalog depth or a frontend 'connected' label. Comments about current adapter emptiness were not independently verified in this session.

## Student actions: app/src/lib/registration-actions.ts
Blob SHA: 93c22ea2d2378fc69745e3d5e2a9188d83edbf8b.
registrationActions takes RegistrationDayData, cart, catalog and current time. It returns no readiness actions outside Registration Day Mode. Inside mode:
1. Missing time generates regday:time, labelled student_entered.
2. Empty cart generates regday:cart and returns that bounded set.
3. readiness(data, cart, catalog) derives unbacked sections and conflicts.
4. Each missing backup gets stable regday:backup:<section id>.
5. Conflicts get regday:conflicts, with greater urgency when opening is near.
6. Unticked checklist items get regday:check:<id>, labelled student_entered.
All primary actions navigate to the registration workspace. None enrolls a student or claims live holds/seats. Stable IDs preserve snooze/dismissal across renders. LIMITS explicitly disclose official-system boundaries.
Review next: registration-day and Action Center callers, time/DST tests, imported-source age, stable dismissal semantics and official handoff. Those modules/callers were not fully inspected here.

## Implementation conclusion
The reviewed files support specific source-level behaviors, not a claim that all 13 shared services or the full student journey are production-complete. AI gateway, audit, files, sessions, outbox and institution membership require their own server code and target review. The dashboard publishes architecture metadata only, not these private repository excerpts.
