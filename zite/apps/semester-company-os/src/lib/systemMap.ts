// System map, stack options and module dependencies for the simulator. Pure data + functions; tested.
// Verification labels come from docs/execution/zite-capability-assessment.md (22 Oct 2026). Do not upgrade a label
// without evidence.

export type Verification = 'Verified in this workspace' | 'Docs only' | 'Not yet verified' | 'Not supported on Zite' | 'External';
export type Node = { id: string; layer: 'Education Experience' | 'Institution OS' | 'Company OS' | 'Shared platform' | 'Data & workers' | 'External'; name: string; purpose: string; owner: string; dataClass: string; permission: string; deployment: string; status: string; verification: Verification; dependsOn: string[] };

export const NODES: Node[] = [
  { id: 'site', layer: 'Company OS', name: 'Public site', purpose: 'Approved claims, pilot and pricing requests', owner: 'Founder', dataClass: 'Contact data', permission: 'Public; write-only intake', deployment: 'Zite external app (semester-site)', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: ['db', 'audit'] },
  { id: 'student', layer: 'Education Experience', name: 'Student workspace', purpose: 'Today, plan, learn, help, campus, progress, you', owner: 'Founder', dataClass: 'Personal + education record', permission: 'Membership + owner', deployment: 'Zite external app (semester)', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: ['identity', 'tenancy', 'audit', 'search', 'ai', 'notify'] },
  { id: 'faculty', layer: 'Education Experience', name: 'Faculty and TA workspace', purpose: 'Gradebook, grading queue, regrades, course AI policy', owner: 'Founder', dataClass: 'Education record', permission: 'Instructor of section', deployment: 'Zite external app (semester)', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: ['identity', 'tenancy', 'audit'] },
  { id: 'advisor', layer: 'Education Experience', name: 'Advisor workspace', purpose: 'Caseload, appointments, consented student shares', owner: 'Founder', dataClass: 'Education record (consented)', permission: 'Advisor + live consent', deployment: 'Zite external app (semester)', status: 'verified_in_test', verification: 'Verified in this workspace', dependsOn: ['identity', 'tenancy', 'consent', 'audit'] },
  { id: 'family', layer: 'Education Experience', name: 'Family portal', purpose: 'Guardian sees only what a student shares', owner: 'Founder', dataClass: 'Education record (consented)', permission: 'Live consent', deployment: 'Zite external app (semester-family)', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: ['identity', 'consent', 'audit'] },
  { id: 'console', layer: 'Institution OS', name: 'Institution console', purpose: 'Memberships, roles, connectors, audit, feature status', owner: 'Founder', dataClass: 'Institutional', permission: 'Administrator', deployment: 'Zite external app (semester /console)', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: ['identity', 'tenancy', 'audit', 'integrations'] },
  { id: 'registrar', layer: 'Institution OS', name: 'Registrar operations', purpose: 'Enrollment queue, overrides, holds, regrades', owner: 'Founder', dataClass: 'Education record', permission: 'Staff/Administrator + two-person rule', deployment: 'Zite external app (semester /staff)', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: ['identity', 'tenancy', 'audit', 'workflow'] },
  { id: 'companyos', layer: 'Company OS', name: 'Company OS', purpose: 'Tenants, requests, risks, release evidence, simulator', owner: 'Founder', dataClass: 'Company + aggregates only', permission: 'Org members (internal app)', deployment: 'Zite internal app (semester-company-os)', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: ['db', 'audit'] },
  { id: 'identity', layer: 'Shared platform', name: 'Identity and sign-in', purpose: 'Email link, Google; SAML for institutions', owner: 'Founder', dataClass: 'Personal', permission: 'Platform session', deployment: 'Zite auth', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: [] },
  { id: 'sso', layer: 'Shared platform', name: 'Institutional SSO (SAML)', purpose: 'University IdP sign-in', owner: 'Engineering', dataClass: 'Personal', permission: 'Institution-configured', deployment: 'Zite (unverified) or external IdP', status: 'not_started', verification: 'Not yet verified', dependsOn: ['identity'] },
  { id: 'tenancy', layer: 'Shared platform', name: 'Tenancy and authorization', purpose: 'Membership, roles, tenant scope in every endpoint', owner: 'Founder', dataClass: 'Institutional', permission: 'Server-side only', deployment: 'Endpoint code (requireAccess, tenantScope)', status: 'verified_in_test', verification: 'Verified in this workspace', dependsOn: ['identity', 'db'] },
  { id: 'consent', layer: 'Shared platform', name: 'Consent and delegation', purpose: 'Scoped, expiring, revocable shares', owner: 'Founder', dataClass: 'Personal', permission: 'Owner grants', deployment: 'Consents table + endpoints', status: 'verified_in_test', verification: 'Verified in this workspace', dependsOn: ['tenancy', 'audit'] },
  { id: 'workflow', layer: 'Shared platform', name: 'Workflow and approvals', purpose: 'Approval requests, two-person rule', owner: 'Founder', dataClass: 'Institutional', permission: 'Approver ≠ requester', deployment: 'Tasks table + endpoints', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: ['tenancy', 'audit'] },
  { id: 'audit', layer: 'Shared platform', name: 'Audit log', purpose: 'Who did what, when, under what authority', owner: 'Founder', dataClass: 'Restricted', permission: 'Write by endpoints', deployment: 'Audit Events table (not append-only)', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: ['db'] },
  { id: 'search', layer: 'Shared platform', name: 'Permission-aware search', purpose: 'Own records + tenant catalog', owner: 'Founder', dataClass: 'Mixed', permission: 'Filtered before return', deployment: 'Endpoint code', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: ['tenancy'] },
  { id: 'ai', layer: 'Shared platform', name: 'AI gateway', purpose: 'Course rules, data classes, cited answers', owner: 'Founder', dataClass: 'Public catalog only to provider', permission: 'Consent + course policy', deployment: 'Endpoint + OpenAI integration', status: 'verified_in_test', verification: 'Verified in this workspace', dependsOn: ['tenancy', 'search', 'audit'] },
  { id: 'notify', layer: 'Shared platform', name: 'Notifications', purpose: 'In-app messages', owner: 'Founder', dataClass: 'Personal', permission: 'Recipient', deployment: 'Messages table', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: ['db'] },
  { id: 'files', layer: 'Shared platform', name: 'Files', purpose: 'Submissions, documents', owner: 'Engineering', dataClass: 'Education record', permission: 'Must be scoped', deployment: 'Zite uploads are public by URL → external store needed', status: 'specified', verification: 'Not supported on Zite', dependsOn: ['tenancy'] },
  { id: 'billing', layer: 'Shared platform', name: 'Billing and entitlements', purpose: 'Contracts, invoices, entitlements', owner: 'Founder', dataClass: 'Commercial', permission: 'Company finance', deployment: 'Not built; Stripe connection exists in workspace', status: 'not_started', verification: 'Not yet verified', dependsOn: ['db', 'webhooks', 'transactions'] },
  { id: 'integrations', layer: 'Shared platform', name: 'SIS / LMS connectors', purpose: 'Approved reads, reconciliation', owner: 'Engineering', dataClass: 'Education record', permission: 'Institution-authorized', deployment: 'Not built (toggles only)', status: 'specified', verification: 'Not yet verified', dependsOn: ['webhooks', 'jobs', 'tenancy'] },
  { id: 'db', layer: 'Data & workers', name: 'Database', purpose: 'Transactional records', owner: 'Platform', dataClass: 'All', permission: 'Endpoints only (no RLS)', deployment: 'Zite database', status: 'implemented_unverified', verification: 'Verified in this workspace', dependsOn: [] },
  { id: 'transactions', layer: 'Data & workers', name: 'Multi-record transactions', purpose: 'Atomic commits', owner: 'Platform', dataClass: '—', permission: '—', deployment: 'Not available on Zite', status: 'not_started', verification: 'Not supported on Zite', dependsOn: [] },
  { id: 'jobs', layer: 'Data & workers', name: 'Scheduled jobs', purpose: 'Sync, reminders, outbox', owner: 'Platform', dataClass: '—', permission: 'Server', deployment: 'Zite schedules', status: 'not_started', verification: 'Docs only', dependsOn: [] },
  { id: 'webhooks', layer: 'Data & workers', name: 'Signed webhooks', purpose: 'Provider events', owner: 'Platform', dataClass: '—', permission: 'Signature check', deployment: 'Zite webhook triggers (editor)', status: 'not_started', verification: 'Not yet verified', dependsOn: [] },
  { id: 'staging', layer: 'Data & workers', name: 'Staging environment', purpose: 'Test without live data', owner: 'Platform', dataClass: 'Synthetic', permission: '—', deployment: 'Second workspace needed', status: 'not_started', verification: 'Not supported on Zite', dependsOn: [] },
  { id: 'sis', layer: 'External', name: 'Institution SIS / LMS / IdP', purpose: 'Authoritative records', owner: 'Institution', dataClass: 'Education record', permission: 'Contract + authorization', deployment: 'External', status: 'not_started', verification: 'External', dependsOn: [] },
  { id: 'openai', layer: 'External', name: 'OpenAI', purpose: 'Answer drafting from catalog text', owner: 'Vendor', dataClass: 'Public catalog only', permission: 'Server-only key', deployment: 'External', status: 'implemented_unverified', verification: 'External', dependsOn: [] },
];

