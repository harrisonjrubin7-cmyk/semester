---
name: run
description: Launch the Semester app and drive it in a real browser to see a change working — start the dev server, skip the adoption prompt, put the app in a chosen layout and navigation, and screenshot a screen. Use whenever asked to run, start, open, or screenshot the app, or to confirm a change works in the app rather than only in the test suite.
---

# Running the app

The app is a Vite single-page app under `app/`. Running it means the dev
server plus a headless Chromium driven against it — a screenshot is the
deliverable, because most changes here are visual and the suite already
covers the rest.

The end state: a screenshot of the screen you changed, in the layout and
navigation it was changed for, with `pageerror` empty.

## 1 · The dev server

```bash
cd app
npm install                      # only if node_modules is absent
npm run dev > /tmp/vite.log 2>&1 &
timeout 40 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
```

Vite serves on **5173**. Poll the port; do not `sleep`. Stop it by killing
the listener, not by `pkill -f` on a pattern broad enough to match your own
session:

```bash
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
```

## 2 · The browser

There is no `chromium-cli` here, and `npm install playwright` pulls a
Playwright whose expected Chromium build does not match the one in the
container. Install the library and point it at the browser already on disk:

```bash
mkdir -p /tmp/drive && cd /tmp/drive
echo '{"name":"drive","private":true,"type":"module"}' > package.json
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright
```

The `package.json` is not optional. Without one npm walks up to the nearest
parent that has one, reports **"up to date"**, installs nothing where you
are, and the import then fails on a path that looks right.

```js
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',   // NOT the bundled build
  args: ['--no-sandbox'],
});
```

Without `executablePath` it fails with *"Executable doesn't exist at
.../chromium_headless_shell-1243/..."* and tells you to run
`npx playwright install`. Don't — the pin is the fix.

Use a phone viewport. Most of this app's layout decisions are about what
fits across 390–420px, and a desktop viewport draws the rail instead of the
tab bar:

```js
const ctx = await browser.newContext({
  viewport: { width: 420, height: 900 },
  deviceScaleFactor: 2,
});
```

## 3 · Get past the adoption prompt

A fresh profile opens on "4 syllabi. One brain." with **SET IT UP** and
**SKIP**. Nothing is reachable behind it, so every script starts here:

```js
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /skip/i }).first().click();
```

**Match labels case-insensitively.** The caps in this app are
`text-transform: uppercase`, so `innerText` reports `SKIP` while the DOM
holds `Skip`. `getByText('SKIP', { exact: true })` times out;
`{ name: /skip/i }` does not.

Skipping still leaves the four shipped courses loaded, which is what you
want — an empty catalogue puts `FirstRun` in front of half the screens.

## 4 · Reach a screen

The app is hash-routed (`lib/route.ts`), so navigate by address rather than
by clicking chrome that differs per navigation:

```js
await page.evaluate(() => { location.hash = '#/settings'; });
await page.waitForTimeout(1500);
```

`#/<screen>` for most, `#/<screen>/<id>` for the ones in `NAMED`
(`course`, `item`, `guide`, …). The screen ids are the `Screen` union in
`lib/types.ts`; `#/` and an empty hash are both home.

## 5 · Choose the layout and the navigation

These are two independent axes (see `lib/types.ts` on `NavMode` and
`components/shell/useShell.ts` on `Shell`), and every combination is a valid
app. A change to one is not exercised by looking at the other.

Seed them before the first load — much faster than clicking through
Settings, and verified to apply:

```js
await ctx.addInitScript(() => {
  localStorage.setItem('semester.v1', JSON.stringify({ shell: 'soft', nav: 'tabs' }));
});
```

| Setting | Values in code | Labels on screen |
|---|---|---|
| `shell` | `plain` · `grouped` · `soft` | Drawn · Grouped · Soft |
| `nav` | `tabs` · `feed` · `springboard` · `shelves` | Tab bar · One feed · Home screen · Shelves |

The names do not match: **`plain` is "Drawn"** (`SHELLS` in `lib/look.ts`).
`drawn` is a real value in this app, but it belongs to `corners`, not
`shell` — and `useShell` returns plain for anything it does not recognise,
so `shell: 'drawn'` falls through silently and looks like it worked.

