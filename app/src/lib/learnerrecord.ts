/**
 * A learner's verified skill claims, as a 1EdTech CLR 2.0 credential document.
 *
 * The record is the student's, and this is the shape it leaves in: one
 * `ClrCredential` that wraps an Open Badges 3.0 `AchievementCredential` per
 * claim, so another system can read it without asking Semester what it means.
 * `docs/INTEROPERABILITY-ROADMAP.md` puts CLR at the end of the credential
 * lifecycle and says a badge ships only when every step before it is real.
 *
 * What this file does not do, on purpose:
 *
 *   - **It does not sign.** A Verifiable Credential is verifiable because an
 *     issuer's key signed it, and no issuer key exists here. The document
 *     carries no `proof`, and `signed` is the literal `false`, so nothing
 *     downstream can mistake it for a credential a verifier would accept. Add
 *     signing when an institution's key custody is real, not before.
 *   - **It does not vouch for the student's own words.** Only claims an
 *     institution verified (`institution_verified`) are exported. A suggested,
 *     student-confirmed or rejected claim is left out and listed in `omitted`
 *     with the reason, so the caller can say why a claim did not travel.
 *   - **It does not export what the student did not choose to share.** Evidence
 *     goes out as a title and, when the locator is a public web address, that
 *     address. The excerpt, which can hold coursework, never does, and neither
 *     does a locator that points at a private file.
 *
 * Context URLs are the published ones for the versions named, written from the
 * specifications and not yet run through 1EdTech's conformance validator.
 */

export type VerificationState = 'suggested' | 'student_confirmed' | 'institution_verified' | 'rejected';
export type EvidenceAuthority = 'authoritative' | 'confirmed' | 'unverified' | 'inferred';

export interface SkillClaimInput {
  id: string;
  skillName: string;
  verificationState: VerificationState;
  /** When the institution verified it; required for a claim to be exported. */
  verifiedAt: string | null;
  /** The evidence ids the claim rests on. */
  evidenceIds: readonly string[];
}

export interface EvidenceInput {
  id: string;
  title: string;
  authority: EvidenceAuthority;
  locator: string;
}

export interface LearnerRecordInput {
  /** The credential's own address, e.g. `https://semester.website/records/<id>`. */
  recordId: string;
  issuer: { id: string; name: string };
  learner: { id: string; name: string };
  claims: readonly SkillClaimInput[];
  evidence: readonly EvidenceInput[];
  /** ISO timestamp the record is issued at; passed in so the output is reproducible. */
  issuedAt: string;
}

export type OmitReason = 'not_institution_verified' | 'missing_verification_date';

export interface LearnerRecordExport {
  /** Always false: this document has no proof. See the file header. */
  signed: false;
  credential: ClrCredential;
  omitted: readonly { claimId: string; reason: OmitReason }[];
}

export const CONTEXT = [
  'https://www.w3.org/ns/credentials/v2',
  'https://purl.imsglobal.org/spec/clr/v2p0/context-2.0.1.json',
  'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
] as const;

interface Profile { id: string; type: readonly string[]; name: string }
interface AchievementEvidence { type: readonly string[]; id?: string; name: string }
interface Achievement {
  id: string;
  type: readonly string[];
  name: string;
  achievementType: string;
  criteria: { narrative: string };
  description: string;
}
interface AchievementCredential {
  '@context': readonly string[];
  id: string;
  type: readonly string[];
  issuer: Profile;
  validFrom: string;
  credentialSubject: {
    type: readonly string[];
    id: string;
    achievement: Achievement;
  };
  evidence?: readonly AchievementEvidence[];
}
export interface ClrCredential {
  '@context': readonly string[];
  id: string;
  type: readonly string[];
  issuer: Profile;
  validFrom: string;
  name: string;
  credentialSubject: {
    type: readonly string[];
    id: string;
    verifiableCredential: readonly AchievementCredential[];
  };
}

const isPublicWebAddress = (locator: string): boolean => {
  try {
    const u = new URL(locator);
    return u.protocol === 'https:' && u.hostname.includes('.') && !u.username && !u.password;
  } catch {
    return false;
  }
};

const profile = (p: { id: string; name: string }): Profile => ({ id: p.id, type: ['Profile'], name: p.name });

/** Export a learner's institution-verified claims as an unsigned CLR 2.0 document. */
export function exportLearnerRecord(input: LearnerRecordInput): LearnerRecordExport {
  const issuer = profile(input.issuer);
  const evidenceById = new Map(input.evidence.map((e) => [e.id, e]));
  const omitted: { claimId: string; reason: OmitReason }[] = [];
  const credentials: AchievementCredential[] = [];

  for (const claim of input.claims) {
    if (claim.verificationState !== 'institution_verified') {
      omitted.push({ claimId: claim.id, reason: 'not_institution_verified' });
      continue;
    }
    if (!claim.verifiedAt) {
      omitted.push({ claimId: claim.id, reason: 'missing_verification_date' });
      continue;
    }
    const evidence: AchievementEvidence[] = claim.evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((e): e is EvidenceInput => e !== undefined && (e.authority === 'authoritative' || e.authority === 'confirmed'))
      .map((e) => ({ type: ['Evidence'], ...(isPublicWebAddress(e.locator) ? { id: e.locator } : {}), name: e.title }));

    credentials.push({
      '@context': CONTEXT.slice(0, 1).concat(CONTEXT[2]),
      id: `${input.recordId}#claim-${claim.id}`,
      type: ['VerifiableCredential', 'OpenBadgeCredential'],
      issuer,
      validFrom: claim.verifiedAt,
      credentialSubject: {
        type: ['AchievementSubject'],
        id: input.learner.id,
        achievement: {
          id: `${input.issuer.id}/achievements/${claim.id}`,
          type: ['Achievement'],
          name: claim.skillName,
          achievementType: 'Competency',
          description: `Verified by ${input.issuer.name}.`,
          criteria: { narrative: `${input.issuer.name} verified this skill against the evidence attached to it.` },
        },
      },
      ...(evidence.length > 0 ? { evidence } : {}),
    });
  }

  return {
    signed: false,
    omitted,
    credential: {
      '@context': CONTEXT,
      id: input.recordId,
      type: ['VerifiableCredential', 'ClrCredential'],
      issuer,
      validFrom: input.issuedAt,
      name: `${input.learner.name}: learner record`,
      credentialSubject: { type: ['ClrSubject'], id: input.learner.id, verifiableCredential: credentials },
    },
  };
}
