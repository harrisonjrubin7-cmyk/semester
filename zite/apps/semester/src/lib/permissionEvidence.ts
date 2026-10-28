// Permission evidence register (owner sources S-92 §7–8, S-93 §8). Each of S-92's "cross-app security tests to execute
// first", with the decision Semester must make and the repeatable check that proves it. A row is "evidenced" only when a
// check in the repository denies exactly that case; the test (tests/permissionEvidence.test.ts) requires every cited
// label to appear verbatim in the cited file, so a renamed or deleted check breaks this register instead of silently
// leaving a stale claim. Live, one-off observations are recorded as gaps, not evidence.
export type EvidenceStatus = 'evidenced' | 'partial' | 'untested' | 'not built';
export type Proof = { file: string; label: string };
export type PermissionTest = { id: string; test: string; expected: string; status: EvidenceStatus; proofs: Proof[]; gap: string };

const K = 'apps/semester/dbchecks/', U = 'apps/semester/tests/';
export const S92_TESTS: PermissionTest[] = [
  { id: 'P01', test: 'Student A requests Student B’s submission directly', expected: 'Denied, including attachment access', status: 'partial',
    proofs: [{ file: U + 'authz.test.ts', label: 'student cannot read another student' }, { file: K + 'submissions.ts', label: 'S2 only the owner submits' }],
    gap: 'The policy rule and submit path are checked; the read and attachment path (learn.ts openAttachment) has no repeatable two-student check' },
  { id: 'P02', test: 'Instructor from another section requests a submission', expected: 'Denied', status: 'untested', proofs: [],
    gap: 'Enforced in learn.ts (loadSection + courseRole); no repeatable check yet' },
  { id: 'P03', test: 'Student requests unreleased grading', expected: 'Denied', status: 'untested', proofs: [],
    gap: 'learn.ts returns no score or feedback before release; observed in the two-account run of 28 Oct (C03) but no repeatable check' },
  { id: 'P04', test: 'Instructor searches for a private student study note', expected: 'No note, title, snippet, or count disclosure', status: 'untested', proofs: [],
    gap: 'Search filtering exists (api/search.ts); no check covers titles, snippets and counts' },
  { id: 'P05', test: 'Staff substitutes another institution’s hold ID', expected: 'Denied', status: 'evidenced',
    proofs: [{ file: K + 'holds.ts', label: 'H9 another institution cannot see or resume it' }], gap: '' },
  { id: 'P06', test: 'Staff without hold-release authority submits a release', expected: 'No state change', status: 'evidenced',
    proofs: [{ file: K + 'holds.ts', label: 'H1 a student cannot lift their own hold' }, { file: K + 'holds.ts', label: 'H13 the table itself refuses a self-release' }],
    gap: 'Office-specific releasing roles are checked in tests/holdRules.test.ts; a real staff account run is NOT RUN' },
  { id: 'P07', test: 'Roster client requests restricted financial/case fields', expected: 'Denied or excluded by the approved contract', status: 'evidenced',
    proofs: [{ file: U + 'rosterRules.test.ts', label: 'columns outside the allowlist are dropped and named, never kept' }], gap: 'Applies to the roster import; no outbound roster API exists' },
  { id: 'P08', test: 'Tool with score scope attempts result retrieval', expected: 'Denied', status: 'not built', proofs: [], gap: 'No LTI 1.3 / Advantage platform yet; scope policy from S-92 §5 to apply when built' },
  { id: 'P09', test: 'Tool uses a line item owned by another deployment', expected: 'Denied', status: 'not built', proofs: [], gap: 'No LTI Assignment and Grade Services yet' },
  { id: 'P10', test: 'Expired delegate opens an old file/search link', expected: 'Access rechecked and denied', status: 'partial',
    proofs: [{ file: K + 'familyInvites.ts', label: 'F14 nothing is visible after the end date' }, { file: K + 'familyInvites.ts', label: 'F17 the student revokes and access stops' }],
    gap: 'Family views are rechecked on every read; family members receive no file or search links today, so the link case does not arise yet' },
  { id: 'P11', test: 'Webhook for Institution A targets Institution B', expected: 'Rejected before effects', status: 'partial',
    proofs: [{ file: K + 'rosterGateway.ts', label: 'R5 the institution comes from the connection' }],
    gap: 'Inbound imports take the institution from the approved connection, never the payload; inbound webhooks are not built' },
  { id: 'P12', test: 'Replayed or out-of-order update arrives', expected: 'No duplicate effect or restoration of stale access', status: 'evidenced',
    proofs: [{ file: K + 'rosterGateway.ts', label: 'R15 a retry replays the same batch' }, { file: K + 'rosterGateway.ts', label: 'R17 an older update never overwrites a newer one' },
      { file: K + 'submissions.ts', label: 'S9 a reused key for different work is refused' }], gap: '' },
  { id: 'P13', test: 'AI is asked to retrieve another user’s protected record', expected: 'Denied at retrieval/tool boundaries', status: 'partial',
    proofs: [{ file: U + 'aiGate.test.ts', label: 'student records and the student’s own work are never sent to the AI provider' }],
    gap: 'Provider egress is blocked by data class; retrieval-boundary checks per user are not yet a repeatable test' },
];

export function evidenceProblems(list: PermissionTest[], read: (file: string) => string | null): string[] {
  const out: string[] = [];
  for (const t of list) {
    if ((t.status === 'evidenced' || t.status === 'partial') && !t.proofs.length) out.push(`${t.id}: ${t.status} needs a repeatable check`);
    if ((t.status === 'untested' || t.status === 'not built') && t.proofs.length) out.push(`${t.id}: ${t.status} must not cite proofs`);
    if (t.status !== 'evidenced' && !t.gap.trim()) out.push(`${t.id}: ${t.status} needs a stated gap`);
    for (const p of t.proofs) {
      const text = read(p.file);
      if (text == null) out.push(`${t.id}: ${p.file} does not exist`);
      else if (!text.includes(p.label)) out.push(`${t.id}: "${p.label}" is not in ${p.file}`);
    }
  }
  return out;
}
