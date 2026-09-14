# Whole-app audit

A pass over `app/src` for redundancy, duplication, bugs, and pathways that
break — what was checked, what was found, and what was checked and found
clean, so the next pass does not spend its time here again.

Baseline and result are both green: `npm run lint`, `npm test`, `npm run build`.

**Two of the five below were found independently on `main` while this pass ran**
and are marked as such. Their entries are kept because the reasoning is still
the record of what was wrong, not because this branch fixed them — after the
merge, main's version of each is what ships.

## What was wrong

### 1. The launcher grid answered for a student, whoever was holding it

`appShelves` and `tilesFor` in `lib/apps.ts` and `lib/launcher.ts` called
`destinationsFor` without a role. That compiles, because the argument is
defaulted, so the grid silently asked what a **student** may open — for
everybody.

Every other surface asked correctly: search goes through `offered`, the
shortcut row through `readFavourites`, Lately through `lately`, and all three
take the role. Only the grid did not, so the three gates in `lib/nav.ts` held
everywhere except the one screen whose whole claim is that it is everything.

For a teacher that is eight screens — Housing, Costs, The degree, When you are
behind, Tonight, Groupwork, Classmates, Applying — in the launcher and the All
apps list, one tap from opening, while the search field beside them had already
stopped offering them.

The existing test compared the grid against `offered` at the default role on
**both sides**, which is why it stayed green throughout.

### 2. The browser shell kept four settings of its own — *also fixed on `main`*

`components/GoogleShell.tsx` held the shortcut row's contents, whether that row
is drawn, light versus dark, and a recents list in `localStorage` under
`semester.google.*`, behind a private `usePreference` hook. All four already
had a home:

| What | Its home in this app | The shell's private copy |
|---|---|---|
| Shortcuts pinned | `look.favourites`, resolved by `lib/desk.ts` | `semester.google.favorites` |
| Whether to draw them | `look.shortcuts` | `semester.google.showFavorites` |
| Light or dark | `look.ground` | `semester.google.lightHome` |
| Where you have been | `state.recent`, filled by `push` | `semester.google.recent` |

So pinning an app there left the search home, the launcher and every other
navigation's sidebar unchanged; the Appearance switch moved a CSS class on one
`<div>` while Settings → Look went on believing it owned light and dark; and
none of it reached the account, because a look key syncs and a private
`localStorage` key does not.

That is the failure `components/desk/Customize.tsx` opens by warning against —
a panel grown until it is a second settings screen, at which point there are
two that disagree.

Three things fell out of the fix: `DEFAULT_FAVORITES` there was
character-identical to `DEFAULT_FAVOURITES` in `lib/desk.ts`; the row was
sliced to nine while `MAX_FAVOURITES` is six, so two caps disagreed and the
larger was unreachable; and the grid took neither the saved `groupOrder` nor
the role, so it could hold a different set of apps in a different order from
the launcher.

### 3. Customize Semester could be seen, hovered, and never clicked — *also fixed on `main`*

Found by driving the app, not by reading it.

On the browser shell's search home the legacy home is mounted in
`.g-home-legacy`: fixed, `inset: 0`, `z-index: 50`, over the shell's own
wordmark, field, shortcuts and footer. `pointer-events: none` is what makes
that survivable, and `.g-home-legacy .device > *` puts them back so a toast or
a dialog is still clickable. Two of those direct children are `.deskwork-body`
and `.device-pane` — full-window containers that on this overlay draw nothing
at all, because `.g-home-legacy .scrollarea` is `display: none`.

Two invisible window-sized blocks catching every press.
`document.elementFromPoint` over the Customize Semester button returned
`DIV.device-pane deskwork-pane`. It is the only control in that corner, it
highlights on hover, and pressing it did nothing.

### 4. Tab put the focus ring around a link drawn behind the header

`.skip-link` declares `z-index: 100`. `.device > *` — the blanket giving every
direct child `position: relative` and `z-index: 1` — comes later in `app.css`
and weighs the same, so it takes both. The `position` half was found and fixed
once already and its story is in the comment there. The `z-index` half was in
the same rule, never added to the fix, and had no wrong pixel to give it away:
unfocused, the link is translated off the top of the window and paints nothing.

Focused is the state that matters, and there it showed plainly.
`document.elementFromPoint` over the focused link returned `SPAN` and
`BUTTON.btn` in five of six layout-and-width combinations — the words "Skip to
content" were behind the header and the tab strip. The first line of this app's
accessibility is the first thing Tab reaches.

### 5. The Appearance swatches previewed the opposite of what they did — *moot on `main`*

