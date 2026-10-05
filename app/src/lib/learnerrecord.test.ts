import { describe, expect, it } from 'vitest';
import { CONTEXT, exportLearnerRecord, type LearnerRecordInput } from './learnerrecord';

const base: LearnerRecordInput = {
  recordId: 'https://semester.website/records/r1',
  issuer: { id: 'https://vanderbilt.example/issuer', name: 'Example University' },
  learner: { id: 'https://semester.website/learners/l1', name: 'Ada Learner' },
  issuedAt: '2026-09-30T12:00:00Z',
  evidence: [
    { id: 'e-pub', title: 'Regression report', authority: 'authoritative', locator: 'https://example.edu/reports/1' },
    { id: 'e-priv', title: 'Lab notebook', authority: 'confirmed', locator: 'file:///home/ada/notebook.pdf' },
    { id: 'e-weak', title: 'Guess from notes', authority: 'inferred', locator: 'https://example.edu/notes' },
  ],
  claims: [
    { id: 'c-ok', skillName: 'Data analysis', verificationState: 'institution_verified', verifiedAt: '2026-09-01T00:00:00Z', evidenceIds: ['e-pub', 'e-priv', 'e-weak', 'e-missing'] },
    { id: 'c-sug', skillName: 'Writing', verificationState: 'suggested', verifiedAt: null, evidenceIds: [] },
    { id: 'c-conf', skillName: 'Public speaking', verificationState: 'student_confirmed', verifiedAt: null, evidenceIds: [] },
    { id: 'c-rej', skillName: 'Coding', verificationState: 'rejected', verifiedAt: null, evidenceIds: [] },
    { id: 'c-nodate', skillName: 'Statistics', verificationState: 'institution_verified', verifiedAt: null, evidenceIds: [] },
  ],
};

describe('the learner record export', () => {
  const out = exportLearnerRecord(base);
  const creds = out.credential.credentialSubject.verifiableCredential;

  it('is an unsigned CLR 2.0 document, and says so', () => {
    expect(out.signed).toBe(false);
    expect(out.credential.type).toEqual(['VerifiableCredential', 'ClrCredential']);
    expect(out.credential['@context']).toEqual(CONTEXT);
    expect(JSON.stringify(out)).not.toContain('"proof"');
  });

  it('exports only institution-verified claims, and says why each other one stayed', () => {
    expect(creds.map((c) => c.credentialSubject.achievement.name)).toEqual(['Data analysis']);
    expect(out.omitted).toEqual([
      { claimId: 'c-sug', reason: 'not_institution_verified' },
      { claimId: 'c-conf', reason: 'not_institution_verified' },
      { claimId: 'c-rej', reason: 'not_institution_verified' },
      { claimId: 'c-nodate', reason: 'missing_verification_date' },
    ]);
  });

  it('attaches only authoritative or confirmed evidence, and an address only when it is public', () => {
    expect(creds[0]?.evidence).toEqual([
      { type: ['Evidence'], id: 'https://example.edu/reports/1', name: 'Regression report' },
      { type: ['Evidence'], name: 'Lab notebook' },
    ]);
  });

  it('never carries an excerpt or a private locator', () => {
    const json = JSON.stringify(exportLearnerRecord({ ...base, evidence: base.evidence.map((e) => ({ ...e, excerpt: 'SECRET' })) as never }));
    expect(json).not.toContain('SECRET');
    expect(json).not.toContain('file://');
  });

  it('dates each achievement from its verification, and is reproducible', () => {
    expect(creds[0]?.validFrom).toBe('2026-09-01T00:00:00Z');
    expect(exportLearnerRecord(base)).toEqual(out);
  });

  it('is an empty record, not an error, when nothing is verified', () => {
    const none = exportLearnerRecord({ ...base, claims: base.claims.slice(1, 4) });
    expect(none.credential.credentialSubject.verifiableCredential).toEqual([]);
    expect(none.omitted).toHaveLength(3);
  });
});
