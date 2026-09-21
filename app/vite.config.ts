import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { configDefaults } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { privateHost, publicCalendarUrl } from './src/lib/publichost.ts'

/**
 * The dev server doubles as the OAuth token proxy.
 *
 * Two of the providers cannot be talked to from a page directly: Zoom's API
 * sends no CORS headers at all, and a token exchange is happier server-side
 * even where CORS allows it. Routing those calls through the dev server keeps
 * the flow honest — it forwards, it does not hold anything — and means the app
 * needs no backend of its own.
 *
 * Turn it on with VITE_OAUTH_PROXY=/oauth in app/.env.local. Without it the app
 * talks straight to Microsoft and Google, which both allow it for a registered
 * single-page app, and says plainly that Zoom needs the proxy.
 *
 * In production, point VITE_OAUTH_PROXY at whatever serves the same four
 * routes. Nothing here belongs on a public host as-is.
 */
const forward = (target: string, path: string) => ({
  target,
  changeOrigin: true,
  secure: true,
  rewrite: () => path,
})

/** One megabyte. A term's calendar is a few hundred kilobytes at the outside. */
const FEED_MAX_BYTES = 1_000_000

/** Long enough for a slow campus server, short enough not to hold the dev server. */
const FEED_TIMEOUT_MS = 15_000

/**
 * The body, up to the cap, and nothing past it.
 *
 * Read through the stream rather than with `.text()`: a cap checked after the
 * whole body is in memory is not a cap, it is a way to spend the memory it was
 * meant to protect. Cancelling the stream is what stops the transfer.
 */
async function readCapped(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > FEED_MAX_BYTES) {
    await response.body?.cancel()
    return null
  }
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let out = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > FEED_MAX_BYTES) {
        await reader.cancel()
        return null
      }
      out += decoder.decode(value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
  return out + decoder.decode()
}

/**
 * `/feed?url=…` fetches a calendar the page cannot fetch itself.
 *
 * A calendar server sends no CORS headers, so a subscribed Brightspace or
 * Outlook link is unreachable from the browser. This forwards the one request
 * and returns the text — it reads nothing and keeps nothing.
 *
 * It is a calendar reader, not a proxy, and the difference is three refusals.
 * It used to be one: https, on the grounds that https "cannot be pointed at
 * the machine it runs on", which is not true of `https://127.0.0.1:8443/` and
 * not true of any private name with a certificate on it. Everything this
 * process can reach and a browser cannot — a database on the LAN, the router,
 * the metadata service at `169.254.169.254` on a cloud box — was one query
 * string away. `vite --host` is how this app is opened on a phone, and at that
 * point the forwarder belongs to everyone on the wifi rather than to the
 * developer.
 *
 *   1. **https, to a public host.** `publicCalendarUrl` refuses loopback,
 *      link-local, the private ranges and the local-network names, by literal
 *      and by name — and again on wherever a redirect landed, because a
 *      redirect into `169.254.169.254` is the whole trick.
 *   2. **A calendar, or nothing.** The body has to begin a `VCALENDAR`, so
 *      this cannot fetch a page, a JSON API or an image even once.
 *   3. **A bounded read.** One megabyte and fifteen seconds, whichever comes
 *      first, so a slow or endless address cannot hold the dev server open.
 *
 * The same three, in the same order, as the deployed route in
 * `supabase/functions/fetchcal/index.ts`. See `src/lib/publichost.ts` for why
 * the host rule is written twice rather than imported once.
 */
