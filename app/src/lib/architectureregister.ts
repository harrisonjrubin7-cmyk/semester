/**
 * The architecture traceability register: the brief's thirteen sections and
 * the nine mainframe layers, one row per item, each row citing the files that
 * evidence it.
 *
 * `docs/ARCHITECTURE-TRACEABILITY-REGISTER.md` is rendered from these rows;
 * run `npm run registers` from app/ to rewrite it. `architectureregister.test.ts`
 * holds the rows to three rules: `designed` names a document, `implemented`
 * names code or a migration, `tested` names a test or check. Every row has an
 * `open` note, and no row claims completion.
 *
 * Paths are repo-relative. Nothing here is a status claim on the deployed,
 * institution-authorized, production or record-authoritative axes.
 */

export const LAYERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'cross-cutting'] as const;

export type Layer = (typeof LAYERS)[number];

export interface ArchitectureRow {
  id: string;
  /** Brief sections (1–13) this row evidences. */
  sections: number[];
  layer: Layer;
  subject: string;
  designed: string[];
  implemented: string[];
  tested: string[];
  /** What is not yet evidenced. Never empty. */
  open: string;
}

export const ROWS: ArchitectureRow[] = [
  {
    id: 'AR-01', sections: [1], layer: 'cross-cutting',
    subject: 'Evidence baseline and status model',
    designed: ['docs/ARCHITECTURE-SPECIFICATION.md', 'docs/EVIDENCE-REGISTER.md'],
    implemented: [],
    tested: ['app/src/lib/architectureregister.test.ts'],
    open: 'Deployed, institution-authorized, production-enabled and record-authoritative are not assessed for any row. Version, environment, verifier and date are not yet recorded per claim.',
  },
  {
    id: 'AR-02', sections: [2], layer: 'F',
    subject: 'AI gateway: six boundaries and egress control',
    designed: ['docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md', 'docs/ai-governance'],
    implemented: [
      'app/src/lib/governance/ai-systems.ts',
      'supabase/migrations/20260923210000_intelligence_policy.sql',
      'supabase/migrations/20260924184500_gateway_action_journal.sql',
      'supabase/migrations/20260924200000_gateway_observability.sql',
    ],
    tested: ['app/src/lib/governance/ai-direct-calls.test.ts'],
    open: 'The six boundaries are not yet mapped one-to-one to code. Protected-record exclusion from provider payloads, server-side tool allowlists, reauthorization on revocation, cache invalidation, and the red-team cases for student IDs and grades were not traced in this pass.',
  },
  {
    id: 'AR-03', sections: [3, 11], layer: 'I',
    subject: 'Environment trust zones, isolation and infrastructure',
    designed: ['docs/PLATFORM_REQUIREMENTS.md', 'docs/OPERATIONAL-READINESS-PACK.md'],
    implemented: ['infra', '.github/workflows/infra-apply.yml', '.github/workflows/production-smoke.yml'],
    tested: [],
    open: 'No preview-to-production-backend gate, production-secret-in-preview gate, or preview cleanup check was located in this pass. The per-environment isolation inventory is not a register yet.',
  },
  {
    id: 'AR-04', sections: [4], layer: 'D',
    subject: 'Stack layers and the consequential command flow',
    designed: ['docs/ARCHITECTURE.md', 'docs/TENANT-CONTRACT.md'],
    implemented: ['app/src/architecture/rules.ts', 'app/src/architecture/graph.ts'],
    tested: ['app/src/architecture/architecture.test.ts'],
    open: 'Layer rules are not written as one contract. The command envelope (idempotency key, expected record version, approval reference) and the receipt states have no located implementation.',
  },
  {
    id: 'AR-05', sections: [5], layer: 'D',
    subject: 'Transactional outbox, projections and freshness',
    designed: ['docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md'],
    implemented: [
      'supabase/migrations/20260928320000_audit_correlation_and_outbox.sql',
      'app/src/components/WaitingSends.tsx',
    ],
    tested: ['app/src/components/WaitingSends.test.tsx'],
    open: 'The outbox table is in one migration. An outbox publisher, a projection consumer, a checkpoint, deduplication and the invalidation hint were not located in this pass. Freshness budgets per capability are not defined in code.',
  },
  {
    id: 'AR-06', sections: [6], layer: 'H',
    subject: 'Education OS boundaries, replacement and migration phases',
    designed: [
      'docs/UNIVERSITY-OS-ARCHITECTURE.md',
      'docs/DOMAIN-REPLACEMENT-REGISTER.md',
      'docs/ADDITIVE-UNIVERSITY-OS-MIGRATION-PLAN.md',
      'docs/LMS-INTEROPERABILITY-MATRIX.md',
      'docs/DATA-MIGRATION-PLAN.md',
    ],
    implemented: ['app/src/lib/replaceregister.ts'],
    tested: ['app/src/lib/replaceregister.test.ts'],
    open: 'The ten migration phases and the per-domain architecture card are not enforced by code. Shadow-projection, reconciliation and dual-run tooling were not located. The four reversal kinds are not modelled.',
  },
  {
    id: 'AR-07', sections: [7], layer: 'D',
    subject: 'Capability registry and derived status',
    designed: ['docs/CAPABILITY-PARITY-MATRIX.md', 'docs/CAPABILITY-ACTIVATION-REGISTER.md'],
    implemented: [
      'app/src/data/ecosystem/capabilities.json',
      'app/src/lib/ecosystem.ts',
      'supabase/migrations/20260922012000_capabilities.sql',
    ],
    tested: ['supabase/capabilities.check.sql'],
    open: 'The generated registry holds 122 capabilities. Its first record carries no projection-dependency, freshness, recovery or ownership field. Derived-status formulas with input versions and reason codes are not documented. Whether capabilities.check.sql runs in CI was not checked. The brief\'s eight-workspace count is not reconciled to the registry\'s workspace field.',
  },
  {
    id: 'AR-08', sections: [8], layer: 'E',
    subject: 'Schema, RLS and server atlas',
    designed: ['docs/DATA-INVENTORY-AND-LINEAGE.md', 'docs/DEFINER-RLS-REGISTER.md'],
    implemented: ['supabase/migrations'],
    tested: ['app/src/lib/definerregister.test.ts'],
    open: 'The repository holds 239 migration files, not the 21 in the outline. Table, function and worker documentation is not generated for every entity. The ten flow traces are not written. Privileged-function review against a fixed search_path and narrow grants is not evidenced here.',
  },
  {
    id: 'AR-09', sections: [9], layer: 'cross-cutting',
    subject: 'Connected ecosystem views and passports',
    designed: ['docs/ONE-SYSTEM-PLATFORM-GRAMMAR.md', 'SEMESTER-OPERATING-SYSTEM.md', 'docs/passports'],
    implemented: ['app/src/lib/onesystem.ts'],
    tested: ['app/src/lib/onesystem.test.ts'],
    open: 'The fourteen views are a proposed taxonomy and are not reconciled to the existing views. The passport documents were not compared with the governed-bundle definition in the brief.',
  },
  {
    id: 'AR-10', sections: [10], layer: 'cross-cutting',
    subject: 'Forms, command contracts and receipts',
    designed: ['docs/ROLE-PERMISSION-MATRIX.md', 'docs/INTEGRATION-PERMISSION-MATRIX.md'],
    implemented: [],
    tested: [],
    open: 'The twelve form workflows are proposed. No inventory of the actual forms, command envelope or receipt model was located. The brief\'s registrar-approval example was not checked against the repository.',
  },
  {
    id: 'AR-11', sections: [11], layer: 'A',
    subject: 'Entry, identity and onboarding',
    designed: ['docs/ACCOUNT-LINKING-AND-IDENTITY-PRIVACY.md', 'docs/INSTITUTIONAL-SSO-ARCHITECTURE.md'],
    implemented: [
      'supabase/migrations/20260927120000_identity_claim_minimization.sql',
      'supabase/migrations/20260928011845_tenant_sso_policy.sql',
    ],
    tested: [],
    open: 'No identity test or complete onboarding-journey test was located in this pass.',
  },
  {
    id: 'AR-12', sections: [11], layer: 'B',
    subject: 'Role-aware experience and tenant isolation',
    designed: ['docs/ROLE-LAUNCH-REGISTER.md', 'docs/ROLE-PERMISSION-MATRIX.md'],
    implemented: ['supabase/migrations/20260928010000_my_capabilities.sql'],
    tested: [],
    open: 'Role and tenant-isolation tests were not located in this pass. The rule against silent privilege union is not traced to code.',
  },
  {
    id: 'AR-13', sections: [11], layer: 'C',
    subject: 'Native domain engines',
    designed: ['docs/LEARNING-ASSESSMENT-GRADEBOOK-REGISTER.md'],
    implemented: [],
    tested: [],
    open: 'Domain engines (planning, learning, assessment, records, advising, accounts, campus, career, company operations) were not traced to code. Grade states (entered, moderated, released, received) and their tests were not located.',
  },
  {
    id: 'AR-14', sections: [11], layer: 'D',
    subject: 'Shared platform core: authorization, approvals, commands, events, search',
    designed: ['docs/ZERO-TRUST-EVENT-API-OBSERVABILITY-ROADMAP.md'],
    implemented: [
      'supabase/migrations/20260922012000_capabilities.sql',
      'supabase/migrations/20260928320000_audit_correlation_and_outbox.sql',
    ],
    tested: ['supabase/capabilities.check.sql'],
    open: 'Approvals, commands, workflow, events, projections, search and scheduling are not traced as one reusable contract. Duplicate and out-of-order event handling is not evidenced.',
  },
  {
    id: 'AR-15', sections: [11], layer: 'G',
    subject: 'Control planes and separation of duties',
    designed: ['docs/OPERATIONS-CONSOLE-MAP.md'],
    implemented: [],
    tested: ['supabase/console-approvals.check.sql'],
    open: 'Separation-of-duties and approval evidence are not traced beyond the check file. Whether the check runs in CI was not verified.',
  },
  {
    id: 'AR-16', sections: [12], layer: 'cross-cutting',
    subject: 'Cross-cutting acceptance criteria',
    designed: ['docs/ARCHITECTURE-SPECIFICATION.md'],
    implemented: [],
    tested: [],
    open: 'No check runs the fourteen cross-cutting criteria across the workspaces. Protected-egress, approval-binding and revocation checks were not located.',
  },
  {
    id: 'AR-17', sections: [13], layer: 'cross-cutting',
    subject: 'Execution sequence and this register',
    designed: ['docs/ARCHITECTURE-SPECIFICATION.md'],
    implemented: ['app/src/lib/architectureregister.ts'],
    tested: ['app/src/lib/architectureregister.test.ts'],
    open: 'Step 1 (reconcile inventories and counts) is started: this register records the gaps but does not close them. Steps 2–8 have not been run as a sequence.',
  },
];

