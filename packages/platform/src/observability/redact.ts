/**
 * Redaction: what may be written to a log, a metric label, a trace attribute
 * or an audit `detail` field.
 *
 * The rule is by *key*, because by value is a guess. A field named `token`
 * holds a secret whatever it looks like; a field named `note` may hold
 * anything, so free text is never copied into telemetry at all, only its
 * length. Redaction runs on the way *in* to a log line or audit row — a leak
 * fixed at the sink is a leak in every other sink.
 */

const SECRET_KEY = /(pass(word|phrase)?|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key|session[_-]?key)/i;
const PERSONAL_KEY = /(e[_-]?mail|phone|ssn|social|date[_-]?of[_-]?birth|dob|address|first[_-]?name|last[_-]?name|full[_-]?name|student[_-]?number)/i;
const CONTENT_KEY = /^(body|content|text|note|notes|message|prompt|response|essay|answer|comment|transcript)$/i;

export const REDACTED = '[redacted]';
const MAX_DEPTH = 6;
const MAX_STRING = 256;

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return '[truncated]';
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(k) || PERSONAL_KEY.test(k)) out[k] = REDACTED;
    else if (CONTENT_KEY.test(k)) out[k] = typeof v === 'string' ? `[${v.length} chars]` : REDACTED;
    else out[k] = redact(v, depth + 1);
  }
  return out;
}
