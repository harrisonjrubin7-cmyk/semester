import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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

export default defineConfig({
  plugins: [react(), icsProxy()],
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
})
