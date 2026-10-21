# Simplify pass 1: partial audit (2026-10-18)

Status: **first pass, partial.** Base `955d9e06`. Rows marked *verified* were checked by a grep or a read in
this pass. Rows marked *open* were not read. No merge, deletion or redirect was made.

The root `SIMPLIFY-AUDIT.md` (365 KB, from 13 October) is a separate document and is not changed by this pass.

## 1. The request's premises, checked

| Claim | Verified | Evidence |
| --- | --- | --- |
| `lib/nav.ts` has 59 destinations | **Not confirmed.** `screen: '…'` appears 64 times in `nav.ts`. Which are destinations (and which are nested or flag-gated) is open. | `grep "screen: '" app/src/lib/nav.ts` |
| The `Screen` union is the destination list | **No.** It has 97 members, including shell views (`search`, `directory`), nested detail views (`course`, `item`, `event`), and flag-gated screens (`console`, `dining`, `moderation`). | `app/src/lib/types.ts` lines 696 onward |
| Six screens answer "what is due": `home`, `brief`, `weekly`, `ahead`, `tonight`, `mine` | **Partly false.** `home`, `brief` and `mine` are union members. `weekly` is not a screen: it is `screens/report/Week.tsx`, one grain of a report (`Day.tsx` and `Term.tsx` are the others). `ahead` is an option label (`nav.ts:190`) and a `taskTags` value on 17 entries. `tonight` appears in no screen, union member or nav entry. | `nav.ts:190`, `nav.ts` taskTags, `screens/report/` |
| Calendar has four grains that overlap `ahead` and `weekly` | **Open.** `screens/Calendar.tsx` exists; grain code is not yet read. | — |
| Three surfaces over one conversation: `ask`, `chat`, the assistant sheet | **Partly.** `ask` is a union member (`types.ts:734`); `ai/Chat.tsx` and `ai/Assistant.tsx` exist. Whether they share one conversation is open. | `src/ai/` |
| `grades`, `standing`, `worked`, `proof` | **Partly false.** `Grades.tsx` and `Proof.tsx` exist. `standing` is `components/Standing.tsx`, not a screen. `worked` is a *type* (`EXAMPLE_KINDS`, `types.ts:351`), not a screen. | `types.ts:351`, `components/Standing.tsx` |
| `everything` is a screen | **False.** No file and no union member; it appears only in comments. | `grep -r everything src` |
| `springboard`, `help`, `search`, `me` are ways to find a screen | **Partly.** `Springboard.tsx`, `Help.tsx`, `Me.tsx`, `Directory.tsx` exist; `search` is a shell view. Overlap is open. | `types.ts:703–714` |
| Five ways to change course data: `import`, `edit`, `update`, `announce`, `check` | **Partly.** Four are union members (`types.ts:721, 731, 742, 764`). `check` is not. | `types.ts` |

**Consequence:** most of the named "duplicates" are views, grains, labels or taskTags, not screens. The real
merge set is smaller than the request implies, and it has to be read rather than guessed from names.

## 2. Screen overlap (open)

Not yet grouped. Candidates from the verified rows:

- `calendar` grains vs `report/Week.tsx`: both answer "what is my week".
- `ask` vs `ai/Chat.tsx` vs `ai/Assistant.tsx`.
- `springboard`, `directory`, `me`, `search`.

## 3. Route count per screen (open)

Not run. Required greps: `dispatch({ type: 'go'`, `openCourse`, `openItem`, `openEvent`, `openGuide`, `openLesson`.

## 4. Duplicated controls (open)

Not run. Required: writers of `setTabs`, `setNav`, `setLook`, `setScale`, `setDayBudget`, `setCutoffs` in
`app/src/state/slices/settings.ts`.

## 5. Duplicated UI (open)

`GROUPED-AUDIT.md` cites 74 hand-rolled list rows across 31 screens. Not re-counted here.

## 6. Dispositions

None. Nothing is merged, subsumed, kept or cut, so the "every row resolved" condition is not met.

## 7. Not done in this pass

- No merges, deletions or redirects, and no code changes.
- No saved-state migration (`state/shape.ts`) and no test for it.
- No changes to `GROUPS`, `blurb`, `keywords` or `taskTags`.
