/**
 * Secret-safe logging. Everything the audit log or an execution record
 * persists passes through here first. The rules err on the side of removing
 * too much: a redacted value in a log is an inconvenience, a secret in a log
 * is an incident.
 */

const SECRET_KEY = /(secret|token|password|passwd|api[_-]?key|authorization|cookie|private[_-]?key|credential|session)/i;
const SECRET_VALUE = [
  /\b(?:sk|rk|pk)[-_](?:live|test|ant|proj)?[-_]?[A-Za-z0-9_-]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b[A-Fa-f0-9]{64,}\b/,
  /\b[A-Za-z0-9+/]{48,}={0,2}\b/,
  /\bpostgres(?:ql)?:\/\/[^\s'"]+:[^\s'"@]+@/i,
];
export const REDACTED = '[REDACTED]';

export function redactString(value: string): string {
  let out = value;
  for (const pattern of SECRET_VALUE) out = out.replace(new RegExp(pattern.source, `${pattern.flags}g`), REDACTED);
  return out;
}

export function redact<T>(value: T): T {
  return walk(value, false) as T;
}

function walk(value: unknown, underSecretKey: boolean): unknown {
  if (typeof value === 'string') return underSecretKey ? REDACTED : redactString(value);
  if (Array.isArray(value)) return value.map((item) => walk(item, underSecretKey));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const secret = underSecretKey || SECRET_KEY.test(key);
      out[key] = secret && (typeof item === 'string' || typeof item === 'number') ? REDACTED : walk(item, secret);
    }
    return out;
  }
  return value;
}
