# Source locker and provenance

## What exists

Semester already keeps sources in three places, and this slice does not add a
fourth:

- **Sources** screen — readings with what each is for, exported as BibTeX.
- **Study guide** — builds only from checked source excerpts and matches every
  quotation against the text (`lib/studystudio.ts`, `lib/cite.ts`).
- **Research Studio evidence** (new) — per-project entries with full citation
  metadata, source kind, and verification state.

A unified locker that merges these (with snapshots, freshness events and
derived-asset links, brief § Source Locker) needs the server tables described in
[AI-TOOLKIT-PERMISSION-MATRIX.md](AI-TOOLKIT-PERMISSION-MATRIX.md), and should build
on the single source-label work in flight in pull request #766 rather than parallel
to it.

## Source labels

`SOURCE_KINDS` in `lib/toolkit/research.ts`:

peer-reviewed · preprint (not yet peer reviewed) · institutional or government
report · book or chapter · course-provided · news · commentary · student note ·
**AI summary — navigation only, never citable** · unverified.

## Verified means opened

`verify()` refuses unless **all** hold:

1. The student ticked *I opened and read the original source myself*.
2. The kind is citable (not an AI summary, not *unverified*).
3. Authors, a four-digit year (or `n.d.`) and a title are present.
4. A quotation either appears in the pasted passage (strict match via `flatten`
   from `lib/cite.ts`) or carries a page or location.
5. The source is not excluded in screening.

Editing any of those fields afterwards clears `verified` (`edit()`), and reading
stored data re-checks it, so a hand-edited file cannot carry a verification its
fields do not earn.

## Freshness and unavailability

States the UI shows instead of an answer: *Policy unavailable — ask your
instructor*, *Insufficient evidence*, *Not verified*, *Not built yet*. A per-source
*outdated* state needs a capture date and a freshness check against the original,
which requires the server phase.