const icsProxy = () => ({
  name: 'ics-proxy',
  configureServer(server: {
    middlewares: {
      use: (
        path: string,
        fn: (
          req: { url?: string },
          res: {
            statusCode: number
            setHeader: (k: string, v: string) => void
            end: (body?: string) => void
          },
        ) => void,
      ) => void
    }
  }) {
    server.middlewares.use('/feed', (req, res) => {
      const target = new URL(req.url ?? '', 'http://local').searchParams.get('url')
      void (async () => {
        const asked = publicCalendarUrl(target ?? '')
        if (!asked.ok) {
          res.statusCode = 400
          res.end(asked.why)
          return
        }
        try {
          const upstream = await fetch(asked.url, {
            redirect: 'follow',
            signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
            headers: { Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.1' },
          })
          // Where the redirects actually landed, held to the same rule as the
          // address that was asked for.
          if (!publicCalendarUrl(upstream.url || asked.url.toString()).ok) {
            res.statusCode = 400
            res.end('That link redirects somewhere this will not follow.')
            return
          }
          const body = await readCapped(upstream)
          if (body === null) {
            res.statusCode = 413
            res.end('That calendar is larger than this will fetch.')
            return
          }
          if (upstream.ok && !/BEGIN:VCALENDAR/i.test(body.slice(0, 4096))) {
            res.statusCode = 422
            res.end('That address answered with something that is not a calendar.')
            return
          }
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
          res.end(body)
        } catch (e) {
          res.statusCode = 502
          // Deliberately not the thrown message: it can carry the URL, and a
          // feed URL is a password.
          void e
          res.end('The calendar could not be reached.')
        }
      })()
    })
  },
})

/**
 * `/canvas` reads one Canvas API path on behalf of the page.
 *
 * Canvas sends no CORS headers on any API response, on every instance, so the
 * browser is refused before the request leaves — the same wall as a calendar
 * feed, with none of the exceptions. `src/lib/canvas.ts` therefore does not try
 * the direct route at all, and this is the forwarder it reaches for while
 * developing. `supabase/functions/canvas/index.ts` is the same route deployed.
 *
 * **The token is stronger than a feed URL, so the refusals are stricter.** A
 * Brightspace feed token reads one calendar; a Canvas access token is the
 * account, and can write. Four rules, and every one is a refusal:
 *
 *   1. **https, to a public host.** `privateHost` refuses loopback,
 *      link-local, the private ranges and the local-network names. `vite
 *      --host` is how this app is opened on a phone, and at that point this
 *      route belongs to everyone on the wifi.
 *   2. **GET, under `/api/v1/`, and nothing else.** This is the rule that
 *      matters: the token can write, and this forwarder cannot be made to. No
 *      method reaches upstream but GET, whatever the caller asked for.
 *   3. **Bounded.** One megabyte and fifteen seconds.
 *   4. **The token is never logged**, and never travels in a query string —
 *      which is why this takes a POST body to issue a GET.
 */
const canvasProxy = () => ({
  name: 'canvas-proxy',
  configureServer(server: {
    middlewares: {
      use: (
        path: string,
        fn: (
          req: { on: (e: string, f: (c?: unknown) => void) => void },
          res: {
            statusCode: number
            setHeader: (k: string, v: string) => void
            end: (body?: string) => void
          },
        ) => void,
      ) => void
    }
  }) {
    server.middlewares.use('/canvas', (req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c as Buffer))
      req.on('end', () => {
        void (async () => {
          res.setHeader('Content-Type', 'application/json')
          const fail = (status: number, error: string) => {
            res.statusCode = status
            res.end(JSON.stringify({ error }))
          }
          let asked: { host?: unknown; path?: unknown; token?: unknown }
          try {
            asked = JSON.parse(Buffer.concat(chunks).toString('utf8')) as typeof asked
          } catch {
            return fail(400, 'That request was not readable.')
          }
          const host = String(asked.host ?? '')
          const path = String(asked.path ?? '')
          const token = String(asked.token ?? '')
          if (!host || !token) return fail(400, 'A Canvas host and token are needed.')
          if (privateHost(host)) return fail(400, 'That host is not on the public internet.')
          // Rule 2. A path that does not start `/api/v1/` never reaches
          // upstream, and neither does one carrying a `..` segment or its own
          // scheme — both are ways to leave the API and this refuses them by
          // shape rather than by trying to normalise them.
          if (!/^\/api\/v1\/[A-Za-z0-9/_.~-]*(\?[^#]*)?$/.test(path) || path.includes('..')) {
            return fail(400, 'Only the Canvas API is readable through this.')
          }
          try {
            const upstream = await fetch(`https://${host}${path}`, {
              method: 'GET',
              // Not followed. Following a redirect would carry the
              // Authorization header to wherever it pointed, and this token is
              // the student's whole Canvas account. The deployed route in
              // `supabase/functions/canvas/index.ts` refuses them the same way.
              redirect: 'manual',
              signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
              headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            })
            if (upstream.status >= 300 && upstream.status < 400) {
              await upstream.body?.cancel()
              return fail(502, 'Canvas redirected that request, which usually means a campus sign-in rather than the API.')
            }
            const body = await readCapped(upstream)
            if (body === null) return fail(413, 'Canvas answered with more than this will read.')
            res.statusCode = upstream.status
            res.end(body)
          } catch (e) {
            // Deliberately not the thrown message: it can carry the URL, and
            // the request carried a token.
            void e
            return fail(502, 'Canvas could not be reached.')
          }
        })()
      })
    })
  },
})

/**
 * Sign in with Apple, the one part a browser cannot do.
 *
 * Apple's "client secret" is a JWT signed with a private key from the developer
 * portal. A key that reaches the browser is a key that has escaped, so the
 * signing happens here and the .p8 never leaves the machine. Set:
 *
 *     APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID, APPLE_PRIVATE_KEY
 *
 * where APPLE_PRIVATE_KEY is a path to the .p8 file. Apple also refuses
 * http://localhost as a redirect, so this route only completes behind an https
 * address — a tunnel in development, the real host in production.
 */
const appleToken = () => ({
  name: 'apple-token',
  configureServer(server: {
    middlewares: {
      use: (
        path: string,
        fn: (
          req: { on: (e: string, f: (c?: unknown) => void) => void },
          res: {
            statusCode: number
            setHeader: (k: string, v: string) => void
            end: (body?: string) => void
          },
        ) => void,
      ) => void
    }
  }) {
    server.middlewares.use('/oauth/apple/token', (req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c as Buffer))
      req.on('end', () => {
        void (async () => {
          const { createSign } = await import('node:crypto')
          const { readFileSync } = await import('node:fs')
          const team = process.env.APPLE_TEAM_ID
          const kid = process.env.APPLE_KEY_ID
          const sub = process.env.APPLE_SERVICES_ID
          const keyPath = process.env.APPLE_PRIVATE_KEY
          res.setHeader('Content-Type', 'application/json')

          if (!team || !kid || !sub || !keyPath) {
            res.statusCode = 501
            res.end(
              JSON.stringify({
                error: 'apple_not_configured',
                error_description:
                  'Set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICES_ID and APPLE_PRIVATE_KEY.',
              }),
            )
            return
          }

          const b64 = (o: object) =>
            Buffer.from(JSON.stringify(o)).toString('base64url')
          const now = Math.floor(Date.now() / 1000)
          const head = b64({ alg: 'ES256', kid })
          const body = b64({
            iss: team,
            iat: now,
            exp: now + 3600,
            aud: 'https://appleid.apple.com',
            sub,
          })
          const signer = createSign('SHA256')
          signer.update(`${head}.${body}`)
          const secret = `${head}.${body}.${signer
            .sign({ key: readFileSync(keyPath, 'utf8'), dsaEncoding: 'ieee-p1363' })
            .toString('base64url')}`

          const form = new URLSearchParams(Buffer.concat(chunks).toString())
          form.set('client_secret', secret)
          form.set('client_id', sub)
          try {
            const upstream = await fetch('https://appleid.apple.com/auth/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: form,
            })
            res.statusCode = upstream.status
            res.end(await upstream.text())
          } catch (e) {
            res.statusCode = 502
            res.end(
              JSON.stringify({
                error: 'upstream',
                error_description: e instanceof Error ? e.message : 'Apple could not be reached.',
              }),
            )
          }
        })()
      })
    })
  },
})

