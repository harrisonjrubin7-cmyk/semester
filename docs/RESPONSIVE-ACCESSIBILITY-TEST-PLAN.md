# Responsive accessibility test plan

What is checked automatically at each width, what has to be checked by hand,
and how to do it. Commands run from `app/`. See
[REGRESSION-CHECKLIST.md](../REGRESSION-CHECKLIST.md) for the gates and their
baselines.

## Automated

| Test | Guards |
| --- | --- |
| `src/widthgate.test.ts` | Every file that reads the width has a written narrow-window equivalent. Includes a control check that the scan finds anything at all. |
| `src/screens/mailpaging.test.tsx` | Mail's second page is reachable on a phone. The pager is drawn once on a wide window. No pager row appears when there is one page. |
| `src/components/keysnarrow.test.tsx` | Shortcuts listen on a narrow window with a fine pointer and on a wide window, and not on a phone. |
| `src/lib/chrome.test.ts` | Exactly one navigation per width, navigation and screen, and none on full-screen screens. |
| `src/lib/tiers.test.ts` | `lib/media.ts` and `styles/app.css` agree on the breakpoints. |
| `src/lib/contrast.test.ts` | Text contrast on every ground and surface. |
| `src/rootunmount.test.ts` | Tests unmount what they mount. Required for any new jsdom test here. |

Both behavioural guards added with this plan were checked the way
`CLAUDE.md` asks: the fix was reverted, the test went red, and the fix was
restored.

## By hand, per release

Use the `run` skill (`.claude/skills/run`) to start the app, skip the adoption
prompt and set the layout. Then, at each of **320, 390, 600, 768, 840, 1024,
1280 and 1600** px wide:

1. **Reflow.** No horizontal page scroll on Today, Courses, Calendar (Agenda),
   Mail, Settings and a course guide. Deliberate two-dimensional surfaces (the
   week grid, a sheet, a map, a slide canvas) may pan, and each needs a list or
   table alternative within reach.
2. **Reach.** From Today, open search, capture, the assistant and Settings, and
   return. Open a Mail folder with more than fifty conversations and reach the
   last page.
3. **Keyboard.** At 640px in a desktop browser, `?` opens the shortcut sheet.
   Tab reaches every control in order and the focus ring is visible.
4. **Zoom.** At 200% browser zoom on a 1280 window (effectively 640), repeat 1
   and 2.
5. **Text size.** Set the largest text size in Settings and repeat 1 at 390.
6. **Rotation.** Rotate a phone with a message open in Mail. The message stays
   open, and rotating back restores the list.
7. **Reduced motion.** With `prefers-reduced-motion: reduce`, sheets and pane
   changes do not animate (`styles/app.css` carries the rules).
8. **Screen reader.** With VoiceOver on iOS at 390, the tab bar items and the
   Mail pager are announced by name ("Newer", "Older", "Pages").

Record each run's screenshots with the width in the file name. A dark
rectangle is a failure to launch, not a dark theme.

## Not covered yet

- Automated reflow at 320px across all screens (a Playwright sweep that fails
  on `scrollWidth > clientWidth`) would turn check 1 into a test. It needs the
  dev server in CI, which the browser smoke job already starts.
- Offline, Queued and Conflict are covered in jsdom by
  `state/syncstates.test.tsx`. By hand: with devtools set to Offline, add a
  task and check the Settings row reads "Queued to sync", then go back online
  and check it reads "Synced" within a few seconds.
