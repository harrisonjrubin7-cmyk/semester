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

Case-insensitively, for the reason below. Skipping still leaves the four
shipped courses loaded, which is what you want — an empty catalogue puts
`FirstRun` in front of half the screens.

## 3a · Never match a caps label exactly

**Every run of capitals in this app is `text-transform: uppercase`.** The
DOM holds sentence case; only the rendering is shouting. So `innerText`
reports `SKIP` and the element is named `Skip`, and an exact match waits
the full 30 seconds and then fails as if the control were missing.

```js
page.getByRole('button', { name: /skip/i })          // ✅
page.getByText('SKIP', { exact: true })              // ✗ times out
page.getByRole('button', { name: 'DUE', exact: true })  // ✗ same, it is `Due`
```

It is not one button. Caps are applied in render throughout — `ChipRow`
and the tab bar set `textTransform` inline, and `.kicker`,
`.section-label`, `.tag`, `.soft-caps`, `.soft-strip-*`, `.skip-link` and
`.rail-item` set it in app.css. That covers the adoption prompt's SKIP,
every chip row (the feed's ALL / DUE / CLASSES), section headings, stat
labels and the tab names.

So read a label off a screenshot or off `innerText` and you have read the
styling, not the name. Use a case-insensitive regex for any of them, and
anchor it — on the feed, bare `/due/i` matches three elements (the chip,
the "Due today" stat label and its heading) where the anchored form matches
one:

```js
page.getByRole('button', { name: /^due$/i })
```

Anchor the *start* freely. Anchoring the **end** is a chip-row rule only,
and §3b is why — on anything card-shaped the name carries its subtitle and
`$` matches nothing.

Two things this rule does **not** cover, and both will mislead you the
other way:

- **The shelf pills are genuinely mixed case.** `.shelf-nav-pill` sets no
  `text-transform`, so `{ name: 'Study' }` is correct there and a
  screenshot showing `Semester · Courses · Study` is showing you the real
  names.
- **Course codes are really uppercase.** `ECON`, `PSCI` and the rest are
  uppercase in the data, so an exact match on those works — it is `All`,
  `Due` and `Classes` beside them in the same row that do not.

## 3b · …and do not anchor the end of one either

The rule above ends with "anchor it", which is right for a chip row and
wrong for a card. **A card-shaped button's accessible name is its whole
text — the title and the subtitle run together, with no space between
them.** So `$` matches nothing and you get the same silent 30-second
timeout as a caps mismatch, on a control that is plainly on the screen.

The three maker screens are the same job three times, and they do not
agree:

```
#/write   "Blank document"
#/deck    "Blank presentation"
#/sheet   "Blank sheetNothing in it yet"      ← title + subtitle, no space
```

```js
page.getByRole('button', { name: /^Blank sheet/i })   // ✅ prefix
page.getByRole('button', { name: /^Blank sheet$/i })  // ✗ times out
```

Two screens out of three let an anchored match through, which is the worst
possible distribution: it works, it keeps working, and then it does not.
Measured on the sheet library, where every card in the row is built this
way — `"To-do listWhat is due, when, and whether it is done"`,
`"Monthly budgetWhat comes in, what goes out, what is left"` — and on
`#/links`, where each row reads `"Meal plan & Commodore Cashget.cbord.com"`.

So anchor the **start** and leave the end open, unless you have checked
the name. The check is one line, and it is worth running before writing a
selector against anything that draws as a card or a list row:

```js
await page.evaluate(() =>
  [...document.querySelectorAll('main button')]
    .filter((b) => b.checkVisibility())
    .map((b) => JSON.stringify(b.textContent.replace(/\s+/g, ' ').trim())),
);
```

`JSON.stringify` rather than the bare string, so the missing space is
visible instead of being something you have to notice.

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

These are independent axes (see `lib/types.ts` on `NavMode` and
`components/shell/useShell.ts` on `Shell`), and every combination is a valid
app. A change to one is not exercised by looking at the other. The two below
are the ones worth seeding on most runs; `directory` is a third, and the
table says where it lives.

Seed them before the first load — much faster than clicking through
Settings. **`schemaVersion` is part of the seed, not decoration:**

```js
await ctx.addInitScript(() => {
  localStorage.setItem('semester.v1', JSON.stringify({
    schemaVersion: 6,          // must match SCHEMA in lib/migrate.ts
    shell: 'soft',
    nav: 'springboard',
  }));
});
```

| Setting | Source | Values in code | Labels on screen |
|---|---|---|---|
| `shell` | `SHELLS` | `plain` · `grouped` · `soft` | Drawn · Grouped · Soft |
| `nav` | `NAVS` | `tabs` · `feed` · `springboard` · `shelves` · `workspace` · `guides` | Tab bar · One feed · Home screen · Shelves · Workspace · Study guides |

Three and six, so **eighteen pairings**, and each is a working app. A change
to one is not exercised by looking at another.

**`list`, `tiles` and `hue` are not shells,** though this table said they were
for several releases. They are two other settings entirely, and seeding any of
them as `shell` falls through to plain without a word:

| Setting | Source | Values | What it is |
|---|---|---|---|
| `directory` | `DIRECTORIES` | `list` · `tiles` · `''` | How the directory of every screen is drawn. `''` is *nobody has chosen*, and `directoryOf` then answers from the layout — tiles under soft, the list otherwise. Not a consequence of the shell: somebody on soft who asked for the list keeps it. |
| `accent` | `ACCENTS` | `sterling`, … | The colour, by name. `hue` is not one of its values — it is the id `accentFromHue()` stamps on a *dragged* colour, which is seeded as its own number: `hue` (0–360, `-1` for "use the named accent"). So `hue: 210` is a real seed and `accent: 'hue'` is not. |

So there are three axes here, not one, and the old row had flattened all
three into the shell's. That is the same failure this section warns about one
paragraph down, committed by the warning's own table: every wrong value in it
came up plain, working, and silent.

Measured, reading the directory's own view toggle: `shell: 'tiles'`, `'hue'`
and `'list'` each drew *exactly* what `shell: 'plain'` drew, while
`shell: 'soft'` differed — the three were falling through, as claimed. The
sting is in `tiles`: seeded as a shell it produces **the list**, because plain
is not soft and `directoryOf` answers list for everything that is not. The
wrong seed does not merely fail to work, it draws the opposite of its own
name. Seed it on the right axis — `directory: 'tiles'` — and it draws tiles
under plain, and `directory: 'list'` keeps the list under soft.

The probe matters as much as the seed. **Both** view buttons carry
`aria-pressed` — the list one as `aria-pressed={!grid}` — so a probe asking
"is any of them pressed" is true in every state and reports tiles forever.
Read the one named `Show as a grid`. The first run of this check reported all
seven cases identical and looked like proof the seed was dead; it was the
probe that was dead. Point a probe at the fault it is meant to see before you
trust the run it is in.

**The default is the tab bar** (`nav: 'tabs'` in `state/shape.ts`, and the
one entry in `NAVS` marked `deft`). This file said `workspace` for several
releases, and the reason it survived is worth more than the correction:
**whoever wrote it had seeded without `schemaVersion`,** and that really does
come up in the workspace. Measured, three starts, reading the chrome off the
page rather than the stored value:

| What the run starts from | What it draws |
| --- | --- |
| no storage at all | **tabs** |
| `{ schemaVersion: 6, seenOnboarding: true }` | **tabs** |
| `{ seenOnboarding: true }` — no version | **workspace** |

So the old claim was a true observation of the *next* section's fault,
written up as a fact about the app. The two contradicted each other in one
file, and the migrations section below is the one that was right.

The warning it was making still stands, pointed at the right thing: a run
that seeds nothing is not a neutral run, it is a **tab bar** run, and a run
that seeds carelessly is a workspace one. Neither is something to infer from
having asked — read it off the DOM (§6b).

**Read `NAVS` and `SHELLS` rather than trusting the rows above.** Both have
moved without this file noticing, and in both directions. `NAVS` was four
when this was written, six once the Workspace and Study-guides ports landed,
then seven when a `browser` nav arrived — and six again when that nav merged
back into the workspace and was deleted from the union. `SHELLS` has been
three throughout; it was this file that claimed six, by folding `directory`
and `accent` into it. `NAVS` in `lib/look.ts` is the list; `SHELLS` beside it
is the other axis, and `DIRECTORIES` beside *that* is a third.

The instruction survived being wrong, which is the argument for it: following
it is what turned up the six-shell row, and the row is what the instruction
was for. Check the unions on the day you seed them.

**A value that no longer exists fails silently, which is why this matters.**
`useShell` returns plain for anything it does not recognise and the nav
reader does the same, so seeding the retired `nav: 'browser'` today comes up
in the *workspace* — working, wrong, and nothing logged. Measured: a sweep
seeding all seven of the old navigations reported seven distinct runs and
had really made six, because `browser` and `workspace` drew the same chrome.
Check the seed in the DOM (§6b), never by assuming the value took.

The names do not match: **`plain` is "Drawn"** (`SHELLS` in `lib/look.ts`).
`drawn` is a real value in this app, but it belongs to `corners`, not
`shell` — and `useShell` returns plain for anything it does not recognise,
so `shell: 'drawn'` falls through silently and looks like it worked.

### Without `schemaVersion` the migrations silently rewrite your seed

`lib/migrate.ts` walks a stored copy forward from whatever version it
declares to `SCHEMA`, and **a copy with no version marker is version 1**, so
every step runs. Two of them set `nav` outright — one to `workspace`, a
later one to `guides` — because each was a deliberate change of where the
app opens, made once per stored copy rather than as a standing policy.

A seed without `schemaVersion` is therefore a version-1 payload, and those
steps overwrite the `nav` you just asked for. The failure is invisible: the
app comes up working, in the wrong navigation, and nothing is logged. Worse,
it is *partial* — `recent`, `visited` and `shell` come through untouched, so
the seed looks like it took.

Setting `schemaVersion` to the current `SCHEMA` says "this copy is already
current", no step runs, and `nav` survives. Check the number in
`lib/migrate.ts` rather than copying the 6 above; the whole point of the
marker is that it moves.

**Check it in the DOM, never by reading `semester.v1` back.** The obvious
test — seed a nav, then read the key again — passes whether or not the seed
took, because nothing has necessarily saved yet and you are reading your own
write. Measured both ways on the same build: reading the key said every
navigation applied; reading the chrome said none of them had, without the
version. The navigation each one draws is in §6b, and a one-line probe
settles it:

```js
await page.evaluate(() => ({
  tabs: document.querySelectorAll('.app-tabs').length,      // tabs
  shelf: document.querySelectorAll('.shelf-nav').length,    // shelves
  icons: document.querySelectorAll('.iconshape').length,    // springboard
  desk: document.querySelectorAll('.deskwork').length,      // workspace
  strip: document.querySelectorAll('.deskstrip').length,    // workspace
}));
```

That is the same rule as "look at the screenshot" and "assert on the DOM
when the change is a removal", applied to the seed itself.

Seeding the shell does **not** skip the adoption prompt — still click Skip.
`semester.v1` is plain JSON (`state/shape.ts`, `STORAGE_KEY`) and is merged
over the defaults, so a partial object is fine — as long as the version is
in it.

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
| `workspace` | `.deskstrip` (the app-tab strip) inside `.deskwork` | above the scroller |
| `guides` | no chrome of its own; its `<h1>` is "Guides" | — |

**There is no `browser` row any more.** It was the seventh navigation for one
release — `.deskwork` with no `.deskstrip` — and the browser-shaped shell
merged back into `workspace`, which now draws both. Seeding `nav: 'browser'`
is seeding a value the union no longer has, so it lands in the workspace
without a word. If you are reading an older script that expects the two to
differ on `.deskstrip`, that difference is gone, not broken.

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
  // `schemaVersion` or the migrations rewrite `nav`. See section 5.
  localStorage.setItem(
    'semester.v1',
    JSON.stringify({ schemaVersion: 6, shell: 'soft', nav: 'tabs' }),
  );
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
