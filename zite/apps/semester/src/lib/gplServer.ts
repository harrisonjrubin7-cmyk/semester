// Server helper: the grading policy in force for an institution (approved version, else the sample policy).
// Shared by transcripts (officialGrades) and the student grade tracker so both use the same scale.
import { pg } from './pg';
import { GPL_MIGRATION } from './gplMigration';
import { DEFAULT_POLICY, type GradingPolicy } from './transcriptRules';

let gplReady: Promise<void> | null = null;
export const ensureGpl = () => { if (!gplReady) gplReady = (async () => { for (const q of GPL_MIGRATION) await pg().query(q); })().catch((e) => { gplReady = null; throw e; }); return gplReady; };

export async function policyFor(T: string, institution: string): Promise<GradingPolicy & { version: number }> {
  await ensureGpl();
  const r = ((await pg().query(`SELECT version, policy FROM gpl_policies WHERE tenant_id = $1 AND status = 'Approved'`, [T])) as { version: number; policy: Omit<GradingPolicy, 'label' | 'source'> }[])[0];
  return r ? { ...r.policy, label: `${institution} grading policy, version ${r.version}`, source: 'institution', version: Number(r.version) } : { ...DEFAULT_POLICY, version: 0 };
}
