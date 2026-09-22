# Privacy Readiness

**Status: `IN_PROGRESS`**

## Exists

**Corrected.** This document first said export and deletion did not exist.
They do, and had before it was written:

| Flow | Where |
| --- | --- |
| Export your data | `lib/export.ts` (+ `exportqa.ts`) |
| Erase from this device | `lib/erase.ts` |
| Delete the account's cloud copy | `cloud.ts deleteEverything` |
| The disclosure itself | `CLAIMS` in `lib/privacy.ts`, written **as data** so `privacy.test.ts` fails when it drifts from the code |

That last one is the part worth keeping: a privacy page that drifts from what
the code does is not merely stale, it is a false statement somebody relied on.


- `RETENTION.md` at the repository root
- `app/src/lib/privacy.test.ts` guards some visibility behaviour
- Server-side enforcement via RLS rather than client-side hiding — the correct
  architecture, already in place
- The gateway journal is **encrypted at rest** (AES-256-GCM), on the stated
  reasoning that a review body is "a withdrawal, a payment, an appeal"

## Missing

- **Data classification.** No field is labelled `PUBLIC` / `CAMPUS_VISIBLE` /
  `CONNECTIONS_ONLY` / `PRIVATE` / `ADMIN_RESTRICTED` / `SENSITIVE`. `CLAIMS`
  in `lib/privacy.ts` is the nearest thing and is per-*statement*, not
  per-field.
- **Data minimisation review.** No per-field record of why it exists, who sees
  it, retention, deletion behaviour, integration source.
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
