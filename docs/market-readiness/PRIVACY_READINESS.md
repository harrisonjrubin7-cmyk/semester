# Privacy Readiness

**Status: `IN_PROGRESS`**

## Exists

- `RETENTION.md` at the repository root
- `app/src/lib/privacy.test.ts` guards some visibility behaviour
- Server-side enforcement via RLS rather than client-side hiding — the correct
  architecture, already in place
- The gateway journal is **encrypted at rest** (AES-256-GCM), on the stated
  reasoning that a review body is "a withdrawal, a payment, an appeal"

## Missing

- **Data classification.** No field is labelled `PUBLIC` / `CAMPUS_VISIBLE` /
  `CONNECTIONS_ONLY` / `PRIVATE` / `ADMIN_RESTRICTED` / `SENSITIVE`.
- **Data minimisation review.** No per-field record of why it exists, who sees
  it, retention, deletion behaviour, integration source.
- **Export and deletion workflows.** Neither exists as a user-facing flow.
- **Integration disconnect / permission revocation** surfaces.

## FERPA posture — read this before writing anything university-facing

Semester may hold data that becomes part of an education record *depending on
how an institution uses it*. Grades imported from an LMS, advising notes and
degree-audit results are the obvious candidates.

**Nothing in this repository constitutes a compliance claim, and no document
produced from it should say "FERPA compliant".** Technical controls are
necessary and not sufficient; compliance is a determination an institution's
counsel makes about a deployment, not a property of code.

What we can honestly offer a university's legal and security teams:

- Which data Semester holds and where it came from
- Which roles can reach it, enforced server-side
- What is retained and for how long
- How deletion behaves, including where institutional retention overrides it

That document does not exist yet and is the deliverable this area needs.

## Next

Data classification is the prerequisite for everything else here: export,
deletion and the FERPA discussion all need to name fields by class.
