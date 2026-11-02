import { cloud } from './cloud';

export type AiRemedyCategory = 'incorrect' | 'source' | 'policy' | 'accessibility' | 'harmful';
export type AiRemedySourceStrength = 'strong' | 'limited' | 'none';
export type AiRemedyPolicyState = 'allowed' | 'limited' | 'unavailable';

export interface AiRemedyInput {
  category: AiRemedyCategory;
  summary: string;
  answer: string;
  sourceStrength: AiRemedySourceStrength;
  policyState: AiRemedyPolicyState;
  sourceCount: number;
}

export interface AiRemedyReceipt {
  id: string;
  status: 'submitted';
  ownerSeat: 'trust_officer';
}

export interface AiRemedyStatus {
  id: string;
  category: AiRemedyCategory;
  evidenceReference: string;
  status: 'submitted' | 'in_review' | 'resolved';
  ownerSeat: 'trust_officer';
  responseDueAt: string;
  escalationAt: string;
  resolutionCode: string | null;
  resolutionEvidence: string | null;
}

export async function sha256(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure evidence linking is unavailable in this browser.');
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Submit an evidence-linked request. Tenant and reporter are derived by the server. */
export async function raiseAiAnswerRemedy(input: AiRemedyInput): Promise<AiRemedyReceipt> {
  const summary = input.summary.trim();
  if (!summary || summary.length > 2000) throw new Error('Describe the problem in 2,000 characters or fewer.');
  const key = globalThis.crypto?.randomUUID?.();
  if (!key) throw new Error('Secure request creation is unavailable in this browser.');
  const answerHash = await sha256(input.answer);
  const { data, error } = await (await cloud()).rpc('raise_ai_answer_remedy', {
    want_key: key,
    want_category: input.category,
    want_summary: summary,
    want_answer_sha256: answerHash,
    want_source_strength: input.sourceStrength,
    want_policy_state: input.policyState,
    want_source_count: input.sourceCount,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== 'string' || !data) throw new Error('The review service returned no receipt.');
  return { id: data, status: 'submitted', ownerSeat: 'trust_officer' };
}

/** Read only the signed-in reporter's own server-derived status rows. */
export async function myAiAnswerRemedies(): Promise<AiRemedyStatus[]> {
  const { data, error } = await (await cloud()).rpc('my_ai_answer_remedies');
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    category: row.category as AiRemedyCategory,
    evidenceReference: String(row.evidence_reference),
    status: row.status as AiRemedyStatus['status'],
    ownerSeat: 'trust_officer',
    responseDueAt: String(row.response_due_at),
    escalationAt: String(row.escalation_at),
    resolutionCode: typeof row.resolution_code === 'string' ? row.resolution_code : null,
    resolutionEvidence: typeof row.resolution_evidence === 'string' ? row.resolution_evidence : null,
  }));
}
