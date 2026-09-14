import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ActionJournal } from './journal.ts';
import { MAX_BODY, createGateway } from './gateway.ts';
import { supabaseIdentity } from './auth.ts';
import { adapters } from './adapters.ts';

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

function openJournal(): ActionJournal {
  const file = resolve(process.env.SEMESTER_JOURNAL_PATH || 'work/university/private/actions.sqlite');
  // 0o700: the directory holding prepared actions is not world-readable.
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  return new ActionJournal(file, journalKey());
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

const journal = openJournal();
const authUrl = process.env.SEMESTER_AUTH_URL || '';
const authKey = process.env.SEMESTER_AUTH_PUBLIC_KEY || '';

/*
 * With no auth project configured nothing authenticates, and the gateway
 * answers 401 to everything that needs an identity. That is the correct
 * unconfigured behaviour: the alternative to checking a token is refusing, not
 * trusting one.
 */
const authenticate = authUrl && authKey ? supabaseIdentity(authUrl, authKey) : async () => null;

const handler = createGateway({
  origin: appOrigin(),
  institutionName: process.env.SEMESTER_INSTITUTION_NAME || 'Your university',
  authenticate,
  adapters,
  journal,
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
    `Semester university gateway listening on http://127.0.0.1:${port}. ${adapters.length} approved adapters registered.`,
  );
});

// Hourly, and unref'd so a sweep never holds the process open by itself.
const sweep = setInterval(() => journal.purge(), 3_600_000);
sweep.unref();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => {
      clearInterval(sweep);
      journal.close();
      process.exit(0);
    });
  });
}
