# Literature synthesis and citation

## Evidence matrix schema

`Evidence` in `lib/toolkit/research.ts` — every field from the brief:

study (title, venue, DOI, link) · authors · year · research question · design ·
sample / setting · n · variables / intervention · measures · analysis method · key
finding · effect size / uncertainty · limitations · conflict of interest · relevance
to my claim · direct quotation · page / location · pasted passage (for checking the
quotation) · screening decision and reason · *original opened* · *verified*.

## Safeguards, and where each lives

| Safeguard (brief) | Enforcement |
| --- | --- |
| AI summaries are never citable | `citable()`; `verify()` refuses; RIS and BibTeX export skip them |
| Verify against the original before *verified* | `blockers()`: *original opened* must be ticked |
| Distinguish source types | `SOURCE_KINDS`, shown on every entry |
| No correlation → causation | `audit()` → *Check wording*; Data Studio `interpretationGaps()` |
| Highlight small samples, conflicts, contradictions | `cautions()` for the first two; contradiction mapping not built |
| Never invent citations, quotations, pages | Nothing is generated; missing fields print as `[… missing]`; quotations are matched against pasted text |
| Respect licensing | Only the passage the student pastes is kept, on their device |

## Export

- **Styles:** APA, MLA, Chicago author-date — formatted from exactly what was
  entered.
- **Reference managers:** RIS (Zotero, EndNote, Mendeley) and BibTeX. Unverified
  entries carry a note saying so, in the file itself.
- The student confirms before submission: references are shown with a *Not verified*
  tag until they are.
