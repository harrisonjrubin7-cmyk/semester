/** Student-owned intake and tracking for the audited data-subject queue. */

import { cloud, failed } from './cloud';

export const DATA_RIGHT_KINDS = ['export', 'correction', 'restriction', 'erasure'] as const;
export type DataRightKind = (typeof DATA_RIGHT_KINDS)[number];
export type DataRightStatus = 'received' | 'verifying' | 'in_progress' | 'completed' | 'refused';

export interface DataRightRequest {
  id: string;
  kind: DataRightKind;
  status: DataRightStatus;
  detail: string;
  receivedAt: string;
  dueAt: string;
  resolvedAt: string | null;
  resolution: string;
}

export interface PrivacyCompletionCertificate {
  certificateId: string;
  requestRef: string;
  kind: DataRightKind;
  evidenceReference: string;
  issuedAt: string;
}

export const DATA_RIGHT_COPY: Record<DataRightKind, { label: string; help: string }> = {
  export: { label: 'Formal access or export request', help: 'Ask for a tracked response about the account data Semester holds.' },
  correction: { label: 'Correct account data', help: 'Name information you believe is inaccurate and what should be checked.' },
  restriction: { label: 'Restrict processing', help: 'Ask Semester to review or pause a particular use while it is checked.' },
  erasure: { label: 'Request assisted erasure', help: 'Ask for human help with deletion, including a hold or account-access question.' },
};

export const DATA_RIGHT_STATUS: Record<DataRightStatus, string> = {
  received: 'Received',
  verifying: 'Verifying identity or authority',
  in_progress: 'In progress',
  completed: 'Completed',
  refused: 'Refused with a reason',
};

const FIELDS = 'id,kind,status,detail,received_at,due_at,resolved_at,resolution';

function request(row: Record<string, unknown>): DataRightRequest {
  return {
    id: String(row.id ?? ''),
    kind: row.kind as DataRightKind,
    status: row.status as DataRightStatus,
    detail: String(row.detail ?? ''),
    receivedAt: String(row.received_at ?? ''),
    dueAt: String(row.due_at ?? ''),
    resolvedAt: row.resolved_at == null ? null : String(row.resolved_at),
    resolution: String(row.resolution ?? ''),
  };
}

export function isOpen(item: DataRightRequest): boolean {
  return item.status !== 'completed' && item.status !== 'refused';
}

export async function loadDataRightRequests(): Promise<DataRightRequest[]> {
  const { data, error } = await (await cloud())
    .from('data_subject_request')
    .select(FIELDS)
    .order('received_at', { ascending: false });
  if (error) throw failed(error);
  return ((data ?? []) as Record<string, unknown>[]).map(request);
}

export async function loadPrivacyCompletionCertificates(): Promise<PrivacyCompletionCertificate[]> {
  const { data, error } = await (await cloud()).rpc('my_privacy_completion_certificates');
  if (error) throw failed(error);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    certificateId: String(row.certificate_id ?? ''),
    requestRef: String(row.request_ref ?? ''),
    kind: DATA_RIGHT_KINDS.includes(row.kind as DataRightKind) ? row.kind as DataRightKind : 'restriction',
    evidenceReference: String(row.evidence_reference ?? ''),
    issuedAt: String(row.issued_at ?? ''),
  }));
}

export async function fileDataRightRequest(
  kind: DataRightKind,
  detail: string,
): Promise<{ item: DataRightRequest; created: boolean }> {
  if (!DATA_RIGHT_KINDS.includes(kind)) throw new Error('Choose a data-rights request type.');
  const clean = detail.trim();
  if (clean.length > 1000) throw new Error('Keep the request detail to 1,000 characters or fewer.');

  const before = await loadDataRightRequests();
  const existing = before.find((item) => item.kind === kind && isOpen(item));
  if (existing) return { item: existing, created: false };

  const { data: id, error } = await (await cloud()).rpc('raise_my_data_subject_request', {
    requested_kind: kind,
    requested_detail: clean,
  });
  if (error) throw failed(error);

  const after = await loadDataRightRequests();
  const item = after.find((candidate) => candidate.id === id);
  if (!item) throw new Error('The request may have been received, but its status could not be read. Reload before filing it again.');
  return { item, created: true };
}
