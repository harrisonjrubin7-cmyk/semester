# Active learning engine

Semester already has most of this, and the toolkit links to it rather than
rebuilding it:

| Brief capability | Existing | Where |
| --- | --- | --- |
| Flashcards, spaced repetition | Yes — FSRS scheduling (`lib/fsrs.ts`, `lib/review.ts`) | Study |
| Interleaved practice | Yes (`lib/interleave.ts`) | Study → Revise |
| Practice question sets, mock exam | Yes | Practice paper |
| Study guide from approved sources, quotations matched | Yes (`lib/studystudio.ts`) | Study → Create study guide |
| Confidence / readiness | Yes — shown as a *range*, never a grade (`lib/learning-loop.ts`) | Study guide, behind `VITE_ADAPTIVE_LEARNING` |
| Error log | Toolkit stage in problem-set and exam-prep templates | Toolkit → Assignments |
| Teach-back | — not built | — |
| Mock-exam generator from source material | Practice paper, from prepared course material | Practice paper |

## Rules that hold across all of it

- Practice data is never a risk, ability, admissions, aid, employment or advising
  score. Nothing in the toolkit reads practice data at all.
- Student-generated practice is private by default and deletable.
- The toolkit's recommendation engine does **not** use practice results — "weak
  topics" in the exam-prep template are the student's own list from their own
  diagnostic.
