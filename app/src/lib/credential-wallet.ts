import type { Evidence } from './career-evidence';
import { reviewedSkills } from './career-evidence';
import type { SkillClaim } from './skills-graph';

export type WalletAuthority = 'Student confirmed' | 'Institution verified' | 'Student selected';

export interface WalletItem {
  id: string;
  kind: 'skill' | 'artifact';
  title: string;
  authority: WalletAuthority;
  evidence: string[];
  updatedAt: number | null;
}

/** Only claims the student confirmed and artifacts they deliberately added enter the wallet. */
export function walletItems(claims: SkillClaim[], evidence: Evidence): WalletItem[] {
  const claimBySlug = new Map(claims.map((claim) => [claim.skill.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), claim]));
  const skills = reviewedSkills(claims, evidence)
    .filter((skill) => skill.state === 'confirmed')
    .map((skill): WalletItem => {
      const claim = claimBySlug.get(skill.key);
      return {
        id: `skill:${skill.key}`,
        kind: 'skill',
        title: skill.name,
        authority: claim?.verification === 'institution-verified' ? 'Institution verified' : 'Student confirmed',
        evidence: skill.evidence.map((item) => item.label),
        updatedAt: skill.origin === 'added'
          ? evidence.own.find((item) => `own:${item.id}` === skill.key)?.at ?? null
          : evidence.decisions[skill.key]?.at ?? null,
      };
    });
  const artifacts = evidence.artifacts.map((artifact): WalletItem => ({
    id: `artifact:${artifact.id}`,
    kind: 'artifact',
    title: artifact.title,
    authority: 'Student selected',
    evidence: [artifact.evidence.label, ...artifact.skills],
    updatedAt: null,
  }));
  return [...skills, ...artifacts].sort((a, b) => a.title.localeCompare(b.title));
}

export function walletExport(items: readonly WalletItem[], selected: readonly string[], createdAt: string) {
  const allow = new Set(selected);
  return {
    type: 'Semester learner-controlled credential wallet export',
    version: 1,
    createdAt,
    officialTranscript: false,
    notice: 'Not an official transcript or institution-issued credential. Verify each item using its authority label and evidence.',
    items: items.filter((item) => allow.has(item.id)),
  };
}
