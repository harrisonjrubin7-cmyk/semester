// Draft answers for the decision register, written from repository evidence on 29 Oct. They are PROPOSALS by the agent
// (proposed_by 'agent:claude'); each counts only after a person confirms it on /decisions. Run once on app sbjuykr2qw:
//   import { apply } from './scripts/decisionProposals'; await apply();
import { pg } from '../src/lib/fin';

export const PROPOSALS: [key: string, answer: string, evidence: string][] = [
  ['repo',
    'Source of truth is the Zite workspace repository (apps/*, docs/). GitHub harrisonjrubin7-cmyk/semester mirrors it on branch zite/sync-2026-10-25, which the founder merges into main. There is no uncommitted work. Safe to change: anything under apps/ and docs/ through a commit with tests and check_app green. Not to change without approval: live data, published apps, company role grants, the main branch directly.',
    'Workspace git log (HEAD dcf8c76, clean tree, 29 Oct); zite/README.md import line; sync procedure in docs/execution/NEXT_ACTIONS.md.'],
  ['book2',
    'Book 2 (the full PDF registered as S-50) is the product reference for coverage and traceability; the 20-part series it cites is not on file. Until the founder resolves conflicts C3 (49+3 vs 51 roles) and C4 (589 vs 673 screens), coverage is traced against the pilot priority list (107 screens) and the role register (lib/roleApps.ts).',
    'docs/execution/source-register.md line 24; docs/execution/conflicts-and-decisions.md C3, C4; docs/execution/requirements-traceability.csv.'],
  ['cohort',
    'Interim: the launch cohort is the single pilot workspace already in the app (Northgate), with synthetic or pilot data only. No paying customer exists (pipeline: 2 accounts, none at the Customer stage). Acceptance journeys are scoped to that one institution. The founder names the first real segment before any customer-facing launch.',
    'Live counts 29 Oct: customerAccounts 2, Customer stage 0; Northgate tenant 28a6f511…; standing rule "do not use real student records".'],
  ['fields',
    'An integration may read or store only fields the institution approves in its integration mapping. Data classes are public, directory, education record and restricted (lib/authz.ts). Education records stay inside the institution\'s tenant; restricted data is never sent anywhere; only public catalog text may reach an AI provider. Anything not mapped is not ingested.',
    'apps/semester/src/lib/authz.ts (Classification); lib/aiGate.ts sendableToAI; api/integrationMappings.ts; conflicts-and-decisions.md C1.'],
  ['sources',
    'The institution\'s SIS is authoritative for registration outcomes and official grades during the pilot; Semester records requests and decisions alongside (C12). Semester is authoritative only for its own workflow records (requests, reviews, certifications, approvals and their histories). Official grade records are written in Semester only in authoritative mode with two administrators and evidence. No write-back to an external system is enabled.',
    'conflicts-and-decisions.md C12; docs/execution/SIS_LMS_REPLACEMENT.md lines 20-24; agency hand-offs marked blocked in lib/roleApps.ts.'],
  ['roles',
    'Institution roles and permissions are the matrix in lib/authz.ts (ROLE_PERMISSIONS, approved role templates). Specialist roles (deans, officers, stewards, certifying officials, career staff and others) are appointed by an institution administrator and never self-granted. Company roles live in co_roles and are granted only by the founder, never by code. Approvals that matter need a second person (enforced by table checks).',
    'apps/semester/src/lib/authz.ts; apps/semester-company-os/src/lib/coRoles.ts; the *_set_* appointment functions and their dbchecks.'],
  ['ai',
    'One use case is approved in code: Ask Semester (tutor and course-guide modes), using OpenAI gpt-4o-mini through the workspace\'s OpenAI integration. It runs only with the student\'s consent, the course AI rule, the institution entitlement, the daily quota and the stop flag; only public catalog text is sent; student records are never sent. No other provider or use case is approved.',
    'apps/semester/src/api/ask.ts (model, consent, requireModule, aiGate.sendableToAI); lib/tcpMigration.ts TCP_ENFORCED; conflicts-and-decisions.md C1.'],
  ['envs',
    'Supported environment: the ten Zite-hosted apps in workspace 1c4b0d16210e8d4b with one Neon Postgres database (ZITE_POSTGRES_URL). Changes are made in a Zite sandbox, checked (tests, dbchecks in rolled-back transactions, check_app), committed, mirrored to GitHub, and published by the founder only. There is no separate staging environment; dbchecks never commit data.',
    'Zite workspace app list; infraHealth measurement 29 Oct (31.6 MB database); NEXT_ACTIONS.md gate notes.'],
  ['support',
    'No contractual support commitments exist and none may be stated publicly. Internal practice only: incidents are run in Company OS (/incidents) and infrastructure health is checked on demand (/platform/health); there is no SLA, no on-call rota and no automatic alerting.',
    'Company OS incidents module; api/infraHealth.ts ("not built: scheduled runs and alerting"); standing rule against publishing unapproved claims.'],
  ['retention',
    'No automatic deletion runs today. Data stewards record a retention period and legal minimum for each data asset (dgv_retention); history tables are append-only and kept. Any deletion is a destructive operation that needs the founder\'s explicit approval and a named target. The institution\'s own retention schedule overrides these defaults once supplied.',
    'apps/semester/src/lib/dgvMigration.ts dgv_retention / dgv_retain; append-only triggers listed in lib/guardManifest.ts; standing approval rules.'],
  ['plans',
    'No commercial plans are approved and no price may be published. Billing in Company OS is a simulation; no money moves. Module entitlements come from the tenant control plane, and an unmanaged tenant has every module on by default.',
    'apps/semester-company-os/src/lib/billingSim.ts; apps/semester/src/lib/tcpMigration.ts (tcp_entitlements, tcp_managed); standing rule on prices.'],
];
// Left open on purpose: 'reviewers' (who the security, legal, accounting and accessibility reviewers are) and 'budget' are the
// founder's facts; nothing in the repository can answer them.

export async function apply() {
  const sql = pg();
  for (const [key, answer, evidence] of PROPOSALS) {
    const r = (await sql.query(`UPDATE co_decisions SET status = 'proposed', answer = $2, evidence = $3, proposed_by = 'agent:claude', proposed_name = 'Claude (draft from repository evidence)',
      decided_by = NULL, decided_name = NULL, updated_at = now() WHERE key = $1 AND status = 'open' RETURNING key`, [key, answer, evidence])) as unknown[];
    if (r.length) await sql.query(`INSERT INTO co_decision_events (key, kind, detail, actor, actor_name) VALUES ($1, 'propose', $2, 'agent:claude', 'Claude (draft from repository evidence)')`, [key, answer.slice(0, 200)]);
    console.log(key, r.length ? 'proposed' : 'skipped (not open)');
  }
}
