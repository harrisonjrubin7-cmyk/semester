// Proposed capability evidence, prepared by an engineering session and NOT yet evidence. Pure data: nothing here counts in the
// Atlas until a security lead accepts a row in Security Lab (Capabilities → Proposed evidence), which records it under their
// name with the same rules as manual entry (reviewer separation between stages, no synthetic deployment evidence).
// Every file named below is checked to exist by apps/semester/tests/evidenceProposals.test.ts. "Tested" results were re-run on
// 29 Oct 2026 against commit 38a9033: database checks in rolled-back transactions with synthetic ids (environment Synthetic),
// unit tests via apps/*/tests/run.sh. A proposal is a claim about the code at that commit only.
export type ProposalStage = 'Implemented' | 'Tested';
export type Proposal = { key: string; capabilityId: string; capability: string; stage: ProposalStage; environment: 'Preview' | 'Synthetic'; summary: string; reference: string; scope: string; files: string[] };

export const PROPOSAL_COMMIT = '38a9033';
const S = 'apps/semester/', CO = 'apps/semester-company-os/', LAB = 'apps/semester-security-lab/';

type Row = [id: string, capability: string, implFiles: string[], implScope: string, tested?: [files: string[], result: string, scope: string]];
const ROWS: Row[] = [
  ['7fe2ec03-0749-40c2-bf29-89c60038579c', 'Identity & sign-in', [S + 'src/lib/server.ts'], 'requireAccess resolves the signed-in user and institution on the server for every endpoint',
    [[S + 'tests/endpointAuth.test.ts'], 'endpointAuth.test 4/4 (every endpoint requires sign-in unless on the reviewed public list; control included)', 'endpoint sign-in requirement, all Semester endpoints']],
  ['a40bf7fd-08cc-44df-92d3-a7a773f6121f', 'Consent & scoped sharing', [S + 'src/lib/famMigration.ts', S + 'src/api/privacy.ts'], 'family sharing by invitation only; accept, revoke and leave',
    [[S + 'dbchecks/familyInvites.ts'], 'dbchecks/familyInvites RESULT pass=30 fails=0', 'family invitations, acceptance by the invited account, revocation']],
  ['d0be22eb-1f75-44f1-a977-e21eb426e305', 'Audit trail', [S + 'src/lib/server.ts', S + 'src/lib/audMigration.ts'], 'audit() on consequential actions; audit module',
    [[S + 'dbchecks/audit.ts'], 'dbchecks/audit RESULT pass=38 fails=0', 'audit module rules']],
  ['664edcef-a337-483d-91f0-1135336e9b1f', 'Today / Action Center', [S + 'src/pages/Today.tsx'], 'Today page in the Student app'],
  ['7719d315-9f93-4cbd-ba22-d7a717dacf7b', 'Personal task workflow', [S + 'src/api/manageTask.ts'], 'personal tasks endpoint'],
  ['c8164d53-8474-4ea2-8b2b-5b1d29616d13', 'My Path / progress', [S + 'src/pages/Progress.tsx'], 'progress, degree and grades pages',
    [[S + 'tests/gradeCalc.test.ts', S + 'tests/transcript.test.ts'], 'gradeCalc.test 12/12, transcript.test 16/16', 'grade and transcript calculations (not degree audit)']],
  ['3ea59655-1db1-4471-99de-4473d436b118', 'Search', [S + 'src/api/search.ts', S + 'src/lib/searchHits.ts'], 'search endpoint with shared hit rules',
    [[S + 'tests/searchHits.test.ts'], 'searchHits.test 3/3', 'private note and task hits are limited to their owner']],
  ['860ebeae-ae40-418a-81f0-50afc07791f0', 'Learning & study', [S + 'src/lib/sbmMigration.ts', S + 'src/lib/submissionAccess.ts'], 'submissions, attempts, group submissions and access decisions',
    [[S + 'dbchecks/submissions.ts', S + 'tests/submissionAccess.test.ts'], 'dbchecks/submissions RESULT pass=27 fails=0; submissionAccess.test 5/5', 'submission rules and who may open a submission']],
  ['ab20e85b-402b-4e7b-9e82-cb3f2b2a6135', 'Registration', [S + 'src/api/registration.ts', S + 'src/api/registrationChanges.ts'], 'registration requests and changes',
    [[S + 'dbchecks/registrationRace.ts', S + 'tests/registrar.test.ts'], 'dbchecks/registrationRace: 20 concurrent claims → 1 seat committed, 19 full, 0 errors, replay returns the same result; registrar.test 14/14', 'seat claims under concurrency, registrar decisions, idempotent submit']],
  ['6482efb5-dd35-40d8-9a6b-1c5ba8070e45', 'Career', [S + 'src/lib/carMigration.ts', S + 'src/api/careerServices.ts'], 'career services module',
    [[S + 'dbchecks/careers.ts'], 'dbchecks/careers RESULT pass=29 fails=0', 'career services rules']],
  ['79250762-c812-4260-82f7-a02b40e53e98', 'Community', [S + 'src/lib/modMigration.ts'], 'community moderation module',
    [[S + 'tests/moderation.test.ts', S + 'tests/discussion.test.ts'], 'moderation.test 5/5, discussion.test 5/5', 'moderation and discussion rules (unit)']],
  ['a3f9e116-a58b-432c-829e-79b4483a22ce', 'Support & advising', [S + 'src/lib/osvMigration.ts', S + 'src/lib/aptMigration.ts', S + 'src/lib/caseRules.ts'], 'office queues and requests, appointment claims, advising caseload',
    [[S + 'dbchecks/officeService.ts', S + 'dbchecks/support.ts', S + 'tests/officeRules.test.ts', S + 'tests/caseRules.test.ts', S + 'tests/aptRules.test.ts'], 'dbchecks/officeService RESULT pass=48 fails=0 (5 mutants caught); dbchecks/support RESULT pass=27 fails=0; officeRules 13/13, caseRules 7/7, aptRules 6/6', 'office service, peer support, advising case rules']],
  ['4781db0f-f1c2-486b-81b6-1620b452422b', 'Family / supporters', [S + 'src/lib/famMigration.ts', 'apps/semester-family/src/App.tsx'], 'family portal over invitation-based sharing',
    [[S + 'dbchecks/familyInvites.ts'], 'dbchecks/familyInvites RESULT pass=30 fails=0', 'family access only after acceptance; student and family can end it']],
  ['050754c6-9fb7-4ea2-ac27-e7888a0d6876', 'Admissions', [S + 'src/lib/admMigration.ts', S + 'src/api/admissions.ts'], 'admissions review module',
    [[S + 'dbchecks/admissions.ts', S + 'tests/applicationRules.test.ts'], 'dbchecks/admissions RESULT pass=17 fails=0; applicationRules.test 4/4', 'admissions review rules']],
  ['df0dbfa3-63c3-4ee2-85d5-4ff23fe5f512', 'Institution console', [S + 'src/pages/Console.tsx'], 'institution console page'],
  ['b91ebdc4-d66e-4c5d-9540-1ce570c6485d', 'Integrations & reconciliation', [S + 'src/lib/rgwMigration.ts', S + 'src/lib/rosterRules.ts'], 'shadow-mode roster gateway with two-admin approval and quarantine',
    [[S + 'dbchecks/rosterGateway.ts', S + 'tests/rosterRules.test.ts', S + 'tests/mappingRules.test.ts', S + 'tests/reconRules.test.ts'], 'dbchecks/rosterGateway RESULT pass=23 fails=0; rosterRules 4/4, mappingRules 9/9, reconRules 8/8', 'roster import only (no live SIS connection)']],
  ['fd6d7a43-f355-4dd8-87c8-52d41564f6ae', 'Housing', [S + 'src/lib/hsgMigration.ts'], 'housing module',
    [[S + 'dbchecks/reslife.ts', S + 'tests/housing.test.ts'], 'dbchecks/reslife RESULT pass=23 fails=0; housing.test 9/9', 'housing and residence life rules']],
  ['3c1254b0-04d3-4d1f-9741-f742949b3322', 'Dining & campus card', [S + 'src/lib/dngMigration.ts', S + 'src/lib/idcMigration.ts'], 'dining and ID card modules',
    [[S + 'dbchecks/idcard.ts', S + 'tests/dining.test.ts', S + 'tests/idcard.test.ts'], 'dbchecks/idcard RESULT pass=29 fails=0; dining.test 8/8, idcard.test 6/6', 'ID card and dining rules (no payment processing)']],
  ['3f33ee0e-7bd5-40fb-aae9-850ce0c59e33', 'Student accounts & tuition', [S + 'src/lib/saMigration.ts'], 'charge/credit adjustments with two-person approval; nothing posts money',
    [[S + 'dbchecks/studentAccounts.ts'], 'dbchecks/studentAccounts RESULT pass=18 fails=0 (2 mutants caught)', 'adjustments: proposal, second-person decision, tenant isolation, never posted']],
  ['9e72e3f2-742f-4d5e-919f-dec8c05199ce', 'Financial aid', [S + 'src/lib/faOfficeMigration.ts'], 'aid office module',
    [[S + 'dbchecks/aidOffice.ts', S + 'tests/scholarship.test.ts'], 'dbchecks/aidOffice RESULT pass=20 fails=0; scholarship.test 7/7', 'aid office rules (no disbursement)']],
  ['13cbd8f2-5bea-49c2-8628-b3d36670ecbc', 'Company CRM & implementation', [CO + 'src/lib/migMigration.ts'], 'implementation migration control plane',
    [[CO + 'dbchecks/migrations.ts'], 'company-os dbchecks/migrations RESULT pass=25 fails=0 (3 mutants caught)', 'implementation migrations: inventory, gates, rollback window']],
  ['e980faea-129f-44ec-83dd-a37ca0b69646', 'Company operations console', [CO + 'src/App.tsx'], 'Company OS app',
    [[CO + 'tests/companyRules.test.ts', CO + 'tests/decisionRules.test.ts'], 'companyRules.test 14/14, decisionRules.test 4/4', 'company rules and decision register (unit)']],
  ['d20aa64c-0bca-4921-9a4e-748416a049d7', 'Security evidence & release gates', [LAB + 'src/api/addCapabilityEvidence.ts', LAB + 'src/api/decideGate.ts'], 'stage evidence and gate decisions, security lead only'],
  ['209fb008-de8a-4db7-b3fe-c0731ce58d0a', 'Public site', ['apps/semester-site/src/Home.tsx'], 'public site pages (not published by this proposal)'],
  ['30063414-4d1c-40ac-b6c5-93948a98be9b', 'Migration & cutover tooling', [CO + 'src/lib/migMigration.ts'], 'cutover needs institution approval bound to the evidence; rollback window',
    [[CO + 'dbchecks/migrations.ts'], 'company-os dbchecks/migrations RESULT pass=25 fails=0', 'stage gates, rollback only in window, idempotent commands']],
  ['cddddf5f-ee7f-48f9-8e27-6f20ced80a3e', 'Private file authorization (replace link-only access)', [S + 'src/lib/filMigration.ts', S + 'src/api/files.ts', S + 'src/lib/fileRules.ts'], 'private file store with server-side grants',
    [[S + 'tests/fileRules.test.ts', S + 'dbchecks/fileScan.ts'], 'fileRules.test 5/5 (owner reads; revoked/expired grants denied); dbchecks/fileScan RESULT pass=13 fails=0', 'file access decisions and upload screening']],
  ['44ec56cd-4633-43f7-8cb5-04493b69832d', 'Transactional writes for consistency-critical workflows', [S + 'src/lib/osvMigration.ts', CO + 'src/lib/migMigration.ts', S + 'src/lib/saMigration.ts'], 'each consequential step is one database function call = one transaction'],
  ['20b08b14-f895-4e0e-8cab-2da471012ee4', 'Append-only authoritative audit trail', [S + 'src/lib/audMigration.ts', S + 'src/lib/osvMigration.ts'], 'statement-level triggers refuse update/delete/truncate on history tables',
    [[S + 'dbchecks/audit.ts', S + 'dbchecks/officeService.ts'], 'dbchecks/audit RESULT pass=38 fails=0; officeService K12/K13 (history and messages append-only) pass', 'append-only history tables in these modules']],
  ['93b51e9e-84df-4448-b125-74a68c14e813', 'Registrar request queue (commit/reject)', [S + 'src/api/registrarQueue.ts', S + 'src/api/registrarDecide.ts'], 'registrar queue and decisions',
    [[S + 'tests/registrar.test.ts'], 'registrar.test 14/14 (cross-institution denied, no self-decision, full section rejected, stale version)', 'registrar decision rules']],
  ['52c6399e-3732-4902-aad4-d213ff2c451b', 'Server-side authorization for file lookup and download', [S + 'src/api/files.ts', S + 'src/lib/fileRules.ts'], 'download decided on the server per request',
    [[S + 'tests/fileRules.test.ts'], 'fileRules.test 5/5', 'owner, live grant, revoked/expired grant and deleted-file decisions']],
  ['02d4f432-ed28-4d67-b20b-c957289fe8a5', 'Registration windows, priority, prerequisites, holds, and exception authority', [S + 'src/lib/hldMigration.ts', S + 'src/lib/termMigration.ts'], 'holds and term lifecycle (closed terms refuse registration writes)',
    [[S + 'dbchecks/holds.ts', S + 'dbchecks/terms.ts', S + 'tests/holdRules.test.ts', S + 'tests/termRules.test.ts'], 'dbchecks/holds RESULT pass=19 fails=0; dbchecks/terms RESULT pass=13 fails=0; holdRules 10/10, termRules 3/3', 'holds and term state only (windows, priority and prerequisites not covered)']],
  ['9cdb0d8b-7a44-4e4c-b242-00741a0ba533', 'Role registry: 79 role templates, deny by default', [S + 'src/lib/roleTemplates.ts', S + 'src/lib/authz.ts'], 'generated role templates and the permission check'],
  ['6e325e19-6536-476c-a136-6903e97d4b62', 'Student Accounts workspace (charges, payment plans, reconciliation), kept apart from company books', [S + 'src/lib/saMigration.ts', S + 'src/components/AccountServices.tsx'], 'student account adjustments in the institution tenant, separate from company finance',
    [[S + 'dbchecks/studentAccounts.ts'], 'dbchecks/studentAccounts RESULT pass=18 fails=0', 'charges and credits only (reconciliation blocked by owner decision)']],
  ['405a01c8-e26a-4fe5-9c8b-230efae27697', 'Invoice to payment event to reconciliation to entitlement', [CO + 'src/lib/finMigration.ts'], 'company finance tables and rules'],
  ['76e742ca-e55b-40e3-92c5-44af43437a68', 'Purchase request to budget review to vendor invoice to accounting export', [S + 'src/lib/prcMigration.ts'], 'procurement module',
    [[S + 'dbchecks/procurement.ts', S + 'tests/procure.test.ts'], 'dbchecks/procurement RESULT pass=28 fails=0; procure.test 3/3', 'procurement rules (no payment)']],
  ['bf7b14ae-635f-4d86-8df6-737538003a60', 'Stage 2: company slice (invoice request through approval and reconciliation)', [CO + 'src/lib/finMigration.ts'], 'company finance slice'],
  ['6172fc72-e355-4936-8982-9afe46466a88', 'Command and receipt model for consequential actions', [CO + 'src/lib/migMigration.ts', CO + 'src/lib/mktMigration.ts'], 'commands, receipts, version check, append-only timeline',
    [[CO + 'dbchecks/migrations.ts', CO + 'dbchecks/campaigns.ts'], 'company-os dbchecks/migrations 25/25 (M23 every command has a receipt), dbchecks/campaigns 24/24', 'implementation and marketing commands']],
  ['db7b9161-1382-4090-b003-0fbbd6f9096d', 'Developer sandbox, app registration, scoped install and revocation', [S + 'src/lib/devMigration.ts', S + 'src/api/devApps.ts'], 'developer apps, scoped installs',
    [[S + 'tests/devAuth.test.ts'], 'devAuth.test 8/8', 'token, scope and install decisions (unit)']],
  ['c9170423-ada7-4bf9-9059-c516ef77524c', 'Revoked grants and apps fail on next protected operation', [S + 'src/lib/devMigration.ts'], 'install and app status re-read on each call',
    [[S + 'tests/devAuth.test.ts', S + 'dbchecks/officeService.ts'], 'devAuth.test "revoked install fails on the next call", "suspended app fails" pass; officeService R30 revoked appointment stops at once', 'developer installs and office staff appointments']],
  ['2ed57459-1482-4eb2-84f6-92dc55309a98', 'Marketing draft/review/approved publication workflow with sending disabled', [CO + 'src/lib/mktMigration.ts', CO + 'src/lib/pubRules.ts'], 'campaigns and site publications; sending is a CHECK-constrained disabled column',
    [[CO + 'dbchecks/campaigns.ts', CO + 'tests/pubRules.test.ts'], 'company-os dbchecks/campaigns RESULT pass=24 fails=0 (3 mutants caught); pubRules.test 15/15', 'separation of duties, content-bound approval, sending disabled']],
  ['735584e7-0775-497a-9e0c-ae64d3d03281', 'Approval binds exact target and payload', [CO + 'src/lib/mktMigration.ts', S + 'src/lib/osvMigration.ts', CO + 'src/lib/migMigration.ts'], 'approval carries a hash of what the approver saw',
    [[CO + 'dbchecks/campaigns.ts', S + 'dbchecks/officeService.ts'], 'campaigns K14 and officeService K5 pass; their "unseen content" mutants go red', 'campaign approval and knowledge-article publishing']],
  ['472ef3c4-42c3-43a4-9a94-67ac37b025cc', 'Evidence tracked per stage (designed→production) with reference, environment, timestamp, reviewer, scope', [LAB + 'src/api/addCapabilityEvidence.ts', LAB + 'src/lib/recordEvidence.ts'], 'stage evidence recorded under the accepting security lead, with reviewer separation'],
];

export const PROPOSALS: Proposal[] = ROWS.flatMap(([id, capability, files, scope, tested]) => {
  const out: Proposal[] = [{ key: `${id}:Implemented`, capabilityId: id, capability, stage: 'Implemented', environment: 'Preview', summary: `Implemented at commit ${PROPOSAL_COMMIT}`, reference: `commit ${PROPOSAL_COMMIT} · ${files.join(', ')}`, scope, files }];
  if (tested) out.push({ key: `${id}:Tested`, capabilityId: id, capability, stage: 'Tested', environment: 'Synthetic', summary: `Tested 29 Oct 2026 at commit ${PROPOSAL_COMMIT}`, reference: `commit ${PROPOSAL_COMMIT} · ${tested[1]} · ${tested[0].join(', ')}`, scope: tested[2], files: tested[0] });
  return out;
});
