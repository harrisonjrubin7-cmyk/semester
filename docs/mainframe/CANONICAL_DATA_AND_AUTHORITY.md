# Canonical data and authority

Authority is per record, not per product slogan. A polished screen can be implemented and still not be the system of record.

| Record | Canonical home | Authority today | Freshness |
| --- | --- | --- | --- |
| Course typed in the registration plan | Device catalogue via `addCourse`. `source` is `Added by hand`. Empty items and schedule. | The student. Not the registrar. | The moment it was typed. No institution clock. |
| Term-plan cart and saved schedules | Device library `semester.registration.v1` | Planning copy of an imported file | `importedAt` on the catalog. Seat counts are the file’s. |
| Official enrollment, hold, waitlist | Enrollment ledger behind the registration screen | School SIS until the module gate is on and a confirmed command returns | Unverified remotely. Locally the gate copy says off. |
| Membership and capability | Server grants. Client `Role` is only which screen is addressed. | The grant’s tenant and scope | Unverified in production |
| Audit event | Approval and audit tables described in `docs/operations` | Append-only by design | Roadmap: no production row has been confirmed by a query in this session |
| Semester invoice | Commercial billing, Stripe behind the rail adapter | Semester, in shadow | Not a student-account balance |
| Student charges | Student-account tables and UI | Institution accounts office when operated | Not operated. Separate from Semester billing |

## Rules

- Do not promote `Added by hand` to enrolled.
- Do not merge a commercial invoice and a tuition balance into one number.
- Do not store raw card numbers.
- A shared education graph, when it exists, still checks membership, tenant, capability, relationship, and consent on every read.
- Source, freshness, and authority are shown in words. Colour is not the only signal. The named-plan sentence is that word.

The operations canonical map is `docs/operations/SHARED_CONTROL_PLANE.md` §2. This page does not restate its generated matrices.