/**
 * `/anthropic/v1/messages` — Claude, with the key added here.
 *
 * The assistant needs a key, and the places it could live are not equal. In the
 * browser it is readable by anything running in that browser; in a deployed
 * build it is readable by everyone who loads the page. So: put it in
 * app/.env.local, which git ignores, as
 *
 *     ANTHROPIC_API_KEY=sk-ant-…
 *
 * and it stays in this process. The page posts to /anthropic/v1/messages
 * knowing only that address; this adds the header and streams the reply back as
 * it arrives, which is what makes an answer appear a word at a time rather than
 * all at once at the end.
 *
 * Development only — it is a dev-server middleware, and `vite build` neither
 * runs it nor tells the built page it exists. A deployed copy uses the Edge
 * Function in supabase/functions/claude, which does the same job with an
 * account check and a monthly cap in front of it.
 *
 * One method at one path and nothing else, so it is not a general way out of
 * the browser's origin rules.
 */
const claudeProxy = (key: string) => ({
  name: 'claude-proxy',
  configureServer(server: {
    middlewares: {
      use: (
        path: string,
        fn: (
          req: {
            url?: string
            method?: string
            headers: Record<string, string | string[] | undefined>
            on: (e: string, f: (c?: unknown) => void) => void
          },
          res: {
            statusCode: number
            setHeader: (k: string, v: string) => void
            write: (chunk: Uint8Array) => void
            end: (body?: string) => void
          },
        ) => void,
      ) => void
    }
  }) {
    server.middlewares.use('/anthropic', (req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(c as Buffer))
      req.on('end', () => {
        void (async () => {
          res.setHeader('Content-Type', 'application/json')
          const path = (req.url ?? '').split('?')[0]
          if (req.method !== 'POST' || path !== '/v1/messages') {
            res.statusCode = 404
            res.end(
              JSON.stringify({
                error: {
                  message: 'This proxy forwards POST /anthropic/v1/messages and nothing else.',
                },
              }),
            )
            return
          }
          if (!key) {
            res.statusCode = 501
            res.end(
              JSON.stringify({
                error: {
                  message:
                    'No ANTHROPIC_API_KEY on this server. Put one in app/.env.local and restart ' +
                    'the dev server, or add your own key under Settings → The assistant.',
                },
              }),
            )
            return
          }
          try {
            const upstream = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'anthropic-version': String(req.headers['anthropic-version'] ?? '2023-06-01'),
                'x-api-key': key,
              },
              body: Buffer.concat(chunks),
            })
            res.statusCode = upstream.status
            res.setHeader('Content-Type', upstream.headers.get('Content-Type') ?? 'application/json')
            // Anything that buffers the stream between here and the page turns
            // an answer arriving word by word into one that arrives at the end.
            res.setHeader('Cache-Control', 'no-cache')
            if (!upstream.body) {
              res.end()
              return
            }
            for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) {
              res.write(chunk)
            }
            res.end()
          } catch (e) {
            res.statusCode = 502
            res.end(
              JSON.stringify({
                error: {
                  message: e instanceof Error ? e.message : 'Anthropic could not be reached.',
                },
              }),
            )
          }
        })()
      })
    })
  },
})

