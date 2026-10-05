# Device input modes

Layout follows the room available. Input enhancements follow the input
available. The two used to be conflated, since width stood in for "has a
keyboard", and this document exists so that mistake is not made again.

## The queries

All of them are in `app/src/lib/media.ts`:

| Query | Constant | Answers |
| --- | --- | --- |
| `(min-width: 840px)` | `WIDE` | Is there room for the rail? |
| `(min-width: 1200px)` | `DESKTOP` | Is there room for the desktop layout? |
| `(max-height: 599px) and (pointer: coarse)` | `HANDHELD` | Is this a phone on its side? |
| `(pointer: coarse)` | `TOUCH` | Is the primary input a finger? |
| `(any-pointer: fine)` | `FINE` | Is there a mouse or trackpad anywhere? Probably a keyboard too. |

**Rule:** when the question is about input, ask an input query. `WIDE` is not
evidence of a keyboard. A laptop window can be 640px wide, and an iPad in Split
View with a Magic Keyboard is narrow too. `TOUCH` is not evidence of a small
screen: a 13-inch iPad is 1366px wide.

## What each input may add, and what it may not remove

| Input | Enhancement in the app | Required alternative |
| --- | --- | --- |
| Touch | Tab bar under the thumb, 44px+ targets (`@media (pointer: coarse)` rules), swipe on flashcards | Every swipe has a button; every gesture has a visible control |
| Mouse / trackpad | Row hover actions in Mail (`@media (hover: hover) and (pointer: fine)`) | The same actions are in the toolbar and the reader; the stylesheet hides them from touch rather than drawing them small |
| Keyboard | `lib/keys.ts` shortcuts: `/` search, `n` capture, `Esc` back, `?` the list, and more; `components/Keys.tsx` listens | Every shortcut is also a visible control. `?` opens a sheet listing them. |
| Drag and drop | Calendar event moves | Event detail has date and time fields |
| Camera | Photo capture for notes and problems (`screens/camera.test.tsx`, `solvephoto.test.tsx`) | File upload and typed entry |
| Voice | Dictation in the composer (`ai/Composer.tsx`) | The same field accepts typing |

## Keyboard shortcuts, specifically

`components/Keys.tsx` is mounted in every frame and listens when
`WIDE || FINE`:

- a laptop at any window width → listens
- an iPad with a trackpad keyboard, in Split View → listens
- an iPad with no fine pointer, at 840px or wider → listens (as before)
- a phone → does not listen, and costs nothing

What it still cannot see is an iPad at under 840px — which now includes every iPad held upright — with a keyboard that has no
trackpad. No media query reports a keyboard. The remedy, if that case matters,
is to start listening on the first physical key event rather than on a query.
That was not done here because every shortcut already has a visible
equivalent.

`components/keysnarrow.test.tsx` covers the three main cases and was checked
failing against the old width-only rule.
