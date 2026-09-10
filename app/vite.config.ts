import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

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

/**
 * `/feed?url=…` fetches a calendar the page cannot fetch itself.
 *
 * A calendar server sends no CORS headers, so a subscribed Brightspace or
 * Outlook link is unreachable from the browser. This forwards the one request
 * and returns the text — it reads nothing, keeps nothing, and only ever speaks
 * https, so it cannot be pointed at the machine it runs on.
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
        if (!target || !/^https:\/\//i.test(target)) {
          res.statusCode = 400
          res.end('Pass ?url= an https calendar address.')
          return
        }
        try {
          const upstream = await fetch(target, { redirect: 'follow' })
          const body = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
          res.end(body)
        } catch (e) {
          res.statusCode = 502
          res.end(e instanceof Error ? e.message : 'The calendar could not be reached.')
        }
      })()
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
     * The shared data contract. See tsconfig.app.json for why it is aliased
     * rather than copied into each client.
     */
    resolve: {
      alias: {
        '@semester/contract': fileURLToPath(
          new URL('../packages/contract/src/index.ts', import.meta.url),
        ),
      },
    },
    // GitHub Pages serves a project site from /<repo>/, not from the root. The
    // workflow sets VITE_BASE; everywhere else this stays '/' and nothing about
    // development changes.
    base: process.env.VITE_BASE ?? '/',
    plugins: [react(), icsProxy(), appleToken(), claudeProxy(anthropicKey)],
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