/**
 * The Content-Security-Policy's two moving parts.
 *
 * The policy itself is in `index.html`, where it can be read, and that header
 * explains what it covers and what a <meta> tag cannot. Two things about it
 * cannot live in a static file, and they are here.
 *
 * ## The origins a deployment adds
 *
 * Four build variables name a host this repository cannot know: the Supabase
 * project URL, the proxy the assistant talks to, the proxy that fetches a
 * calendar, and the university gateway. `pages.yml` reads all four from
 * repository variables. A policy that hardcoded a guess at them — `*.supabase.co`
 * and nothing else — would be correct for the deployment that exists today and
 * would switch those features off, silently and from the browser, for a fork
 * or a move to another host. That is the failure mode this repository keeps
 * finding: not an error, but a feature that looks switched off on purpose.
 *
 * So the origins come from whatever is actually configured. Only the origin —
 * scheme, host and port — because that is all a CSP source is; the path a
 * variable carries is dropped. Only https, because a policy admitting http is
 * a policy with a hole in it, and a variable pointing at http in a deployed
 * build is a bug worth failing loudly rather than accommodating. A value that
 * is a bare path (`/anthropic`, which is what the dev server sets) is already
 * covered by `'self'` and adds nothing.
 *
 * The Supabase URL also contributes its `wss:` form. supabase-js opens a
 * websocket for realtime, and `connect-src` governs it — a policy that allows
 * the REST origin and not the socket fails in a way that looks like the
 * network being slow.
 */
function cspExtraConnect(read: (name: string) => string | undefined): string {
  const out = new Set<string>()
  const supabase = 'VITE_SUPABASE_URL'
  for (const name of [
    supabase,
    'VITE_CLAUDE_PROXY',
    'VITE_ICS_PROXY',
    'VITE_OAUTH_PROXY',
    'VITE_UNIVERSITY_GATEWAY_URL',
  ]) {
    const value = (read(name) ?? '').trim()
    // A bare path is same-origin, which `'self'` already allows.
    if (!value || value.startsWith('/')) continue
    let url: URL
    try {
      url = new URL(value)
    } catch {
      continue
    }
    if (url.protocol !== 'https:') continue
    out.add(url.origin)
    if (name === supabase) out.add(`wss://${url.host}`)
  }
  return [...out].sort().join(' ')
}