export const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

/** Everything a node needs, transitively, in dependency order (no duplicates, cycle-safe). */
export function prerequisites(id: string, seen = new Set<string>()): string[] {
  const out: string[] = [];
  for (const d of byId[id]?.dependsOn ?? []) {
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(...prerequisites(d, seen), d);
  }
  return [...new Set(out)];
}

const READY = new Set(['implemented_unverified', 'verified_in_test', 'pilot_enabled', 'production_operated']);
/** For a set of modules to enable, which prerequisites are missing (not built, or not supported here). */
export function missingFor(enabled: string[]): { module: string; missing: { id: string; name: string; why: string }[] }[] {
  return enabled.map((m) => ({
    module: m,
    missing: prerequisites(m).map((p) => byId[p]).filter(Boolean)
      .filter((p) => !READY.has(p.status) || p.verification === 'Not supported on Zite')
      .map((p) => ({ id: p.id, name: p.name, why: p.verification === 'Not supported on Zite' ? 'not supported on Zite' : p.status.replace(/_/g, ' ') })),
  }));
}

export const STACK_AREAS = ['Frontend', 'Backend', 'Database', 'Authentication', 'Worker runtime', 'Search', 'Files', 'Notifications', 'AI gateway', 'Billing', 'Payments', 'Observability'] as const;
export const STACK_OPTIONS = ['Zite-native', 'External backend', 'Custom deployment', 'Not yet selected'] as const;
/** What Zite-native means for each area today, with its verification label. */
export const ZITE_FIT: Record<(typeof STACK_AREAS)[number], { verification: Verification; note: string }> = {
  Frontend: { verification: 'Verified in this workspace', note: 'React apps, external and internal' },
  Backend: { verification: 'Verified in this workspace', note: 'Typed endpoints; no transactions' },
  Database: { verification: 'Verified in this workspace', note: 'No RLS, constraints or staging copy' },
  Authentication: { verification: 'Verified in this workspace', note: 'Email link + Google; SAML not verified' },
  'Worker runtime': { verification: 'Docs only', note: 'Schedules; retries/dead letters unverified' },
  Search: { verification: 'Verified in this workspace', note: 'Endpoint-filtered queries' },
  Files: { verification: 'Not supported on Zite', note: 'Upload URLs are public' },
  Notifications: { verification: 'Verified in this workspace', note: 'In-app; Zite email available' },
  'AI gateway': { verification: 'Verified in this workspace', note: 'Endpoint gate + OpenAI, catalog-only' },
  Billing: { verification: 'Not yet verified', note: 'Not built' },
  Payments: { verification: 'Not yet verified', note: 'Stripe connection exists; webhooks unverified' },
  Observability: { verification: 'Docs only', note: 'Endpoint run logs; no alerting' },
};

