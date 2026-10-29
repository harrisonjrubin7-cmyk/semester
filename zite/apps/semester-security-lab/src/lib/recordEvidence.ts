import { ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

// Server-only. The one place capability evidence is written: manual entry (api/addCapabilityEvidence) and accepting a proposal
// (api/evidenceProposals) both come through here, so both carry the same rules and the accepting reviewer's name.
export const STAGES = ['Designed', 'Implemented', 'Tested', 'Deployed', 'Institution-authorized', 'Production-enabled', 'Operationally accepted', 'Incumbent decommissioned'] as const;
export const ENVS = ['Synthetic', 'Preview', 'Staging', 'Production'] as const;
export type Stage = (typeof STAGES)[number];
export type Env = (typeof ENVS)[number];

export async function recordEvidence(reviewerId: string, e: { capabilityId: string; stage: Stage; environment: Env; summary: string; reference: string; scope: string }) {
  if (e.reference.trim().length < 10) throw new ZiteError('Evidence needs a concrete reference (run ID, test output, approval record).');
  if (!e.scope.trim()) throw new ZiteError('Say what scope this evidence covers.');
  if (['Deployed', 'Production-enabled', 'Operationally accepted', 'Incumbent decommissioned'].includes(e.stage) && e.environment === 'Synthetic')
    throw new ZiteError('Deployment or production evidence cannot come from a synthetic environment.');
  const cap = await zite.capabilityRegister.findOne({ id: e.capabilityId });
  if (!cap) throw new ZiteError('Capability not found.');
  // Reviewer separation (gap noted 26 Oct): whoever recorded the previous stage of this capability does not also record the next one.
  const idx = STAGES.indexOf(e.stage);
  if (idx > 0) {
    const { records } = await zite.capabilityEvidence.findAll({ filters: { capability: e.capabilityId }, limit: 500 });
    const prev = records.filter((r) => r.stage === STAGES[idx - 1]).map((r) => (Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer));
    if (prev.includes(reviewerId)) throw new ZiteError(`You recorded the ${STAGES[idx - 1]} evidence for this capability; another reviewer records ${e.stage}.`);
  }
  await zite.capabilityEvidence.create({
    record: {
      summary: e.summary.trim() || `${e.stage} evidence`, capability: [e.capabilityId], stage: e.stage,
      evidenceReference: e.reference.trim(), environment: e.environment, scope: e.scope.trim(),
      recordedAt: new Date().toISOString(), reviewer: reviewerId,
    },
  });
}