/**
 * The policy, taken back out again while developing.
 *
 * `@vitejs/plugin-react` injects its refresh preamble into the page as an
 * inline <script>, and `script-src 'self'` refuses an inline script by
 * definition. Left in place, `npm run dev` opens to a blank page and a console
 * message — which is a worse outcome than the policy is worth, because the dev
 * server is not a thing anybody can reach.
 *
 * `vite preview` is a build and keeps the tag, so the arrangement CI opens
 * cold is the arrangement a student gets. That is the one that matters and it
 * is the one that is checked.
 *
 * `order: 'pre'` so this runs before Vite's own `%VITE_…%` substitution, which
 * would otherwise spend a moment resolving a tag that is about to be deleted.
 */
const csp = (serving: boolean) => ({
  name: 'csp',
  transformIndexHtml: {
    order: 'pre' as const,
    handler: (html: string) =>
      serving
        ? html.replace(/[ \t]*<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>\n?/i, '')
        : html,
  },
})

/**
 * The test files that must keep a module registry of their own.
 *
 * Every one of these calls `vi.mock`, and a mock can only rebind a module the
 * worker has not already evaluated. Under `isolate: false` that depends on
 * which file ran first in that worker, which is how a suite passes twice and
 * fails the third time.
 *
 * Each is here for the same reason rather than one reason each: it replaces
 * something the real version of would reach the network, a database, a PDF
 * worker or the store. The list grows with the app — `downloads.test.tsx`
 * joined it by replacing the store to name a course. Kept as a list rather than inferred at
 * startup because a config that greps the tree to configure itself is a config
 * nobody can read — and `src/isolation.test.ts` does the grep instead, and
 * fails if this list and the tree disagree.
 */
const MOCKS_MODULES = [
  'src/screens/onboardingcounts.test.tsx',
  'src/screens/mentionbadge.test.tsx',
  'src/components/waitingrow.test.tsx',
  'src/components/pushstalled.test.tsx',
  'src/components/credentials.test.tsx',
  'src/components/referrallink.test.tsx',
  'src/components/schoolclaim.test.tsx',
  'src/components/downloads.test.tsx',
  'src/data/seed.test.ts',
  'src/components/rework.test.tsx',
  'src/components/StudyStudio.test.tsx',
  'src/components/TermChoice.test.tsx',
  'src/components/gpascalenote.test.tsx',
  'src/lib/extract.test.ts',
  'src/lib/extractaccuracy.test.ts',
  'src/lib/referral.test.ts',
  'src/lib/activity.test.ts',
  'src/lib/generate.test.ts',
  'src/lib/presence.test.ts',
  'src/screens/call/leaving.test.tsx',
  'src/screens/call/consent.ui.test.tsx',
  'src/screens/addmaterial.test.tsx',
  'src/screens/pathway.test.tsx',
  'src/screens/pathwaygrid.test.tsx',
  'src/screens/solvephoto.test.tsx',
  'src/screens/university.test.tsx',
  'src/state/deeplink.test.tsx',
  'src/state/persist/firstrun.test.ts',
  'src/state/persist/tell.test.ts',
  'src/state/storetoken.test.tsx',
]

