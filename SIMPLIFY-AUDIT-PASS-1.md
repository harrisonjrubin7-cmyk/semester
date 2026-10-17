# SIMPLIFY-AUDIT

Status: **Step 1 partial.** Counts below come from grep over `app/src` on branch `claude/brave-feynman-gr2zxm` at `1567fb76`. Rows marked *open* have not been read through to state and render, so no merge is decided for them. No code changed in this audit.

## 1. Destination count

| Measure | Count | Command |
| --- | --- | --- |
| `screen: '…'` literals in `app/src/lib/nav.ts` | 64 | `grep -o "screen: '[a-z_-]*'" app/src/lib/nav.ts` |
| Brief's stated count | 59 | — |

The brief says 59. The literal count is 64. Some literals may be non-destination references, so the true count is open until every `Destination` row is listed and de-duplicated. The brief's number is not used as a baseline.

## 2. Premises that do not match the code

These names are in the brief as screens. They are not `Screen` union members in `app/src/lib/types.ts` (line 696 onward), so they are not destinations.

| Brief name | Where it actually lives | Verdict |
| --- | --- | --- |
| `ahead` (The week ahead) | Tab id `ahead` in `screens/Courses.tsx:355`; Degree scenarios tab `ahead` in `screens/Degree.tsx:113` | Not a screen. Two unrelated tabs share the id. Recorded as a naming collision. |
| `weekly` (Weekly report) | Label "Weekly digest" in `screens/Hub.tsx:218` | Not a destination. Open. |
| `tonight` | Comment in `lib/types.ts:1047`: Study screen's "tonight" plan | Not a destination. A plan inside `study`. |
| `standing` | `standing(d, now)` function in `screens/Today.tsx:1448`; `lib/standing.ts` | Not a destination. Function. |
| `everything` | Sheet paste mode in `lib/sheetedit.ts:985`; `data/ecosystem/screens.json:695` | Not a destination in nav. Its "never opened" tracking was not found. Open. |
| `chat` | Call panel in `screens/call/Stage.tsx:174`; assistant chat in `ai/Chat.tsx` | Not a destination. Open. |
| `grades` | `CoursesTab` value `'grades'` in `lib/types.ts:862` | A tab of `courses`, not a screen. |

Real destination ids confirmed in `nav.ts` include `home`, `brief`, `calendar`, `ask`, `mine`, `me`, `help`, `data`, `import`, `edit`, `announce`, `degree`, `courses`, `study`.

## 3. Overlap clusters

Each cluster is marked with what has been verified.

- **"What is due and when"** (`home`, `brief`, `mine`, plus the non-destinations above). *Open.* `home` and `brief` are both destinations and need a state-read comparison before any verdict.
- **Calendar grains vs week views.** *Open.* `calendar` is one destination. Its grains are not counted yet.
- **Assistant surfaces** (`ask`, `ai/Assistant.tsx`, `ai/Chat.tsx`). *Recorded only.* `/ask-tab` owns the fix, per the brief.
- **Where you stand** (`grades`, `standing`, `degree`, `proof`). *Open.* `proof` is a real id. `grades` is a Courses tab, so the brief's four-way overlap is two places, not four, unless `proof` and the Courses tab read the same state.
- **Five ways to find a screen** (`everything`, `me`, `springboard`, `help`, search). *Open.* `springboard` is in the `Screen` union (`types.ts:957`); `everything` is not a destination id.
- **Five ways to change course data** (`import`, `edit`, `update`, `announce`, `check`). *Open.* `check` was not found as a destination id; `update` is one.

## 4. Duplicated controls

The grep for `setTabs|setNav|setLook|setScale|setDayBudget|setCutoffs` matches 51 files, including tests and type declarations. That is not a dispatch count. A dispatch-only count (screens that call the setter) has not been produced. *Open.*

## 5. Duplicated UI

Not re-counted. The brief asks for hand-rolled list rows, headers, chip rows and empty states. The `GROUPED-AUDIT.md` figure of 74 rows across 31 screens has not been verified against the current tree. *Open.*

## 6. Routes

Not counted. `dispatch({ type: 'go'` appears 322 times across 154 files, including tests and reducers. A per-destination arrival count has not been produced. *Open.*

## Verdicts so far

| Item | Verdict | Reason |
| --- | --- | --- |
| Brief's 59-screen count | Corrected to 64 literals; true count open | See §1 |
| `ahead` / `tonight` / `standing` / `everything` / `chat` / `grades` / `weekly` as screens | Not destinations | See §2; their merges, if any, are inside other screens |
| Any merge | None decided | No row above has both a state read and a render compared |

## Next executable steps

1. List every `Destination` row in `nav.ts` by id, and resolve the 64-vs-59 gap.
2. For each open cluster, record the state each screen reads (grep the `state.` selectors inside each screen file) and the screen it renders.
3. Produce the dispatch-only setter table and the arrival table.
