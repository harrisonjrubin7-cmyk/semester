// Generated from app/src/lib/integration/redact.ts by app/scripts/edge-integration.ts. Do not edit;
// change the source and run `cd app && node scripts/edge-integration.ts`.

/**
 * What may leave the gateway in an error, a log line or a dashboard cell.
 *
 * The sync-error table accepts at most 500 characters of `sanitized_message`
 * and an external reference only as `sha256:<hex>`. These are the two
 * functions that produce those, so nothing else has to remember how.
 */

const PATTERNS: readonly [RegExp, string][] = [
  // Bearer tokens and JWTs.
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[jwt]'],
  // Common API key shapes.
  [/\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}\b/g, '[key]'],
  [/\bsk-ant-[A-Za-z0-9_-]{8,}\b/g, '[key]'],
  [/\bsk-[A-Za-z0-9]{20,}\b/g, '[key]'],
  // key=value secrets in query strings or bodies.
  [/\b(access_token|refresh_token|client_secret|api_key|apikey|password|secret|token)=([^&\s"']+)/gi, '$1=[redacted]'],
  [/"(access_token|refresh_token|client_secret|api_key|password|secret|token)"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"'],
  // Email addresses.
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email]'],
  // Student-number-like runs of digits.
  [/\b\d{6,}\b/g, '[id]'],
];

export function sanitizeMessage(input: unknown): string {
  let text = typeof input === 'string' ? input : input instanceof Error ? input.message : String(input ?? '');
  for (const [pattern, replacement] of PATTERNS) text = text.replace(pattern, replacement);
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return 'Unknown error';
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A reference to an external record that can be correlated by an operator who
 * already holds the id, and read by nobody else. Salted per tenant so one
 * school's hash says nothing about another's.
 */
export async function redactReference(tenantId: string, externalId: string | null | undefined): Promise<string> {
  if (!externalId) return 'redacted';
  return `sha256:${(await sha256Hex(`${tenantId}:${externalId}`)).slice(0, 32)}`;
}

export async function payloadHash(payload: unknown): Promise<string> {
  return `sha256:${await sha256Hex(JSON.stringify(payload ?? null))}`;
}
