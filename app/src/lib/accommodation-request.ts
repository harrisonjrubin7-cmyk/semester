import { cloud } from './cloud';

export const ACCOMMODATION_PRIVACY_NOTICE = '2026-10-27';

export type AccommodationRequestKind =
  | 'accommodation_support'
  | 'accessibility_barrier'
  | 'alternate_format'
  | 'communication_access'
  | 'other';

export type AccommodationRequestState = 'submitted' | 'in_review' | 'needs_student' | 'resolved' | 'withdrawn';

export interface AccommodationRequestInput {
  kind: AccommodationRequestKind;
  summary: string;
  consent: boolean;
}

export interface AccommodationRequestReceipt {
  id: string;
  status: 'submitted';
  ownerSeat: 'disability_services_officer';
}

export interface AccommodationRequestStatus {
  id: string;
  kind: AccommodationRequestKind;
  summary: string;
  status: AccommodationRequestState;
  ownerSeat: 'disability_services_officer';
  responseDueAt: string;
  escalationAt: string;
  correctionCount: number;
  resolutionCode: string | null;
  followUpRequestedAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
  withdrawnAt: string | null;
}

function requestKey(): string {
  const key = globalThis.crypto?.randomUUID?.();
  if (!key) throw new Error('Secure request creation is unavailable in this browser.');
  return key;
}

/** The server derives the signed-in student and school; the browser never supplies either. */
export async function raiseAccommodationRequest(input: AccommodationRequestInput): Promise<AccommodationRequestReceipt> {
  const summary = input.summary.trim();
  if (!summary || summary.length > 1000) throw new Error('Describe what you need in 1,000 characters or fewer.');
  if (!input.consent) throw new Error('Read and accept the privacy notice before sending.');
  const { data, error } = await (await cloud()).rpc('raise_accommodation_support_request', {
    want_key: requestKey(),
    want_kind: input.kind,
    want_summary: summary,
    want_privacy_notice: ACCOMMODATION_PRIVACY_NOTICE,
    want_consent: true,
  });
  if (error) throw new Error(error.message);
  if (typeof data !== 'string' || !data) throw new Error('The access office route returned no receipt.');
  return { id: data, status: 'submitted', ownerSeat: 'disability_services_officer' };
}

/** Read only request rows owned by the current authenticated student. */
export async function myAccommodationRequests(): Promise<AccommodationRequestStatus[]> {
  const { data, error } = await (await cloud()).rpc('my_accommodation_support_requests');
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    kind: row.kind as AccommodationRequestKind,
    summary: String(row.summary),
    status: row.status as AccommodationRequestState,
    ownerSeat: 'disability_services_officer',
    responseDueAt: String(row.response_due_at),
    escalationAt: String(row.escalation_at),
    correctionCount: Number(row.correction_count),
    resolutionCode: typeof row.resolution_code === 'string' ? row.resolution_code : null,
    followUpRequestedAt: typeof row.follow_up_requested_at === 'string' ? row.follow_up_requested_at : null,
    createdAt: String(row.created_at),
    resolvedAt: typeof row.resolved_at === 'string' ? row.resolved_at : null,
    withdrawnAt: typeof row.withdrawn_at === 'string' ? row.withdrawn_at : null,
  }));
}

/** Append a correction without rewriting the original request or prior corrections. */
export async function correctAccommodationRequest(id: string, summary: string): Promise<void> {
  const next = summary.trim();
  if (!next || next.length > 1000) throw new Error('Write the corrected request in 1,000 characters or fewer.');
  const { error } = await (await cloud()).rpc('correct_accommodation_support_request', {
    want_id: id,
    want_key: requestKey(),
    want_summary: next,
  });
  if (error) throw new Error(error.message);
}

/** Withdraw the student's own still-open request. */
export async function withdrawAccommodationRequest(id: string): Promise<void> {
  const { error } = await (await cloud()).rpc('withdraw_accommodation_support_request', { want_id: id });
  if (error) throw new Error(error.message);
}
