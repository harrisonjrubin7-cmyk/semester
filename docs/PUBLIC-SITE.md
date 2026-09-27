# Public site

The company and product website, built as D-011 approved: a separate set of
pages **prerendered to static HTML at real paths**, sharing the app's colours
and typefaces. It ships no JavaScript. Every page is indexable, readable with
scripts off, and carries a policy (`script-src 'none'`) that makes an injected
script inert.

## Where things are

| | |
|---|---|
| Pages | `app/src/site/pages.tsx`: 18 routes, listed in `app/src/site/render.tsx` `ROUTES` |
| Frame | `app/src/site/Layout.tsx`: skip link, header, a script-free `<details>` phone menu, footer |
| Styles | `app/src/site/site.css`, with the app's `@font-face` rules prepended at build |
| Plans | `app/src/lib/plans.ts`: one source for the pricing page and the in-app Membership panel |
| Build | `app/scripts/build-site.mjs` renders with Vite's own module loader, writing to `app/dist-site/` (git-ignored) |
| Tests | `app/src/site/site.test.tsx`, `app/src/lib/plans.test.ts` |

```bash
cd app
npm run site:build      # SITE_BASE, SITE_ORIGIN and SITE_APP_URL are optional
npm run site:preview    # serves dist-site on http://localhost:4175
```

## Rules the tests hold

- One `<h1>`, one `<main>`, a skip link, and a unique title and description on
  every page.
- Every link goes to another page, into the app, or to `mailto:`.
- No "works at any university" claim (`DECISIONS.md` §1). The footer says
  Semester is built at Vanderbilt first.
- No live-integration claim. The institutions page says no institutional
  connection is live today.
- No checkout. Every paid price is marked *(planned)*, and export, deletion
  and saved plans are listed as on every plan.
- The product preview is labelled demo data.
- The site's colours equal the app's `:root` tokens.

## Decisions still needed before it is served (none are made here)

1. **Where it is served.** Two options, and either is a production change:
   - The site at the root, with the app moved to `/app/`. This needs a
     redirect for existing `#/…` links.
   - The site on its own domain or path, with the app left where it is.

   The build takes `SITE_BASE` and `SITE_APP_URL`, so both work without code
   changes.
2. **The planned prices.** The blueprint's suggested $7.99 / $59 (Plus) and
   $14.99 / $99 (Pro) are shown as *planned*. Confirm or change them in
   `lib/plans.ts` before the page is public. No billing exists, per D-009.
3. **An origin.** Set `SITE_ORIGIN` to emit canonical links, social-preview
   URLs and `sitemap.xml`. Without it they are left out rather than guessed.

## Not in this slice

- **Interactive public tools** (P2.2). `/tools/` currently opens each tool in
  the app.
- **Membership inside the app** (P2.3). `/membership/` currently hands off to
  the app's Account screen.