/** Data-flow trace for one real workflow in this build: a registration request. */
export const FLOW = [
  { step: 'UI', detail: 'Registration page → Submit registration request (confirm dialog previews the effect)', where: 'apps/semester/src/pages/Registration.tsx', boundary: '' },
  { step: 'Session', detail: 'Platform verifies the signed-in user; endpoint has authenticated: true', where: 'Zite auth', boundary: 'Identity' },
  { step: 'Permission', detail: 'requireAccess (active membership) + tenantScope (only this institution’s sections)', where: 'lib/server.ts', boundary: 'Tenant' },
  { step: 'Command', detail: 'registration.submit re-runs readiness server-side; refuses with the first blocker', where: 'api/registration.ts + lib/readiness.ts', boundary: '' },
  { step: 'Audit', detail: 'Audit row written before the change (no transaction available)', where: 'Audit Events', boundary: 'Restricted' },
  { step: 'Database', detail: 'Planned enrollments → Requested', where: 'Enrollments', boundary: 'Education record' },
  { step: 'Outbox / worker', detail: 'Not built: no durable outbox; SIS hand-off is manual by the Registrar', where: '—', boundary: 'Gap' },
  { step: 'Read model', detail: 'Registrar Enrollment queue and the student’s Registration status read the same rows on next load', where: 'api/staff.ts, api/registration.ts', boundary: '' },
  { step: 'Notification', detail: 'Registrar decision sends an in-app notification; SIS stays authoritative', where: 'Messages', boundary: 'Authoritative source: SIS' },
];
