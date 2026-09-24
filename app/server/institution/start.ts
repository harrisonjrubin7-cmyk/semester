import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ActionJournal, type ActionJournalStore } from './journal.ts';
import { PostgresActionJournal } from './postgres-journal.ts';
import { MemoryRateLimiter, PostgresRateLimiter } from './rate-limit.ts';
import { MemoryIntelligenceActionStore, PostgresIntelligenceActionStore } from './intelligence-action-store.ts';
import { MAX_BODY, createGateway } from './gateway.ts';
import { supabaseIdentity } from './auth.ts';
import {
  createMembershipResolver,
  supabaseMembershipDirectory,
  supabaseSsoConfigLoader,
} from './membership.ts';
import { adapters } from './adapters.ts';
import { SANDBOX_NAME, SandboxStore, sandboxAdapters } from './sandbox.ts';
import { createInstitutionIntelligenceRuntime } from './intelligence-runtime.ts';

/**
 * The process. Everything the gateway needs before it can answer anything.
 *
 * `gateway.ts` is a function from a `Request` to a `Response` and knows nothing
 * about sockets, files or the environment. This file is the part that does: it
 * reads the configuration, refuses to start on a bad one, opens the journal,
 * and puts an HTTP server in front.
 *
 * ## It refuses rather than defaults
 *
 * A misconfigured origin or a missing journal key throws on the way up, with a
 * message saying what to set. The alternative — starting with a permissive
 * origin or an unencrypted journal — is a server that looks like it works and
 * is the reason the checks exist. Every one of these is cheap to fix at boot
 * and impossible to notice at runtime.
 *
 * ## It listens on loopback
 *
 * `127.0.0.1`, not `0.0.0.0`. This is a single-host service holding a
 * decryption key and a record of students' academic actions; putting it on a
 * network interface is a deployment decision, made deliberately by whatever
 * terminates TLS in front of it, not a default.
 *
 * ## No adapters
 *
 * `adapters.ts` is empty, and the startup line says so. With none installed
 * every route that needs one answers 503 and the app's screens draw the
 * not-connected state. That is the shipped configuration; an institution
 * adapter is added once it is approved and tested, not before.
 *
 * ## Except the sandbox, which is asked for by name
 *
 * `SEMESTER_SANDBOX_INSTITUTION=1` installs the four adapters in
 * `sandbox.ts` — a demonstration course that runs the whole enrol → submit →
 * receipt → mark → release → archive loop against nobody. The completion
 * plan's Phase 1 asks for it in those words, to build and demonstrate the
 * vertical *"wherever real institutional credentials aren't yet available,
 * so nothing here is ever a placeholder success state presented as real"*.
 *
 * It is a separate switch from `adapters.ts` rather than an entry in it
 * because the two mean opposite things. That array says "a school has
 * approved this for its students' real records"; this variable says "none
 * of what follows is real". Collapsing them would make the honest empty
 * registry unreadable — the thing every screen relies on to say "prepare
 * only" — and would put a demonstration one import away from a deployment.
 * The startup line names whichever is running, so a server that is
 * pretending says so in its first line of output.
 */

// The journal and its database file are readable by this user and nobody else.
process.umask(0o077);

/**
 * Exactly one origin, and it has to be a real one.
 *
 * `new URL(x).origin !== x` catches a value with a path, a trailing slash or
 * credentials on it — all of which compare unequal to the browser's `Origin`
 * header and would silently allow nothing, or worse, be "fixed" later by
 * loosening the comparison. Plain http is permitted only for loopback, where
 * there is no network to intercept.
 */
function appOrigin(): string {
  const origin = process.env.SEMESTER_APP_ORIGIN || 'http://localhost:5173';
  const parsed = new URL(origin);
  const local = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.origin !== origin || !(parsed.protocol === 'https:' || local)) {
    throw new Error('Set SEMESTER_APP_ORIGIN to an exact HTTPS application origin (or localhost while developing).');
  }
  return origin;
}

