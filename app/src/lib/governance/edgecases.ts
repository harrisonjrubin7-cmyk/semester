/**
 * The edge-case catalog: the cases the launch plan says still have to be
 * tested, each with the automated guard that already exercises it — or none.
 *
 * `docs/EDGE-CASE-CATALOG.md` is rendered from this file by
 * `edgecases.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * Two rules keep it honest.
 *
 * **A guard is a test that runs on every change**, or it is not a guard: a
 * `.test.ts`, a `.check.sql` or a smoke script. A runbook, a design document
 * or a function without a test does not count, and the test enforces the
 * shape. Every guard cited must exist.
 *
 * **A guard covers what it covers.** Most of these tests were written for a
 * narrower question than the case asks — a two-device merge of the student's
 * own state is not a double submission — so each row says in `note` what the
 * guard proves and what it does not. A case with no guard is `owed`, and the
 * count of owed cases is the finding, not a failure.
 */

export const EDGE_DOMAINS = {
  identity: 'Identity and authorization',
  data: 'Data and source quality',
  lms: 'LMS and assessment',
  ai: 'AI',
  infra: 'Integrations and infrastructure',
  commercial: 'Commercial and customer operations',
  a11y: 'Accessibility and inclusion',
  governance: 'Governance and reputation',
} as const;

export type EdgeDomain = keyof typeof EDGE_DOMAINS;

export interface EdgeCase {
  id: string;
  domain: EdgeDomain;
  /** The case, in the plan's words. */
  case: string;
  /** A test that runs on every change, or null when nothing does. */
  guard: string | null;
  /** What the guard proves and what it does not; or why nothing can yet. */
  note: string;
  /** The plan's "especially important" list. */
  critical?: true;
}

