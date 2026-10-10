import { cloud } from './cloud';
import { obj } from './device-library';

export const GUARDIAN_CALENDAR_FIELDS = [
  'student_id',
  'item_id',
  'title',
  'starts_at',
  'status',
  'source_observed_at',
  'expires_at',
] as const;

export type GuardianCalendarStatus = 'scheduled' | 'cancelled' | 'complete';

export interface GuardianCalendarItem {
  student_id: string;
  item_id: string;
  title: string;
  starts_at: string;
  status: GuardianCalendarStatus;
  source_observed_at: string;
  expires_at: string;
}

export type GuardianCalendarResult =
  | { kind: 'ready'; items: GuardianCalendarItem[] }
  | { kind: 'denied' | 'stale'; items: [] };

const isoTime = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));

function calendarItem(value: unknown, studentId: string, now: number): GuardianCalendarItem | 'stale' | null {
  if (!obj(value) || value.student_id !== studentId) return null;
  if (typeof value.item_id !== 'string' || !value.item_id || value.item_id.length > 160) return null;
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 160) return null;
  if (!isoTime(value.starts_at) || !isoTime(value.source_observed_at) || !isoTime(value.expires_at)) return null;
  if (!['scheduled', 'cancelled', 'complete'].includes(String(value.status))) return null;
  if (Date.parse(value.source_observed_at) > now + 5 * 60_000) return null;
  if (Date.parse(value.expires_at) <= now) return 'stale';
  return {
    student_id: value.student_id,
    item_id: value.item_id,
    title: value.title,
    starts_at: value.starts_at,
    status: value.status as GuardianCalendarStatus,
    source_observed_at: value.source_observed_at,
    expires_at: value.expires_at,
  };
}

export async function readGuardianCalendarProjection(
  studentId: string,
): Promise<GuardianCalendarResult> {
  if (!studentId || studentId.length > 64) return { kind: 'denied', items: [] };
  const { data, error } = await (await cloud()).rpc('read_guardian_calendar_projection', {
    wanted_student: studentId,
    wanted_purpose: 'guardian_portal',
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || data.length === 0) return { kind: 'denied', items: [] };
  // Freshness is decided after the network response arrives. Capturing this
  // before the await would let a projection that expired in transit render
  // until the component's next timer tick.
  const responseTime = Date.now();
  const parsed = data.map((value) => calendarItem(value, studentId, responseTime));
  if (parsed.some((value) => value === null)) return { kind: 'denied', items: [] };
  if (parsed.some((value) => value === 'stale')) return { kind: 'stale', items: [] };
  return { kind: 'ready', items: parsed as GuardianCalendarItem[] };
}

export interface GuardianProjectionAccessEvent {
  guardian_id: string;
  purpose: string;
  decision: 'allow' | 'deny';
  reason: 'allowed' | 'purpose_denied' | 'authority_missing_or_stale';
  fields_returned: string[];
  projection_count: number;
  read_at: string;
}

function accessEvent(value: unknown): GuardianProjectionAccessEvent | null {
  if (!obj(value) || typeof value.guardian_id !== 'string' || value.guardian_id.length > 64) return null;
  if (typeof value.purpose !== 'string' || value.purpose.length > 80) return null;
  if (value.decision !== 'allow' && value.decision !== 'deny') return null;
  if (!['allowed', 'purpose_denied', 'authority_missing_or_stale'].includes(String(value.reason))) return null;
  if (!Array.isArray(value.fields_returned) || value.fields_returned.some((field) =>
    typeof field !== 'string' || !GUARDIAN_CALENDAR_FIELDS.includes(field as (typeof GUARDIAN_CALENDAR_FIELDS)[number])
  )) return null;
  if (typeof value.projection_count !== 'number' || !Number.isInteger(value.projection_count)
    || value.projection_count < 0 || !isoTime(value.read_at)) return null;
  const allowed = value.decision === 'allow' && value.reason === 'allowed'
    && Number(value.projection_count) > 0 && value.fields_returned.length > 0;
  const denied = value.decision === 'deny' && value.reason !== 'allowed'
    && Number(value.projection_count) === 0 && value.fields_returned.length === 0;
  if (!allowed && !denied) return null;
  return {
    guardian_id: value.guardian_id,
    purpose: value.purpose,
    decision: value.decision,
    reason: value.reason as GuardianProjectionAccessEvent['reason'],
    fields_returned: [...value.fields_returned],
    projection_count: Number(value.projection_count),
    read_at: value.read_at,
  };
}

export async function readGuardianProjectionAccessHistory(): Promise<GuardianProjectionAccessEvent[]> {
  const { data, error } = await (await cloud()).rpc('read_guardian_projection_access_history');
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  const parsed = data.slice(0, 200).map(accessEvent);
  return parsed.some((event) => event === null) ? [] : parsed as GuardianProjectionAccessEvent[];
}