const SECTION_COUNT = 13;

export function sectionsCovered(): Set<number> {
  return new Set(ROWS.flatMap((row) => row.sections));
}

export const SECTION_TITLES: Record<number, string> = {
  1: 'Evidence baseline',
  2: 'AI gateway',
  3: 'Environments',
  4: 'Stack layers',
  5: 'Read-model pipeline and freshness',
  6: 'Education OS architecture and migration',
  7: 'Capability registry',
  8: 'Data model and server',
  9: 'Connected ecosystem',
  10: 'Forms, capabilities and interfaces',
  11: 'Mainframe layers A–I',
  12: 'Cross-cutting acceptance criteria',
  13: 'Execution sequence',
};

const cell = (paths: string[]) => (paths.length ? paths.map((p) => `\`${p}\``).join('<br>') : '—');

/** The markdown the test writes and compares against. */
export function renderRegister(): string {
  const lines: string[] = [
    '# Architecture traceability register',
    '',
    '<!-- Rendered from app/src/lib/architectureregister.ts by architectureregister.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    'Companion to [`ARCHITECTURE-SPECIFICATION.md`](ARCHITECTURE-SPECIFICATION.md). One row per item, each citing its evidence. Paths were checked to exist on disk and to be of the kind their column claims.',
    '',
    '**Not assessed for any row:** deployed, institution-authorized, production-enabled and record-authoritative. Those axes need environment-specific evidence this register does not contain.',
    '',
    '**Reading a row.** `Designed` cites a document. `Implemented` cites code or a migration. `Tested` cites a test or check. `Open` is what the pass did not find. A missing citation means "not located in this pass", not "absent from the product".',
    '',
    `Sections covered: ${[...sectionsCovered()].sort((a, b) => a - b).join(', ')} of 1–${SECTION_COUNT}.`,
    '',
    '| ID | Section | Layer | Item | Designed | Implemented | Tested | Open |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of ROWS) {
    const sections = row.sections.join(', ');
    lines.push(
      `| ${row.id} | ${sections} | ${row.layer} | ${row.subject} | ${cell(row.designed)} | ${cell(row.implemented)} | ${cell(row.tested)} | ${row.open} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}
