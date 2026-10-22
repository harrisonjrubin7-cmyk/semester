# Provenance and trust

Source: `docs/TRUST-CUES-AND-SOURCE-PRESENTATION.md`, `app/src/lib/where.ts`, `lib/status.ts`, `lib/source.ts`.

## The ladder (strongest first)
| Rank | Key | Word | Sentence |
| --- | --- | --- | --- |
| 0 | official | Official / Institution verified | Your institution's own record, read from its system. |
| 1 | connected | Connected | From a calendar or account you connected, checked recently. |
| 2 | made | Made here | The app built this from sources you gave it (rule-based extraction). |
| 3 | personal (yours) | Yours / Student entered | You entered this yourself. Nothing has checked it. |
| 4 | sample | Sample | Shipped as a demonstration. Not your semester. |
| 5 | stale | Out of date | From a connection not checked lately. It may have moved. |

Display-only kinds: **AI-assisted, source-linked** (a model's draft), **Estimated** (Semester's arithmetic), **Needs review**, **External**.

- `stale` ranks below `yours` on purpose: an unchecked copy of something that may have moved is worth less than a guess that knows it is a guess.
- `made` ≠ `ai`. An extraction can misread; a draft can be wrong while sounding right. Different glyphs (○ vs ✦), different sentences.
- Estimates and AI are styled to be **noticed** (amber/violet wash) — the opposite of "official looks louder", because they are what students over-trust.
- Never claim `official` for anything the institution did not send.

## Where cues go
1. The eyebrow or state row of an ObjectCard / ContextBar — never louder than the primary action.
2. A SectionLabel aside (`<SourceBadge>` beside "Released grades").
3. The **Source & details** sheet: Origin · Freshness · Used in · Who can see this · Limitations · Report incorrect information.
4. Charts: by pattern (solid / outline / hatched / dotted), plus a source line and "Illustrative demo data" when applicable.

## Rules for new work
1. Say a state through `SOURCES`/`STATUSES` in `components/trust/vocabulary.js`; never hand-type "Official" or "Synced".
2. Anything with a source gets a Source & details route.
3. Anything a model drafted is `ai`, lists its sources and limitations, and is editable before it is kept.
4. Freshness is written as "Updated 3 days ago", or "Update time not recorded" — never "just now" for an unknown time.