/** Thirty-two bytes as hex, from the environment, never from a file the app serves. */
function journalKey(): Buffer {
  const secret = process.env.SEMESTER_JOURNAL_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(secret)) {
    throw new Error('Set SEMESTER_JOURNAL_KEY to 32 random bytes encoded as hex, stored only on the server.');
  }
  return Buffer.from(secret, 'hex');
}

/**
 * Where the sandbox keeps its coursework, with its directory made first.
 *
 * `openJournal` below makes its own, and by default the two share one — so
 * for as long as nobody moved either, the journal's `mkdirSync` happened to
 * cover this as well. That is a dependency on the default value of another
 * variable and on the order these two run in, which is not a thing to leave
 * standing: point `SEMESTER_SANDBOX_PATH` somewhere of its own and the store
 * would have thrown on a directory that does not exist.
 */
function sandboxPath(): string {
  const file = resolve(process.env.SEMESTER_SANDBOX_PATH || 'work/university/private/sandbox.sqlite');
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  return file;
}

function openJournal(key: Buffer): ActionJournal {
  const file = resolve(process.env.SEMESTER_JOURNAL_PATH || 'work/university/private/actions.sqlite');
  // 0o700: the directory holding prepared actions is not world-readable.
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  return new ActionJournal(file, key);
}

/**
 * Read the body, or refuse it.
 *
 * The bound is enforced while the bytes arrive rather than after, so an
 * oversized upload is answered and dropped instead of being buffered in full
 * and then rejected — which would make the limit a way to spend the server's
 * memory rather than a way to protect it.
 */
async function readBody(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function headersOf(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value);
  }
  return headers;
}

const authUrl = process.env.SEMESTER_AUTH_URL || '';
const authKey = process.env.SEMESTER_AUTH_PUBLIC_KEY || '';
const authServiceKey = process.env.SEMESTER_AUTH_SERVICE_KEY || '';
const ssoDomain = (process.env.SEMESTER_SSO_DOMAIN || '').trim().toLowerCase();
const ssoLabel = (process.env.SEMESTER_SSO_LABEL || '').trim();
const key = journalKey();
const sharedStore = process.env.SEMESTER_GATEWAY_STORE === 'postgres';
if (sharedStore && (!authUrl || !authServiceKey)) {
  throw new Error('SEMESTER_GATEWAY_STORE=postgres requires SEMESTER_AUTH_URL and SEMESTER_AUTH_SERVICE_KEY.');
}
const journal: ActionJournalStore = sharedStore
  ? new PostgresActionJournal({ url: authUrl, serviceKey: authServiceKey, encryptionKey: key })
  : openJournal(key);
const rateLimiter = sharedStore
  ? new PostgresRateLimiter({ url: authUrl, serviceKey: authServiceKey })
  : new MemoryRateLimiter();
const intelligenceActions = sharedStore
  ? new PostgresIntelligenceActionStore({ url: authUrl, serviceKey: authServiceKey, encryptionKey: key })
  : new MemoryIntelligenceActionStore();

/*
 * With no auth project configured nothing authenticates, and the gateway
 * answers 401 to everything that needs an identity. That is the correct
 * unconfigured behaviour: the alternative to checking a token is refusing, not
 * trusting one.
 */
const membershipResolver = authUrl && authServiceKey
  ? createMembershipResolver(
      supabaseMembershipDirectory(authUrl, authServiceKey),
      async (event) => console.info(JSON.stringify({ event: 'institution.authorization', ...event })),
    )
  : null;
const authenticate = authUrl && authKey && membershipResolver
  ? supabaseIdentity(authUrl, authKey, membershipResolver)
  : async () => null;
const loadSsoConfig = authUrl && authServiceKey && ssoDomain && ssoLabel
  ? supabaseSsoConfigLoader(authUrl, authServiceKey, ssoDomain, ssoLabel)
  : async () => null;

