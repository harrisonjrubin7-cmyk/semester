/**
 * What a school may configure, at which tier, and what it may never change.
 *
 * Semester is one product with tenant-aware configuration, not a codebase per
 * university. So every setting a school can touch is registered here with its
 * tier, and a request for anything not registered is not a configuration
 * request at all — it is a product request, and goes through the scorecard.
 *
 *   Tier 1 — Brand and content          (customer success can approve)
 *   Tier 2 — Workflow settings          (product review)
 *   Tier 3 — Policy and governance      (privacy, security, accessibility review)
 *   Tier 4 — Integration mappings       (integration owner + data steward)
 *   Tier 5 — Extensions / custom logic  (rare: flagged, reviewed, versioned, contracted)
 *
 * Nothing on the NEVER list is reachable at any tier. Those are the things
 * that would make "configuration" a way of turning Semester into a different,
 * less safe product for one customer: arbitrary scripts, direct SQL, a
 * weakened security or privacy floor, CSS that breaks accessibility.
 *
 * See docs/operating-model/CONFIGURATION-TIERS.md.
 */

export type Tier = 1 | 2 | 3 | 4 | 5;

export const TIER_NAME: Record<Tier, string> = {
  1: 'Brand and content',
  2: 'Workflow settings',
  3: 'Policy and governance',
  4: 'Integration mappings',
  5: 'Extension / custom logic',
};

export type Reviewer =
  | 'customer_success'
  | 'product'
  | 'privacy'
  | 'security'
  | 'accessibility'
  | 'integration_owner'
  | 'data_steward'
  | 'engineering'
  | 'legal';

/** Who must sign before a change at this tier reaches a tenant. Cumulative in spirit, explicit in data. */
export const TIER_REVIEWERS: Record<Tier, readonly Reviewer[]> = {
  1: ['customer_success', 'accessibility'],
  2: ['customer_success', 'product'],
  3: ['product', 'privacy', 'security', 'accessibility'],
  4: ['integration_owner', 'data_steward', 'privacy'],
  5: ['product', 'engineering', 'security', 'privacy', 'accessibility', 'legal'],
};

export interface SettingDefinition {
  key: string;
  tier: Tier;
  description: string;
  /** What the setting may not do, stated so a reviewer does not have to infer it. */
  limit: string;
}

export const SETTINGS: readonly SettingDefinition[] = [
  // Tier 1 — Brand and content
  { key: 'brand.logo', tier: 1, description: 'Campus logo in the header and sign-in.', limit: 'Must carry alt text; cannot replace security or consent branding.' },
  { key: 'brand.accent_color', tier: 1, description: 'The school accent colour.', limit: 'Accepted only if it passes the contrast ramp on every ground; never overrides focus or error tokens.' },
  { key: 'brand.campus_labels', tier: 1, description: 'Local names for terms, buildings and offices.', limit: 'Labels only; cannot rename a consent or privacy control.' },
  { key: 'content.help_contacts', tier: 1, description: 'Help desk, accessibility office and crisis contacts.', limit: 'Crisis contacts must be verified by the institution before publishing.' },
  { key: 'content.public_resources', tier: 1, description: 'Public campus resources and links.', limit: 'Verified destinations only; links carry an owner and expiry.' },
  // Tier 2 — Workflow settings
  { key: 'workflow.action_templates', tier: 2, description: 'Which action templates appear and in what order.', limit: 'Cannot alter the privacy rules an action applies.' },
  { key: 'workflow.deadlines', tier: 2, description: 'Institutional calendar dates (registration, add/drop).', limit: 'Each date carries its source and freshness.' },
  { key: 'workflow.service_routing', tier: 2, description: 'Which office a request routes to.', limit: 'Every route needs an owner, capacity and closure condition (see service design).' },
  { key: 'workflow.notification_cadence', tier: 2, description: 'How often reminders are sent.', limit: 'Within platform quiet hours and the student’s own preferences.' },
  // Tier 3 — Policy and governance
  { key: 'policy.ai_rules', tier: 3, description: 'Which AI uses a school permits, by course and assignment.', limit: 'May only be stricter than the platform AI floor.' },
  { key: 'policy.data_classification', tier: 3, description: 'A school’s own T0–T6 routing rules.', limit: 'May only be stricter than the platform floor (enforced by `tighten`).' },
  { key: 'policy.visibility', tier: 3, description: 'Default visibility of profiles and community spaces.', limit: 'Student-owned data stays private by default.' },
  { key: 'policy.retention', tier: 3, description: 'Retention periods within the platform range.', limit: 'Cannot extend beyond contract or suppress deletion requests.' },
  { key: 'policy.marketplace', tier: 3, description: 'Whether sponsors and the marketplace appear.', limit: 'Sponsor principles apply; no sponsor receives student-level data.' },
  // Tier 4 — Integration mappings
  { key: 'integration.field_mapping', tier: 4, description: 'SIS/LMS/CRM field mappings.', limit: 'Versioned; only fields named in the data contract.' },
  { key: 'integration.freshness_sla', tier: 4, description: 'Freshness target for a source.', limit: 'Cannot hide the freshness label when the target is missed.' },
  { key: 'integration.source_ownership', tier: 4, description: 'Named owner and steward of each source.', limit: 'Both must be named people, not a department inbox.' },
  // Tier 5 — Extensions
  { key: 'extension.approved_module', tier: 5, description: 'An approved extension from the certified directory.', limit: 'Feature-flagged, reviewed, versioned and contractually scoped; never bypasses RLS or policy.' },
];

