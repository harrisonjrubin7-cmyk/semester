// Turns an endpoint failure into something safe to show a person. The Zite caller throws
// `API call failed (STATUS): BODY`; the body may carry the server's userFacingMessage. Internal identifiers
// (authz:<rule>:<action>:<uuid>, stack traces, SQL) are never shown; a reference code may be.
export type ClientError = { status: number | null; message: string; denied: boolean; unavailable: boolean; reference: string | null };

const INTERNAL = /(^|\s)authz:|^[a-z_]+:[a-z_.]+:|\bat [\w.$]+ \(|\b(SELECT|INSERT|UPDATE|DELETE)\b.+\b(FROM|INTO|SET)\b|violates (check|unique|foreign key) constraint|ECONN|TypeError|ReferenceError/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function fromBody(body: string): { text: string | null; userFacing: string | null } {
  try {
    const j = JSON.parse(body) as Record<string, unknown>;
    const err = (j.error && typeof j.error === 'object' ? j.error : j) as Record<string, unknown>;
    const uf = [err.userFacingMessage, j.userFacingMessage].find((x) => typeof x === 'string' && x.trim()) as string | undefined;
    const msg = [err.message, typeof j.error === 'string' ? j.error : undefined, j.message].find((x) => typeof x === 'string' && x.trim()) as string | undefined;
    return { text: msg ?? null, userFacing: uf ?? null };
  } catch { return { text: body.trim() || null, userFacing: null }; }
}

export function readError(e: unknown): ClientError {
  const raw = (e instanceof Error ? e.message : typeof e === 'string' ? e : '') || '';
  const direct = (e as { userFacingMessage?: unknown } | null)?.userFacingMessage;
  const m = raw.match(/^API call failed \((\d{3})\):\s*([\s\S]*)$/);
  const status = m ? Number(m[1]) : null;
  const { text, userFacing } = m ? fromBody(m[2]) : { text: raw, userFacing: null };
  const candidate = (typeof direct === 'string' && direct.trim()) ? direct : userFacing;
  const internalText = text ?? '';
  const authz = /authz:/.test(internalText) || /authz:/.test(raw);
  const reference = (candidate?.match(/Reference ([0-9a-f]{8})/i)?.[1]) ?? (authz ? (internalText.match(UUID)?.[0] ?? raw.match(UUID)?.[0] ?? '').slice(0, 8) || null : null);
  const denied = status === 401 || status === 403 || authz;
  const unavailable = status !== null && status >= 500;
  let message: string;
  if (candidate) message = candidate;
  else if (text && !INTERNAL.test(text) && !UUID.test(text) && text.length <= 300 && !/^\s*[{<]/.test(text)) message = text;
  else if (denied) message = `You don’t have access to this.${reference ? ` (Reference ${reference})` : ''}`;
  else if (status === 404) message = 'This could not be found.';
  else if (unavailable) message = 'This is temporarily unavailable. Try again in a moment.';
  else message = 'Something went wrong. Try again.';
  return { status, message, denied, unavailable, reference };
}

export const friendlyError = (e: unknown) => readError(e).message;