In the browser shell's Customize panel the two chips were painted with
`--app-fg` and `--app-accent-wash`, which invert with the ground. In the dark,
the button labelled Dark drew a white chip and the one labelled Light drew a
dark one. `.desk-swatch-chip` in `styles/app.css` had already solved this with
fixed colours.

Moot after the merge: `main` took the better route on the same control, and
the panel now reports which ground you are on and links to the page that owns
it rather than carrying a second pair of buttons at all. A swatch that is not
drawn cannot be drawn upside down.

## The duplicates

No duplicated constant values and no duplicated function bodies now remain
across `app/src`, measured by normalising whitespace and comments away and
hashing.

- **Nine copies of the days and the months** across seven files under five
  names — `SHORT`, `DAY_NAMES`, `DAYS`, `DAY_LETTERS`, and `MONTHS` four times
  — all indexed by `getDay()`/`getMonth()`, all identical. `lib/date.ts`
  already exported three of them. The full-length forms had no canonical copy
  at all and are added there; `MONTH_WORDS` is derived from `MONTH_NAMES`
  rather than typed out again.
- **The file-picker accept string**, written out on Import and Update,
  identical up to the point where they legitimately differ. The shared half is
  `DOCUMENTS` in `lib/extract.ts`, which is where the fact lives — it is a
  statement about what that parser can read, not about either screen.
- **The OOXML boilerplate.** `lib/ooxml.ts` is new and holds the XML
  declaration, the relationships namespace, and the `xml()` escaper — all three
  written out in `docx.ts`, `pptx.ts` and `xlsx.ts`, with `REL` twice inside
  `pptx.ts` alone. A typo in any of them produces a file that downloads, opens
  and is rejected as corrupt, on somebody else's machine, after the student has
  sent it. Nothing else is shared between the three and nothing else moved.
- **The readable-mail list.** `MAIL_PROVIDERS` on `screens/Mail.tsx` named what
  the branches of `readMail` decide. It moves beside them as `MAIL_READABLE` —
  which is exactly what `WRITABLE`'s comment says it is there to prevent.
  Deliberately **not** merged with `WRITABLE`: whose calendar can be written to
  and whose mail can be read are two questions with the same answer today.
- **`ALWAYS_TO_HAND`.** Today, You and Notifications are on the bar in every
  navigation, and two surfaces had each worked that out and written the same
  three down — one with a comment reading "Same list as the shelves".

## Checked and found clean

Worth recording, because these are the expensive things to re-check.

- **The routing spine.** Screen union, `lib/nav.ts` registry, `App.tsx` cases
  and every `dispatch({ type: 'go' })` target cross-referenced. No `go` points
  at a screen that does not exist; no destination lacks a case. `gone` appears
  only as a deliberate fixture for the unknown-screen path, and `onboarding`
  is an early return above the switch.
- **Dead code.** No file in `app/src` is never imported. The 74 test files with
  no same-named source are cross-cutting invariant suites, not orphans.
- **Effect hygiene.** Every `useEffect` body scanned for listeners, timers and
  observers without teardown: none. Five async effects set state after an
  await; four are guarded, and the remaining ones are debounced or idempotent
  and write a status string.
- **Lint warnings.** The `react(refs)` and `react(purity)` warnings were each
  read. All are false positives — a ref passed as a prop, and `Date.now()`
  inside an event handler.
- **Every navigation, driven.** Seven navigations across nine screens at two
  widths: no page errors and no blank screens in any of the 126 combinations.
- **Every visible control, hit-tested.** `document.elementFromPoint` at the
  centre of every visible control, across navigations, screens and widths.
  Findings 3 and 4 came from this. Everything else it flagged was triaged as an
  artifact of the probe rather than a defect — a closed `<details>` keeps stale
  geometry under `content-visibility: hidden`, sticky headers legitimately
  cover what scrolls under them, the unfocused skip link is clipped rather than
  sized away, and a nested control is inside its own row.

## What guards it now

Each was verified to fail against the code as it was.

- `lib/apps.test.ts` — the launcher holds what **this role** is offered, not
  what a student is, and drops the student-only screens for a teacher.
- `lib/onelook.test.ts` — a look preference lives in the look, and not in a
  component's own storage; and not under a key a component computes for itself,
  which is the shape that actually got in, since the hook wrote a template and
  no literal key name ever appeared in the source.
- `styles/stacking.test.ts` — the skip link is lifted above the blanket's own
  z-index rather than above a literal, so the two cannot drift. The home
  overlay is held by `main`'s `home-reachable.test.tsx`, which walks the real
  tree from the hidden scroller up and is the better test of the two.

`lib/onelook.test.ts` guards *storage* — that no component keeps a rival copy
of a look preference — where `main`'s `onframe.test.ts` "one writer per
preference" guards *authorship*, which file may write a look field. They sit
beside each other rather than repeating each other.