export const EDGE_CASES: readonly EdgeCase[] = [
  // ── Identity and authorization ─────────────────────────────────────────
  { id: 'EC-ID-01', domain: 'identity', case: 'User belongs to two institutions with conflicting roles.', guard: 'supabase/tenancy.check.sql', note: 'A profile is pinned to one school, so the case is refused rather than handled; there is no dual-membership model.' },
  { id: 'EC-ID-02', domain: 'identity', case: 'Student changes institution or transfer status.', guard: 'supabase/tenancy.check.sql', note: 'school_id cannot change once set. No transfer workflow exists, so the guard proves the refusal, not a migration of the student\'s data.' },
  { id: 'EC-ID-03', domain: 'identity', case: 'SSO email differs from an existing personal account.', guard: 'supabase/identity-provisioning.check.sql', note: 'First-login binding refuses a cross-domain or mismatched claim. Linking to an existing personal account is not offered.' },
  { id: 'EC-ID-04', domain: 'identity', case: 'User loses SSO eligibility mid-term.', guard: null, note: 'No institutional SSO is active for any tenant; nothing ends a session when eligibility ends.' },
  { id: 'EC-ID-05', domain: 'identity', case: 'SCIM deprovision arrives after the user started a critical workflow.', guard: 'supabase/identity-provisioning.check.sql', note: 'Deprovisioning clears roles at once. The open session and unsaved work are not addressed.' },
  { id: 'EC-ID-06', domain: 'identity', case: 'Role expires while the page remains open.', guard: 'supabase/coursestudio.check.sql', note: 'An expired or revoked faculty grant is refused at the write. The screen is not told until it tries.', critical: true },
  { id: 'EC-ID-07', domain: 'identity', case: 'Consent revoked during an active support, AI, file or search request.', guard: 'supabase/support-access.check.sql', note: 'Revoking a support grant stops the next read. AI retrieval, file and search have no consent object to revoke.', critical: true },
  { id: 'EC-ID-08', domain: 'identity', case: 'Admin accidentally grants a platform-wide role.', guard: 'supabase/role-grant-audit.check.sql', note: 'The grant is audited, not prevented; no screen can make one, so today only the service key could.' },
  { id: 'EC-ID-09', domain: 'identity', case: 'Break-glass access is used during an outage.', guard: null, note: 'No break-glass path exists. Emergency access would be the service key, which is unlogged in the product: R-02.' },
  { id: 'EC-ID-10', domain: 'identity', case: 'User is a minor, guardian consent changes, or the user reaches the age of majority.', guard: null, note: 'The minimum age is a [DECIDE] in docs/legal/; no age gate or guardian model exists.' },

  // ── Data and source quality ────────────────────────────────────────────
  { id: 'EC-DQ-01', domain: 'data', case: 'SIS says one course section; the LMS says another.', guard: null, note: 'No live SIS or LMS connection exists; precedence rules are designed in docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md, not tested.', critical: true },
  { id: 'EC-DQ-02', domain: 'data', case: 'Student-entered plan conflicts with the institution source.', guard: null, note: 'Requirements are student-typed; there is no institutional source to conflict with.' },
  { id: 'EC-DQ-03', domain: 'data', case: 'Source record is deleted, renamed or reused.', guard: 'app/src/lib/integration/quality.test.ts', note: 'Schema drift reports a removed or renamed field before records fail one by one. Record-level reuse of an identifier is not covered.' },
  { id: 'EC-DQ-04', domain: 'data', case: 'Integration sends an out-of-order update.', guard: 'app/src/lib/integration/pipeline.test.ts', note: 'A record whose source timestamp is older than the one stored is refused as a timestamp regression, and the same one is skipped. A provider that sends no timestamp is not ordered, and the deployed integration-tick function is not exercised.' },
  { id: 'EC-DQ-05', domain: 'data', case: 'Webhook is replayed.', guard: 'app/src/lib/integration/pipeline.test.ts', note: 'A delivery seen twice is counted once by its idempotency key. There is no inbound endpoint yet, so no signature or timestamp window: INT-013.', critical: true },
  { id: 'EC-DQ-06', domain: 'data', case: 'Source is stale during registration.', guard: 'app/src/components/schoolrecords.test.tsx', note: 'Stale records are labelled, never shown as current. The freshness cards are behind a flag that is off until a connection is live.' },
  { id: 'EC-DQ-07', domain: 'data', case: 'Catalog prerequisite changes after the student builds a plan.', guard: null, note: 'The catalog is a student-imported file; nothing re-checks a plan against a later import.' },
  { id: 'EC-DQ-08', domain: 'data', case: 'Time zone or daylight-saving change alters how a deadline is read.', guard: 'app/src/lib/date.test.ts', note: 'Day arithmetic across the 1 November 2026 DST end is pinned, and locale.guard.test.ts keeps every date format in one module. Deadline display in a second time zone is not tested.' },
  { id: 'EC-DQ-09', domain: 'data', case: 'Course number changes across terms.', guard: null, note: 'Courses are matched by code within an import; no cross-term identity exists.' },
  { id: 'EC-DQ-10', domain: 'data', case: 'Institution merges or splits schools, departments or programs.', guard: null, note: 'The governance hierarchy has nodes for these, and no move or merge operation.' },

  // ── LMS and assessment ─────────────────────────────────────────────────
  { id: 'EC-LMS-01', domain: 'lms', case: 'Student loses network seconds before a deadline.', guard: 'app/src/lib/offline.test.ts', note: 'Queued writes replay when the network returns. Nothing is deadline-aware, and there is no submission to lose: LMS-005.', critical: true },
  { id: 'EC-LMS-02', domain: 'lms', case: 'Autosave succeeds but the final submit acknowledgement fails.', guard: null, note: 'No assignment submission exists.', critical: true },
  { id: 'EC-LMS-03', domain: 'lms', case: 'Student submits twice from two devices.', guard: 'app/src/lib/merge.test.ts', note: 'Two devices merging the same account\'s state is tested for the student\'s own workspace. That is not a submission.' },
  { id: 'EC-LMS-04', domain: 'lms', case: 'Accommodation changes after an assessment starts.', guard: null, note: 'No assessment engine; accommodation_shares carry expiry and revoke (supabase/expansion.check.sql) but no assessment binds to one.', critical: true },
  { id: 'EC-LMS-05', domain: 'lms', case: 'Instructor changes a rubric after some grading is complete.', guard: null, note: 'No rubrics or grading workflow: LMS-006, LMS-012.' },
  { id: 'EC-LMS-06', domain: 'lms', case: 'Grade is posted, then retracted or corrected.', guard: null, note: 'No gradebook: LMS-011.' },
  { id: 'EC-LMS-07', domain: 'lms', case: 'SIS passback partially succeeds.', guard: null, note: 'No passback: INT-005 is building and writes nothing.', critical: true },
  { id: 'EC-LMS-08', domain: 'lms', case: 'Roster changes after a group assignment is made.', guard: null, note: 'No group assignments: LMS-007.' },
  { id: 'EC-LMS-09', domain: 'lms', case: 'Course is copied with an expired or broken external link.', guard: null, note: 'No course copy: LMS-001.' },
  { id: 'EC-LMS-10', domain: 'lms', case: 'Assessment item contains inaccessible media or an unsupported interaction.', guard: null, note: 'No assessment authoring.' },
  { id: 'EC-LMS-11', domain: 'lms', case: 'Academic-integrity policy changes mid-term.', guard: 'supabase/coursestudio.check.sql', note: 'A new published version of the course rules is immutable and dated, so the change is visible. What an open AI conversation does with it is EC-AI-05.' },

  // ── AI ─────────────────────────────────────────────────────────────────
  { id: 'EC-AI-01', domain: 'ai', case: 'AI source permission is revoked during generation.', guard: null, note: 'Source access is checked before retrieval at the gateway, not during a stream.', critical: true },
  { id: 'EC-AI-02', domain: 'ai', case: 'Prompt injection embedded in an uploaded document.', guard: 'app/src/ai/injection.test.ts', note: 'Structural: twelve injection-shaped texts through every prompt builder stay inside a fence and leave the instructions byte-for-byte unchanged. It does not test what a live model does with the fence; app/src/ai/injection.live.test.ts does, with a key, and has not been run — AI-010’s remaining gap.' },
  { id: 'EC-AI-03', domain: 'ai', case: 'AI cites a stale or retracted source.', guard: null, note: 'Citations point at the student\'s own sources; nothing marks one retracted.' },
  { id: 'EC-AI-04', domain: 'ai', case: 'Provider outage or a safety-filter false positive.', guard: 'app/src/ai/helpstate.test.tsx', note: 'An unreachable gateway is named to the student with a retry, and the local assistant answers when no gateway is configured. A safety-filter refusal is not distinguished from an outage.' },
  { id: 'EC-AI-05', domain: 'ai', case: 'Course policy changes while a conversation remains open.', guard: null, note: 'Policy is read when a conversation is assembled, not on every turn.' },
  { id: 'EC-AI-06', domain: 'ai', case: 'Student asks the AI to do prohibited active assessment work.', guard: 'app/src/lib/governance/ai-lifecycle.test.ts', note: 'Prohibited scopes are refused at intake (G0). The runtime policy check for a specific request is prompt text, not a test: AI-007.' },
  { id: 'EC-AI-07', domain: 'ai', case: 'AI produces a harmful, confident but unsupported recommendation.', guard: null, note: 'DO-NOT-BUILD rules 3 and 7 are held by review; no evaluation corpus scores unsupported claims: AI-011.' },
  { id: 'EC-AI-08', domain: 'ai', case: 'Model version change alters answer behaviour.', guard: null, note: 'No pinned model versions or evaluation baseline: AI-002, AI-011.' },
  { id: 'EC-AI-09', domain: 'ai', case: 'AI cost spike or rate-limit attack.', guard: 'app/src/lib/claudeclamp.test.ts', note: 'The shared key pays only for what the app itself sends: model, max_tokens, tools and effort are clamped or refused (supabase/functions/_shared/clamp.ts), and the test holds the clamp to the app\'s own requests. Which models are allowed depends on the account\'s plan (`PLAN_MODELS`; an unknown or unreadable plan is Free) and is checked before the call is counted, held by `sharedplan.test.ts` and `sharedmodels.test.ts`. Each call also reserves its worst-case dollar cost against the plan\'s monthly allowance and settles to actual usage (`add_spend`, supabase/functions/_shared/aispend.ts), held by `aispend.test.ts` and `supabase/ai-spend.check.sql`. The sixty-call monthly count and the provider\'s spend cap at half (MONITORING.md) are not exercised by a test.' },
  { id: 'EC-AI-10', domain: 'ai', case: 'Student deletes AI history but a linked study artifact remains.', guard: null, note: 'No link from a conversation to a saved study artifact is recorded, so nothing can be reconciled.' },

  // ── Integrations and infrastructure ────────────────────────────────────
  { id: 'EC-INF-01', domain: 'infra', case: 'OAuth refresh token is revoked.', guard: null, note: 'Disconnect now revokes the grant at Google or Microsoft (app/src/lib/revoke.ts); a revocation the provider makes on its own is not detected before the next call fails.' },
  { id: 'EC-INF-02', domain: 'infra', case: 'LTI issuer or JWKS rotates unexpectedly.', guard: 'app/src/lib/ltikey.test.ts', note: 'Key rotation and the JWKS the platform publishes are tested. A tool-side issuer change mid-term is not.' },
  { id: 'EC-INF-03', domain: 'infra', case: 'SAML certificate expires.', guard: null, note: 'SAML is not activated for any tenant; no certificate rotation process: IAM-003.' },
  { id: 'EC-INF-04', domain: 'infra', case: 'API provider returns partial success.', guard: null, note: 'No connector writes to an external system yet.' },
  { id: 'EC-INF-05', domain: 'infra', case: 'Queue consumer processes an event twice.', guard: 'app/src/lib/integration/pipeline.test.ts', note: 'Idempotency keys make the second processing a no-op in the pipeline model. The deployed integration-tick function is not exercised.' },
  { id: 'EC-INF-06', domain: 'infra', case: 'Database migration locks a critical table.', guard: null, note: 'Migration order against production\'s ledger is enforced (app/src/lib/migrationorder.test.ts); lock risk is not modelled: maturity system 5.' },
  { id: 'EC-INF-07', domain: 'infra', case: 'Backup completes but restore validation fails.', guard: 'supabase/restore.sh', note: 'The rehearsal dumps, restores into an empty database and compares six ways, on every change in CI (“Rehearse a backup and restore”). It has never run against production: R-10.', critical: true },
  { id: 'EC-INF-08', domain: 'infra', case: 'Region or provider outage.', guard: null, note: 'Single region, single provider; DR is an outline: SRE-006.' },
  { id: 'EC-INF-09', domain: 'infra', case: 'DNS or domain issue.', guard: null, note: 'The status page is served from the same host, so it would go with it.' },
  { id: 'EC-INF-10', domain: 'infra', case: 'Email provider delay sends deadline reminders late.', guard: null, note: 'Reminders are on-device notifications; no email reminders exist to be late.' },
  { id: 'EC-INF-11', domain: 'infra', case: 'Feature flag is misconfigured in production.', guard: 'app/src/lib/pagesdemo.test.ts', note: 'The one that happened: a repository variable left set turned the live site into the demo. The deploy now ignores that switch and a test runs the workflow\'s own script to prove it. Tenant flags in tenant_feature_policy have kill switches (flags.test.ts) and no baseline to drift from.', critical: true },
  { id: 'EC-INF-12', domain: 'infra', case: 'Object storage or upload outage.', guard: null, note: 'Only community media touches storage: uploadImage (app/src/community/client.ts) reserves a row, uploads, and fails with a named reason if the bucket refuses; the reservation is swept after a day (community.sql), and that sweep has no check. A signed-URL failure is dropped and the image renders without an address. Everything else — the source locker, exports, backups — lives on the device or in Postgres, so a storage outage cannot lose a student’s work. No test exercises the outage: found by the operational reality register.' },

  // ── Commercial and customer operations ─────────────────────────────────
  { id: 'EC-COM-01', domain: 'commercial', case: 'Payment webhook is delayed or out of order.', guard: 'app/src/lib/billing/webhook.test.ts', note: 'An invoice that arrives before its subscription is answered with a retry and records nothing, and a subscription change is synced with the event\'s own time; the same event again is a no-op by its provider event id (supabase/commercial.check.sql). Stripe is off until keyed (COM-001), so no real delivery has been seen.' },
  { id: 'EC-COM-02', domain: 'commercial', case: 'Student cancels during a paid term but needs an export.', guard: 'app/src/components/betapanel.test.tsx', note: 'Leaving the beta offers Export first and keeps the account. No paid term exists.' },
  { id: 'EC-COM-03', domain: 'commercial', case: 'Institution changes billing contact or purchase order late.', guard: null, note: 'Contracts, invoices and a billing_contact role exist since the commercial core (supabase/migrations/20260929070000_commercial_core.sql); nothing tests a contact or purchase order changed after an invoice is issued.' },
  { id: 'EC-COM-04', domain: 'commercial', case: 'Contract expires during finals.', guard: 'supabase/tenant-plan.check.sql', note: 'An ended plan is refused by entitlement at once. There is no grace period or read-only wind-down, which is the harm the case describes.', critical: true },
  { id: 'EC-COM-05', domain: 'commercial', case: 'Customer requests data deletion under a legal hold.', guard: 'supabase/integration-hardening.check.sql', note: 'A legal hold can be set on integration tables. Account deletion against a held row is not tested.', critical: true },
  { id: 'EC-COM-06', domain: 'commercial', case: 'Customer wants a feature enabled that the contract or entitlement does not allow.', guard: 'app/src/lib/entitlement.test.ts', note: 'Entitlement order refuses what the plan does not carry.' },
  { id: 'EC-COM-07', domain: 'commercial', case: 'Customer requests custom code that would fork the product.', guard: 'app/src/lib/governance/config-tiers.test.ts', note: 'The never-permitted list and the tiers are held; a request outside them has no configuration route.' },
  { id: 'EC-COM-08', domain: 'commercial', case: 'Customer does not complete UAT but wants to go live.', guard: 'supabase/tenant-rollout.check.sql', note: 'The rollout state machine refuses an exit gate without its evidence.' },
  { id: 'EC-COM-09', domain: 'commercial', case: 'Customer merger changes the tenant, legal entity or data scope.', guard: null, note: 'No tenant merge or rename operation.' },
  { id: 'EC-COM-10', domain: 'commercial', case: 'Customer offboards but retains archive or export requirements.', guard: null, note: 'docs/DATA-PORTABILITY-AND-OFFBOARDING.md describes the process; no institutional export exists to test.' },

  // ── Accessibility and inclusion ────────────────────────────────────────
  { id: 'EC-A11Y-01', domain: 'a11y', case: 'Focus is hidden under a sticky composer or banner.', guard: 'app/src/styles/tokens.test.ts', note: 'Every focused control carries scroll-margin equal to the header and bottom clearances, and app/src/ai/focusbar.test.tsx holds the scroller\'s scroll-padding to the Focus bar\'s inset. The clearances are constants; whether they match a bar\'s real height is measured only by app/scripts/keyboard-pass.mjs, a manual pass.' },
  { id: 'EC-A11Y-02', domain: 'a11y', case: 'Screen reader announces streamed AI text too aggressively.', guard: 'app/src/ai/streamlive.shape.test.ts', note: 'The conversation is a polite log and the streaming text is rendered aria-hidden until the turn lands, so an answer is announced once, whole; the test reads the shape of both surfaces (the full chat and the panel). No screen reader has been run over a stream (EC-A11Y-09).' },
  { id: 'EC-A11Y-03', domain: 'a11y', case: 'Chart or table becomes unreadable at 200% zoom.', guard: 'app/src/styles/textscale.test.ts', note: 'Text scaling is held; charts and wide tables are not screenshot-tested at zoom.' },
  { id: 'EC-A11Y-04', domain: 'a11y', case: 'Timer or accommodation is not announced.', guard: null, note: 'No timed assessment exists.' },
  { id: 'EC-A11Y-05', domain: 'a11y', case: 'Keyboard user cannot reach a schedule action.', guard: 'app/src/screens/Calendar.keyboard.test.tsx', note: 'Every calendar action has a non-drag route.' },
  { id: 'EC-A11Y-06', domain: 'a11y', case: 'Course author uploads an inaccessible PDF.', guard: null, note: 'Pages with no readable text are reported to the student who imported them; a faculty upload through Course Studio is not checked.' },
  { id: 'EC-A11Y-07', domain: 'a11y', case: 'Automated accessibility checker misses a meaningful context issue.', guard: null, note: 'By definition. The external review docs/LAUNCH-DECISIONS.md item 11 asks for is the control.' },
  { id: 'EC-A11Y-08', domain: 'a11y', case: 'User needs a support format or human assistance.', guard: 'app/src/components/GetHelp.test.tsx', note: 'A human route exists from the Action Center. No alternative-format request exists.' },
  { id: 'EC-A11Y-09', domain: 'a11y', case: 'Browser or assistive-technology combination behaves differently after an update.', guard: null, note: 'No screen-reader regression scripts on a browser matrix.' },

  // ── Governance and reputation ──────────────────────────────────────────
  { id: 'EC-GOV-01', domain: 'governance', case: 'Public claim conflicts with the actual release state.', guard: 'app/src/lib/gtm/rfp.test.ts', note: 'RFP answers refuse "available" without a source, and trust.test.ts refuses any affirmed certification. Marketing copy on the public site is not held: PRG-002.' },
  { id: 'EC-GOV-02', domain: 'governance', case: 'VPAT or HECVAT evidence expires.', guard: null, note: 'No VPAT exists to expire; docs/trust/BRIDGE-LETTER.md is the process for the gap between audits.', critical: true },
  { id: 'EC-GOV-03', domain: 'governance', case: 'Subprocessor changes without customer notice.', guard: 'app/src/lib/trust/subprocessors.test.ts', note: 'The list cannot drift from the hosts the code calls. Notice to customers is a process with no owner.' },
  { id: 'EC-GOV-04', domain: 'governance', case: 'Employee leaves with active privileged credentials.', guard: null, note: 'One person holds every credential; no offboarding checklist: R-09.' },
  { id: 'EC-GOV-05', domain: 'governance', case: 'Partner integration is compromised.', guard: null, note: 'No partner integration is live.' },
  { id: 'EC-GOV-06', domain: 'governance', case: 'Customer reports an accessibility barrier publicly.', guard: null, note: 'Accessibility tickets get the 24-hour target; the public response is a process in TRUST-BRAND-AND-LEGAL.md with no owner.' },
  { id: 'EC-GOV-07', domain: 'governance', case: 'Security incident becomes public before the investigation completes.', guard: null, note: 'Incident messages are composed by audience; no public-statement step: maturity system 18.' },
  { id: 'EC-GOV-08', domain: 'governance', case: 'Misleading ambassador or influencer statement.', guard: null, note: 'No ambassador program exists.' },
  { id: 'EC-GOV-09', domain: 'governance', case: 'AI mistake spreads through the student community.', guard: null, note: 'Report incorrect information exists on Today; nothing traces a correction back to those who saw it.' },
];

/** Which rows a guard covers, and which are still owed. */
export function coverage(cases: readonly EdgeCase[] = EDGE_CASES): { guarded: number; owed: number; owedCritical: string[] } {
  const owed = cases.filter((c) => c.guard === null);
  return { guarded: cases.length - owed.length, owed: owed.length, owedCritical: owed.filter((c) => c.critical).map((c) => c.id) };
}