export const SETTING_KEYS: ReadonlySet<string> = new Set(SETTINGS.map((s) => s.key));

/**
 * Never permitted at any tier. Each is a category a request can be matched
 * against; `classifyRequest` refuses a request that names one.
 */
export const NEVER: readonly { key: string; reason: string }[] = [
  { key: 'tenant_script', reason: 'Arbitrary tenant JavaScript or scripts in the core runtime.' },
  { key: 'direct_sql', reason: 'Direct SQL access to Semester production data.' },
  { key: 'unreviewed_webhook', reason: 'Unreviewed webhooks carrying student data.' },
  { key: 'custom_css', reason: 'Custom CSS, which can break accessibility tokens and focus.' },
  { key: 'third_party_tracking', reason: 'Unapproved third-party tracking.' },
  { key: 'bypass_rls', reason: 'An extension or setting that bypasses RLS or policy.' },
  { key: 'weaken_security', reason: 'A setting that weakens the security model.' },
  { key: 'weaken_privacy', reason: 'A setting that weakens FERPA or privacy controls. A privacy exception is a legal review, not a toggle.' },
  { key: 'disable_audit', reason: 'Suppressing or deleting audit records.' },
  { key: 'cross_tenant_access', reason: 'Reading another tenant’s data.' },
  { key: 'raw_secrets', reason: 'Exposing raw credentials to tenant administrators.' },
  { key: 'code_fork', reason: 'A tenant fork of the core codebase.' },
];

export type RequestVerdict =
  | { kind: 'setting'; tier: Tier; reviewers: readonly Reviewer[] }
  | { kind: 'never'; reason: string }
  /** Not a registered setting: a product request, which is scored, not configured. */
  | { kind: 'product_request' };

export function classifyRequest(key: string): RequestVerdict {
  const never = NEVER.find((n) => n.key === key);
  if (never) return { kind: 'never', reason: never.reason };
  const s = SETTINGS.find((x) => x.key === key);
  if (!s) return { kind: 'product_request' };
  return { kind: 'setting', tier: s.tier, reviewers: TIER_REVIEWERS[s.tier] };
}

/**
 * The tenant configuration approval flow, in order. A change is live only
 * when every step before `launch` is recorded; the registry test holds the
 * doc to this list.
 */
export const APPROVAL_FLOW = [
  'request',
  'classify_tier',
  'security_privacy_accessibility_review',
  'governance_score',
  'approve_configure_flag',
  'tenant_sandbox_test',
  'uat',
  'launch_with_monitoring',
  'review_sunset_or_scale',
] as const;

export type ApprovalStep = (typeof APPROVAL_FLOW)[number];

/** The first step not yet done, or null when the change may launch. */
export function nextStep(done: ReadonlySet<ApprovalStep>): ApprovalStep | null {
  const launchAt = APPROVAL_FLOW.indexOf('launch_with_monitoring');
  for (const step of APPROVAL_FLOW.slice(0, launchAt)) if (!done.has(step)) return step;
  return null;
}