export default defineConfig(({ command, mode }) => {
  /*
   * The key, read here and never handed to the page.
   *
   * loadEnv with an empty prefix reads everything in app/.env.local, including
   * the names with no VITE_ on the front — which is the point, since those are
   * exactly the ones Vite refuses to compile into the page. A value already
   * exported in the shell wins over the file.
   */
  const dir = fileURLToPath(new URL('.', import.meta.url))
  const local = loadEnv(mode, dir, '')
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? local.ANTHROPIC_API_KEY ?? ''

  /*
   * Which build this is, so the service worker can throw the last one away.
   *
   * The worker keeps every asset the page tells it about, and asset names are
   * content-hashed, so each deploy contributed a fresh set to a cache that was
   * never pruned — `activate` only runs when `sw.js` itself changes, and
   * `sw.js` is a static file that does not. An installed app therefore held
   * every version of every chunk it had ever loaded, for ever.
   *
   * The worker cannot tell one build from another by looking; only the page
   * knows. So the page is told here, and passes it on with the list of what it
   * used. See `src/lib/warm.ts` and `public/sw.js`.
   *
   * Pruning against that list alone would have been wrong, and worth saying
   * why: the list is what the *first* load fetched, and a screen opened later
   * is cached by the fetch handler and is not in it. Pruning on every warm
   * would evict exactly the screens the offline promise is about. Only a build
   * change makes old entries genuinely dead — they are named after files the
   * server no longer serves — so only a build change prunes.
   *
   * Set it in the environment to pin it; otherwise the moment of the build.
   */
  process.env.VITE_BUILD_ID ??= Date.now().toString(36)

  /*
   * The origins the policy in `index.html` gains from this deployment's
   * configuration. Set here for the reason `VITE_BUILD_ID` above is: Vite runs
   * this function before it reads the environment, so a `VITE_`-prefixed name
   * put on `process.env` here is one `%VITE_CSP_EXTRA_CONNECT%` in the HTML
   * resolves against.
   *
   * Always assigned, never `??=`. An unresolved `%VITE_…%` is left in the page
   * verbatim, and a stray percent sign inside `connect-src` is a source
   * expression the browser cannot parse — it would be ignored rather than
   * fatal, but a policy nobody can read is a policy nobody maintains. Empty is
   * the honest value when nothing is configured.
   */
  process.env.VITE_CSP_EXTRA_CONNECT = cspExtraConnect(
    (name) => process.env[name] ?? local[name],
  )

  /*
   * With a key on the server, point the app at the proxy holding it — unless
   * whoever is running this named a proxy of their own, which is the production
   * shape and wins.
   *
   * Only while serving. A build has no dev server behind it, so writing this
   * address into a deployed page would point the assistant at a 404.
   */
  if (
    command === 'serve' &&
    anthropicKey &&
    !(process.env.VITE_CLAUDE_PROXY ?? local.VITE_CLAUDE_PROXY)
  ) {
    process.env.VITE_CLAUDE_PROXY = '/anthropic'
  }

  return {
    /*
     * The two shared contracts. See tsconfig.app.json for why each is aliased
     * rather than copied into the clients that read it.
     */
    resolve: {
      alias: {
        '@semester/contract': fileURLToPath(
          new URL('../packages/contract/src/index.ts', import.meta.url),
        ),
        '@semester/institution': fileURLToPath(
          new URL('../packages/institution/src/index.ts', import.meta.url),
        ),
      },
    },
    // GitHub Pages serves a project site from /<repo>/, not from the root. The
    // workflow sets VITE_BASE; everywhere else this stays '/' and nothing about
    // development changes.
    base: process.env.VITE_BASE ?? '/',
    plugins: [
      react(),
      csp(command === 'serve'),
      icsProxy(),
      canvasProxy(),
      appleToken(),
      claudeProxy(anthropicKey),
    ],
    /*
     * The test suite, which had no configuration at all and was paying for it.
     *
     * 363 files, and vitest was spawning one worker per file: 363 spawns at
     * ~224ms each, which is 27 of the suite's 47 seconds spent starting
     * processes rather than running tests. Vitest says so itself at the foot
     * of every run, and has done for as long as there have been this many
     * files. CI pays it three times — `npm test`, then `test:zones` runs the
     * whole suite again in Chicago and again in Kiritimati.
     *
     * `isolate: false` reuses a worker across files instead of starting one
     * per file. What it gives up is the guarantee that each file gets a fresh
     * module registry, and a handful of files here need exactly that: they call
     * `vi.mock`, which can only rebind a module that has not already been
     * evaluated in that worker. Whether it has depends on which file ran
     * first, so the failure is real but intermittent — `components/rework`
     * got the real `state/store` and threw "useStore must be used inside
     * StoreProvider" on one run in three, and passed on the others.
     *
     * So: two projects. Everything runs in shared workers, and the files that
     * mock run isolated — a few per cent of the suite paying for what it
     * needs. The count is deliberately not written here: it moves, and a
     * number in a comment that moves is a number that goes stale.
     * `src/isolation.test.ts` keeps the list honest — it reads this file and
     * the tree, and fails if a new `vi.mock` appears in a file that is not
     * listed.
     */
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'shared',
            isolate: false,
            exclude: [...configDefaults.exclude, ...MOCKS_MODULES],
          },
        },
        {
          extends: true,
          test: {
            name: 'mocked',
            isolate: true,
            include: MOCKS_MODULES,
          },
        },
      ],
    },
    server: {
      proxy: {
        '/oauth/microsoft/token': forward(
          'https://login.microsoftonline.com',
          '/common/oauth2/v2.0/token',
        ),
        '/oauth/google/token': forward('https://oauth2.googleapis.com', '/token'),
        '/oauth/zoom/token': forward('https://zoom.us', '/oauth/token'),
        '/oauth/zoom/api': {
          target: 'https://api.zoom.us',
          changeOrigin: true,
          secure: true,
          rewrite: (p: string) => p.replace(/^\/oauth\/zoom\/api/, ''),
        },
      },
    },
  }
})