Seeding the shell does **not** skip the adoption prompt — still click Skip.
`semester.v1` is plain JSON (`state/shape.ts`, `STORAGE_KEY`) and is merged
over the defaults, so a partial object is fine.

The UI path, if you need to prove the picker itself works:
Settings → *Layout and navigation* → the layout by name.

## 6 · Screenshot the part that matters

The scroller is `.scrollarea`, not the window — `page.mouse.wheel` and
`scrollIntoView` on the body do nothing. To see the foot of a screen:

```js
await page.evaluate(() => {
  const el = document.querySelector('.scrollarea');
  if (el) el.scrollTop = el.scrollHeight;
});
await page.waitForTimeout(700);
await page.screenshot({ path: 'shots/settings-bottom.png' });
```

**Look at the screenshot.** A dark rectangle is a failure to launch, not a
dark theme.

Assert on the DOM as well when the change is a removal — an absent element
is hard to see and easy to claim:

```js
const n = await page.evaluate(() => document.querySelectorAll('.soft-bar').length);
```

## 6a · Reach for the accessible control, not the gesture

**A synthetic mouse drag does not turn the springboard's pages.** Pressing
at one point, moving across the grid and releasing leaves it on the same
page — no error, no movement, which reads as "the app is broken" rather
than "the driver is wrong". Measured: after the drag the icons were
unchanged; after the click below they changed.

Assume the same of any other gesture here until you have watched it work.
There is no need to find out, though, because the touch affordances all
have a keyboard equivalent with a role and a name — the app is navigable
without a pointer. Use those:

```js
await page.getByRole('tab', { name: 'Page 2' }).click();   // springboard pages
await page.getByRole('tab', { name: 'Study' }).click();    // shelf, row one
```

Reach for a gesture only when the gesture itself is what you are testing,
and reach for the role first every other time — it is what a keyboard user
does, so if it does not work that is a bug worth finding.

## 6b · Where each navigation's chrome lives

The class names do not follow the names on screen, and guessing costs a
30-second timeout each time:

| Navigation | Its chrome | Where |
|---|---|---|
| `tabs` | `.app-tabs` | below the scroller |
| `shelves` | `.shelf-nav`, `.shelf-nav-row`, `.shelf-nav-pill`, `.shelf-nav-said` | above the scroller |
| `springboard` | `.iconshape` inside `.tappable`; pages are `role="tab"` | the home screen itself |
| `feed` | no chrome of its own | — |

`.soft-grid` is the **folder** that opens on top of the springboard, not
the launcher's own grid — the obvious guess, and it silently matches
nothing until a folder is open.

Only one navigation is ever drawn, so asserting the others are absent is a
cheap way to prove the setting took:

```js
await page.evaluate(() => document.querySelectorAll('.app-tabs').length);  // 0 under shelves
```

## 7 · Check nothing threw

```js
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
```

`ERR_CONNECTION_RESET` on a resource load is the container's proxy refusing
an outbound font or tile, not the app. `pageerror` is the one to hold to
zero.

## Gotchas

- **First paint is slow.** Vite compiles on demand; the first `goto` can
  take several seconds. Wait on an element, not a fixed sleep, wherever you
  can.
- **Restarting.** Kill the 5173 listener first or the next `npm run dev`
  picks 5174 and your script polls a port nothing will answer on.
- **`npm ls playwright` in `app/` is empty** — it is not a project
  dependency and should not become one. Install it in a scratch directory,
  with the `package.json` above.

## The whole thing, as one script

Verified against this repo end to end. Run it from the scratch directory.

```js
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({
  viewport: { width: 420, height: 900 },
  deviceScaleFactor: 2,
});
await ctx.addInitScript(() => {
  localStorage.setItem('semester.v1', JSON.stringify({ shell: 'soft', nav: 'tabs' }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /skip/i }).first().click();

await page.evaluate(() => { location.hash = '#/settings'; });
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const el = document.querySelector('.scrollarea');
  if (el) el.scrollTop = el.scrollHeight;
});
await page.waitForTimeout(700);
await page.screenshot({ path: 'shots/settings-bottom.png' });

console.log('pageerrors:', errors.length);
await browser.close();
```
