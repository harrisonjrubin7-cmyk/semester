const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export class ProofUnavailable extends Error {}

function loopbackOrigin(origin) {
  const parsed = new URL(origin);
  if (parsed.origin !== origin || parsed.protocol !== 'http:' || !LOOPBACK.has(parsed.hostname)) {
    throw new Error('Account deletion proof requires an exact loopback HTTP origin.');
  }
  return parsed.origin;
}

function required(value, name) {
  if (typeof value !== 'string' || !value) throw new Error(`Account deletion proof requires ${name}.`);
  return value;
}

async function responseFrom(request, url, options, operation) {
  try {
    return await request(url, options);
  } catch (error) {
    throw new ProofUnavailable(`${operation} could not reach the local Supabase stack: ${String(error).split('\n')[0]}`);
  }
}

async function jsonFrom(response, operation) {
  try {
    return await response.json();
  } catch {
    throw new ProofUnavailable(`${operation} returned an unreadable response.`);
  }
}

const isLegacyJwt = (key) => /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key);

/**
 * Try to recreate the deleted account's protected state with its old access
 * token. This is the application-data write the lifecycle smoke claims to
 * deny; retrying the delete Edge Function would exercise a different route.
 */
export async function tryDeletedAccountStateWrite({ origin, publicKey, staleToken, userId, request = fetch }) {
  const base = loopbackOrigin(origin);
  const response = await responseFrom(request, `${base}/rest/v1/state?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: required(publicKey, 'the local publishable key'),
      Authorization: `Bearer ${required(staleToken, 'the deleted account token')}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      user_id: required(userId, 'the deleted account id'),
      data: { deletion_probe: true },
    }),
  }, 'The stale-token state write');
  if (response.ok) return { denied: false, status: response.status, reason: 'accepted' };
  if (response.status === 401 || response.status === 403) {
    return { denied: true, status: response.status, reason: 'authorization' };
  }
  if (response.status === 409) {
    const body = await jsonFrom(response, 'The stale-token state write');
    if (body?.code === '23503') return { denied: true, status: response.status, reason: 'deleted-user' };
  }
  throw new ProofUnavailable(`The stale-token state write returned an unrelated status (${response.status}).`);
}

/**
 * Independently verify deletion through local administrative reads. The
 * service key never enters the browser and is refused unless the target is a
 * loopback Supabase started for this test run.
 */
export async function proveDeletedAccountAbsent({ origin, serviceKey, userId, request = fetch }) {
  const base = loopbackOrigin(origin);
  const key = required(serviceKey, 'the local service key');
  const id = required(userId, 'the deleted account id');
  const headers = { apikey: key, ...(isLegacyJwt(key) ? { Authorization: `Bearer ${key}` } : {}) };

  const authUser = await responseFrom(
    request,
    `${base}/auth/v1/admin/users/${encodeURIComponent(id)}`,
    { headers },
    'The deleted auth-user check',
  );
  if (authUser.status !== 200 && authUser.status !== 404) {
    throw new ProofUnavailable(`The deleted auth-user check returned status ${authUser.status}.`);
  }

  const state = await responseFrom(
    request,
    `${base}/rest/v1/state?user_id=eq.${encodeURIComponent(id)}&select=user_id`,
    { headers },
    'The deleted application-state check',
  );
  if (!state.ok) throw new ProofUnavailable(`The deleted application-state check returned status ${state.status}.`);
  const rows = await jsonFrom(state, 'The deleted application-state check');
  if (!Array.isArray(rows)) throw new ProofUnavailable('The deleted application-state check returned a non-row response.');

  return { authUserAbsent: authUser.status === 404, stateAbsent: rows.length === 0 };
}
