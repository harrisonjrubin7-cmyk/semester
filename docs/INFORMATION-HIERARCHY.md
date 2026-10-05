# Information hierarchy

## The three questions

Every major screen should answer, in its first visible area:

1. **Where am I?** — the header's title (the one `h1`, held by
   `a11y/landmarks.test.ts`), and on a workspace the `ContextBar`'s context
   line and object title.
2. **What matters now?** — one primary thing, drawn first and largest.
3. **What can I do next?** — one primary action, visibly a button.

The shared components are built so that a screen using them answers all three
without extra work: `ContextBar` names the context, the object and its
source/save state, then offers one primary action; `ObjectCard` does the same
at card size; `NextSteps` closes a workflow with at most three next actions.

Where that is already true: the deadline, the course hub, the study guide,
Study Studio's draft, a Pathway programme and the toolkit's assignment
workspace open with a context bar; Career's open opportunity and University's
school records are object cards; the deadline, Registration day and Close term
end with Next. The full list is in
[SEMESTER-PLATFORM-UNITY-PATTERNS.md](SEMESTER-PLATFORM-UNITY-PATTERNS.md#where-each-is-used).

## One primary action

- `ContextBar` and `ObjectCard` take one `primary` and one optional
  `secondary`. The primary is `.btn .btn-primary`; the secondary is a quiet
  text button (`.link-quiet`). `components/unity/unity.test.tsx` asserts an
  object card renders exactly one `.btn-primary`.
- A card with no primary action omits the button rather than drawing a dead
  one. The brief's "decision card" is the default; an information-only card is
  the exception, for a card whose display is the task.
- Everything beyond primary and secondary goes behind a disclosure:
  `ContextBar`'s `children` slot, "Source & details", "Open in".

## Card rhythm

`ObjectCard` (`app/src/components/unity/ObjectCard.tsx`) is the rhythm in
code:

```
REQUIREMENT · NEEDS CONFIRMATION     eyebrow: kind + status words (+ glyphs)
Registration opens tomorrow          title — a real heading, level set by prop
You have two items left.             one sentence of why it matters
Tue 14 Oct · 9:00                    key metadata, tabular figures (.nums)
[Finish checklist]  View details     one primary, one quiet secondary
Source & details · Open in …         disclosure, never in the way
```

The heading level is a prop (`level`, default 3) because a card cannot know
where it sits in the screen's outline. The card is an `<article>` labelled by
its heading.

## Progressive disclosure

Summary → details → workspace → advanced. The patterns in use:

| Pattern | Where | What it hides until asked |
| --- | --- | --- |
| Source & details drawer | Every placed `ContextBar` and `ObjectCard`, Today's path snapshot | Origin sentence, source name, freshness, sources used, where it is used, limitations, visibility, report |
| `<details>` "Why am I seeing this?" / "How this status is calculated" | `TodayDecisionSurface.tsx` | The reasoning and source behind Today's suggestion and path figure |
| About this screen | `ScreenGuide`, drawn by `ShellBody` at the end of every screen (as a sheet on the three that fill their box) | The four answers: what, why, from where, what next |
| Arrange | `CommandCenter` | Move up / Move down / Unpin / Pin controls |
| Detailed workspace mode | `.detail-only` in `unity.css` | The source's own sentence on each object card — Career's opportunity, University's records (hidden in the other modes) |
| Show more / Show less | Search page (`components/Command.tsx`) | The rest of the destinations |
| The `+` box → "Or keep it as" | `KeepItAs` in `QuickAdd` | The undated kinds: task, note, source, study session, advisor question, idea |

Nothing is removed by disclosure: every hidden item is one press away and
reachable by keyboard and screen reader (`aria-expanded` and `aria-controls` on
the About this screen toggle; native `<details>`; dialogs with a name).

## Calm density on Today

The brief's target for Today: one primary next step, three immediate
commitments, one study suggestion, one opportunity or campus item, and "See
more". What Today draws, in order (`app/src/screens/Today.tsx`, both feed
layouts):

| Brief | Today |
| --- | --- |
| — | `FirstGoal`: "What would help most today?" until answered, then one line "Your focus · … · Change" |
| One primary next step | `TodayDecisionSurface` → "Next best step": a title, one sentence, one primary `ActionButton`, "Why am I seeing this?", "Not now" (with Undo) |
| (context) | `TodayDecisionSurface` → "Your path": covered / total requirements, marked `Needs confirmation`, with Source & details |
| Three immediate commitments | `TodayDecisionSurface` → "Next 72 hours": at most four rows (`slice(0, 4)`), then "See full plan →" |
| One study suggestion, one opportunity | `CommandCenter` → "Pinned": three widgets by default (This week's plan, Current assignment, Study progress), up to five, including Upcoming opportunity (the soonest deadline on a live application that has not passed) |
| See more | "See full plan →", and the rest of Today below |

The differences are small and on purpose: the near-term list is four rather
than three, and the study and opportunity items are student-pinned widgets
rather than fixed slots, so a student who does not want an opportunity on
Today does not get one.

Focused workspace mode hides `FirstGoal`, `CommandCenter`, `NextSteps` and the
"Also useful" journey (`.today-secondary-journey`), leaving the next step and
the near-term list.

## Keeping source, policy and privacy present but quiet

- Status words sit in the eyebrow and the state row, at `--type-xs`, in
  `--text-secondary` unless they need attention — never louder than the
  primary action.
- "Source & details" is a quiet text button on every card and bar that has a
  source, never a primary.
- Who can see a thing is stated in the drawer ("Only you" by default) and in
  the capture sheet, rather than as a badge on every row.
