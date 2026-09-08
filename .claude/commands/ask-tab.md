---
description: Rebuild the Ask Claude tab as the one AI surface — a full ChatGPT-shaped chat with history, streaming and a pinned composer — and remove every other route to the assistant.
argument-hint: "[optional: 'layout only' to skip the merge of the other AI surfaces]"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# The Ask Claude tab becomes the chat

Right now tapping **Ask Claude** (`app/src/screens/Ask.tsx`) does not take you
to the AI. It shows a paragraph explaining that the assistant is somewhere else,
a button that opens a sheet, an API-key form, a spend total and two lists of what
the assistant can and cannot do. That is a settings screen wearing the name of
the thing a student is looking for.

There are then three separate surfaces over one conversation:

| Surface | File | How you get there |
| --- | --- | --- |
| The sheet | `app/src/ai/Assistant.tsx` | Floating button, or `A` from anywhere |
| Full screen | `app/src/ai/Chat.tsx` | The `chat` destination, and "expand" inside the sheet |
| The tab | `app/src/screens/Ask.tsx` | The `ask` destination, which then opens the sheet |

Three doors, one room. Fix that, and make the room look like a chat app.

## What it becomes

**One destination: `ask`.** Tapping the tab lands you *in the conversation*,
with the last thread open and the box focused. Nothing in between.

- Delete the `chat` destination: its row in `app/src/lib/nav.ts`, its member of
  the `Screen` union in `app/src/lib/types.ts`, both cases in `app/src/App.tsx`,
  and the `dispatch({ type: 'go', screen: 'chat' })` in `ai/Assistant.tsx`.
  Move `chat`'s search `keywords` onto `ask` so "conversation", "threads",
  "history" and "full screen" still find it. Migrate saved state in
  `app/src/state/shape.ts` so anyone sitting on `chat` lands on `ask`, and add a
  test for that migration.
- `ai/Chat.tsx` is the starting point for the new screen, not a file to keep
  beside it. `screens/Ask.tsx` renders it; there is one component.
- **The sheet survives only as a way in, never as a second chat.** Keep the
  floating button and the `A` shortcut and keep `ai/AskAbout.tsx`'s long-press,
  because asking about the row you are holding is worth a lot — but they now
  attach their context and take you to the `ask` screen with the question seeded
  in the box. Same `useConversation` log, same rendering, one place the answer
  ever appears. If keeping a peek panel is genuinely better for a one-line
  answer, it may only render the *same* turn components, and its expand control
  must go to `ask`.
- The provider picker, API key, proxy, model list and spend total move out of
  `Ask.tsx` into `app/src/screens/settings/` as their own page, reachable from
  the settings index and from a small link in the chat header. Wire it into
  `screens/settings/Index.tsx` and `screens/settings/Page.tsx` the way the other
  settings pages are wired. Do not lose a word of the honest security prose in
  the existing key form — it moves verbatim.
- The "What it can see" and "What it can do" sections move to the same settings
  page. They are a disclosure, and a disclosure belongs where somebody goes to
  check, not in front of the box every time.

## The layout

Shaped like ChatGPT, drawn in this app's system. Use the Industry tokens already
in use (`var(--type-*)`, `var(--sp-*)`, `var(--app-*)`) — do not import a new UI
kit, do not copy ChatGPT's colours, and do not add a dependency.

**Wide window (`DESKTOP` in `app/src/lib/media.ts`) — two columns:**

- **Left, a history rail, about 260px, collapsible.** Reuse `ai/Threads.tsx`,
  which already does rows, rename, pin, archive, search and delete-behind-a-
  second-tap. Add ChatGPT's grouping: **New chat** button at the top, then a
  search box, then pinned, then threads under **Today / Yesterday / Previous 7
  days / Older**, newest first, each row still showing the *first question* —
  the reasoning in that file for why it shows the question and not the answer is
  right, keep it. Collapsed state is remembered.
- **Right, the conversation**, capped at a reading measure and centred, with the
  composer pinned to the bottom of the window and the transcript scrolling
  behind it.

**Phone — one column:** the conversation full-bleed; the history is a drawer
behind the header's list button (`ThreadsOver` already does this); the composer
sits above the tab bar, respecting `--tabbar-h` and `safe-bottom`.

**The transcript**, reusing `ai/Turns.tsx`:

- Your question and the answer read as clearly different things — the question
  as a contained block, the answer as plain prose on the page at full measure.
- Streaming, with a **Stop** control while it streams, and a **Regenerate** on
  the last answer. `useFollowing` already handles stick-to-bottom; keep it, and
  keep the scroll-to-bottom affordance when you have scrolled up.
- Per-message controls, quiet until hover or focus: **Copy**, **Regenerate** on
  the last answer, **Edit and resend** on your own last question.
- `ai/Actions.tsx` proposals stay exactly where they are, in the flow of the
  answer that offered them, with their Undo. They are the thing this app has
  that a chat window does not; do not bury them in a panel.
- The "looking at" line — what screen the question was asked from — stays, as a
  small line on the question that carried it. That context is why this assistant
  is worth having.

**The empty state**, which is the screen a student sees most often:

- The app's name for it, one line about what it can see, and four suggestion
  chips built from real state — the nearest deadline, the course with the next
  class, this week's load, the weakest unit. Not four static strings.

**The composer** (`ai/Composer.tsx`):

- Autosizing textarea, max about eight rows then it scrolls.
- Enter sends, Shift+Enter is a newline on desktop; on touch, Enter is a newline
  and the send button sends. `sendHint` already knows the difference — keep it.
- Send turns into Stop while streaming.
- Disabled with a clear reason when no provider is configured, and that reason
  links to the new settings page.

**Keyboard**, on desktop: `A` from anywhere opens the tab (it already does),
`Cmd/Ctrl+K` new chat, `Esc` blurs the box, `Up` in an empty box edits your last
question.

## Guardrails

- **One conversation store.** Everything reads and writes through
  `ai/converse.ts` and `ai/store.tsx`. If the new screen adds its own turn list,
  it is wrong.
- **Do not touch `app/src/lib/context.ts`.** What leaves the device is decided
  there and this is a layout change. If a new affordance would send something
  new, stop and say so instead of widening it.
- **Do not touch the tool list.** The assistant still cannot delete anything and
  still cannot move a grade or a syllabus date.
- Keep the file-top prose. Both `ai/Chat.tsx` and `ai/Assistant.tsx` open with an
  argument for why there are two surfaces. That argument is now out of date —
  rewrite it to say there is one surface and why the sheet became a way in,
  rather than deleting the reasoning.
- Accessibility, at the level the rest of the app holds: the transcript is a
  labelled live region, streaming answers announce politely and not per token,
  every icon control has a name, focus moves into the composer on open and back
  out on close, and tap targets stay at the size `styles/taps.test.ts` enforces.

## Done means

From `app/`:

```bash
npm run lint && npm test && npm run build
```

All green, plus:

- Tapping the Ask tab shows a conversation, not a paragraph about one.
- `grep -rn "'chat'" app/src` finds no destination.
- There is exactly one component that renders a turn, and one that renders the
  composer.
- Threads, streaming, stop, regenerate, proposals and Undo all work on both a
  narrow and a wide window — check both, and say which widths you checked.

Report at the end: what the tab does now, what moved to settings, what happened
to the sheet, and any behaviour that changed for someone with saved threads.