/*
 * The sandbox, when it is asked for.
 *
 * Its store sits beside the journal, under the same 0o700 directory and the
 * same umask, because it holds submitted coursework — demonstration
 * coursework, but a person typed it.
 */
const sandboxOn = process.env.SEMESTER_SANDBOX_INSTITUTION === '1';
const sandboxStore = sandboxOn ? new SandboxStore(sandboxPath()) : null;
const installed = sandboxStore ? [...adapters, ...sandboxAdapters(sandboxStore)] : adapters;
const configuredModels = (process.env.SEMESTER_AI_PROVIDERS || '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const maxRequestCents = Number(process.env.SEMESTER_AI_MAX_REQUEST_CENTS || '0');
const estimatedRequestCents = Number(process.env.SEMESTER_AI_ESTIMATED_REQUEST_CENTS || '0');
const configuredRuntimeStatus = process.env.SEMESTER_AI_RUNTIME_STATUS === 'production'
  ? 'configured-production' as const
  : 'configured-sandbox' as const;

/*
 * This remains policy-disabled unless every server-only provider requirement
 * is present. Tenant policy, approved source bodies, budget reservation and
 * usage settlement are loaded authoritatively from Supabase on every request;
 * a VITE_ flag or browser-supplied production claim cannot enable it.
 */
const intelligence = createInstitutionIntelligenceRuntime({
  authUrl,
  authServiceKey,
  openAIKey: process.env.OPENAI_API_KEY || '',
  configuredModels,
  maxRequestCents,
  estimatedRequestCents,
  status: configuredRuntimeStatus,
  audit: journal.auditIntelligence
    ? (identity, record) => journal.auditIntelligence!(identity, record)
    : undefined,
  actionStore: intelligenceActions,
});

const handler = createGateway({
  origin: appOrigin(),
  // The name is not the operator's to choose while the sandbox is running:
  // a demonstration labelled "Vanderbilt University" is the exact failure
  // the plan's "never a placeholder success state presented as real" names.
  institutionName: sandboxOn ? SANDBOX_NAME : process.env.SEMESTER_INSTITUTION_NAME || 'Your university',
  authenticate,
  refreshIdentity: async (_identity, token) => authenticate(token),
  adapters: installed,
  journal,
  rateLimiter,
  intelligence,
  loadSsoConfig,
});

async function serve(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await readBody(req);
    if (!body) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request is too large.' }));
      return;
    }

    const method = req.method || 'GET';
    const bodyless = method === 'GET' || method === 'HEAD';
    const request = new Request(`http://localhost${req.url || '/'}`, {
      method,
      headers: headersOf(req),
      // Copied into a plain view: `Buffer` is a `Uint8Array` at runtime, but its
      // type is not a `BodyInit`. Bounded by MAX_BODY, so the copy is bounded too.
      ...(bodyless ? {} : { body: new Uint8Array(body) }),
    });

    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } catch {
    // Deliberately without the error: it can carry a file path or a query.
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Gateway request failed.' }));
  }
}

const server = createServer(serve);
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;

const port = Number(process.env.SEMESTER_GATEWAY_PORT || 8787);
server.listen(port, '127.0.0.1', () => {
  console.log(
    `Semester university gateway listening on http://127.0.0.1:${port}. ` +
      `${adapters.length} approved adapters registered.` +
      (sandboxOn
        ? ` SANDBOX INSTITUTION IS ON: ${installed.length - adapters.length} demonstration adapters are ` +
          `installed and nothing they report is real.`
        : ''),
  );
});

// Hourly, and unref'd so a sweep never holds the process open by itself.
const sweep = setInterval(() => void journal.purge?.(), 3_600_000);
sweep.unref();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => {
      clearInterval(sweep);
      void journal.close?.();
      sandboxStore?.close();
      process.exit(0);
    });
  });
}
