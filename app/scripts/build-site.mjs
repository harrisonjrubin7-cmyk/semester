/*
 * Build the public site into `dist-site/`: one static HTML file per page, at
 * real paths, plus the stylesheet, the fonts and the icons (DECISION-LOG D-011).
 *
 *   npm run site:build
 *   SITE_ORIGIN=https://example.org SITE_BASE=/ npm run site:build
 *
 * Settings, all optional:
 *   SITE_APP_URL  where sign-in and sign-up hand off (default: the live app)
 *   SITE_BASE     path the site is served under (default "/")
 *   SITE_ORIGIN   origin for canonical links, social tags and the sitemap
 *
 * The four tool pages load one script, `tools/tools.js`: `src/site/tools/client.tsx`
 * bundled with React, which hydrates the prerendered tool. No other page has one.
 *
 * It renders with Vite's own module loader, so the pages are the same TSX the
 * test suite checks, compiled the same way, and the build adds no dependency.
 * Where the output is served is a deployment decision and is not made here.
 */
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');
const out = join(app, 'dist-site');

const withSlashes = (p) => `/${p.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
const config = {
  appUrl: process.env.SITE_APP_URL || 'https://harrisonjrubin7-cmyk.github.io/semester/',
  base: withSlashes(process.env.SITE_BASE || '/'),
  origin: (process.env.SITE_ORIGIN || '').replace(/\/+$/, ''),
  ...stamp(),
};

/**
 * `{ build }` when a commit is known, else nothing. SITE_COMMIT, or GITHUB_SHA
 * in Actions, names the commit; SITE_BUILT the day, defaulting to today. The
 * product-quality page shows both, or says the build is unstamped rather than
 * dating itself.
 */
function stamp() {
  const commit = process.env.SITE_COMMIT || process.env.GITHUB_SHA || '';
  if (!commit) return {};
  return { build: { commit, at: process.env.SITE_BUILT || new Date().toISOString().slice(0, 10) } };
}

const vite = await createServer({ root: app, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { renderSite } = await vite.ssrLoadModule('/src/site/render.tsx');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const files = renderSite(config);
  for (const { file, content } of files) {
    const to = join(out, file);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, content);
  }

  // The app's own @font-face rules, pointed at the copied fonts, then the site's rules.
  const faces = readFileSync(join(app, 'src', 'styles', 'typefaces.css'), 'utf8').replaceAll("url('./fonts/", "url('fonts/");
  const site = readFileSync(join(app, 'src', 'site', 'site.css'), 'utf8');
  writeFileSync(join(out, 'site.css'), `${faces}\n${site}`);
  cpSync(join(app, 'src', 'styles', 'fonts'), join(out, 'fonts'), { recursive: true });
  copyFileSync(join(app, 'public', 'icon.svg'), join(out, 'icon.svg'));
  copyFileSync(join(app, 'public', 'icon-512.png'), join(out, 'og.png'));

  // The tools' one script. Vite's defaults, not the app's config: no PWA, no
  // proxy, no hashed name, since the pages point at it by a fixed path.
  await build({
    root: app,
    configFile: false,
    mode: 'production',
    logLevel: 'warn',
    // The dev server above leaves the JSX transform in development mode, which
    // emits `jsxDEV` calls the production React runtime does not have.
    oxc: { jsx: { runtime: 'automatic', development: false } },
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      outDir: join(out, 'tools'),
      emptyOutDir: false,
      copyPublicDir: false,
      rollupOptions: {
        input: join(app, 'src', 'site', 'tools', 'client.tsx'),
        output: { entryFileNames: 'tools.js', format: 'es' },
      },
    },
  });

  console.log(`site: ${files.length} files into dist-site/ (base ${config.base}, app ${config.appUrl})`);
} finally {
  await vite.close();
}
