# Pilot Data Scope Proposal

**Status: `PROPOSED` — not approved and not authorization to connect data.**

This is the narrow default scope Semester can put in front of an institution.
It becomes a pilot scope only after every bracketed field is completed and the
Semester owner and institution champion sign the approval table. An empty row
means the source is out of scope. A product flag, credential or successful
technical test is never approval.

## Pilot identity

| Field | Proposed value |
| --- | --- |
| Institution | `[NAME]` |
| Cohort | `[PROGRAM / COURSE / GROUP]` |
| Maximum participants | `[COUNT]` |
| Pilot start | `[YYYY-MM-DD]` |
| Pilot end | `[YYYY-MM-DD]` |
| Institution champion | `[NAME / ROLE]` |
| Semester implementation owner | `[NAME / ROLE]` |
| Decision date | `[YYYY-MM-DD]` |

## Default boundary

Until the source register and approval table are complete, the pilot is
limited to student-entered content and the account service needed to let that
student resume on another device. Semester may not infer permission to connect
an LMS, SIS, advising, identity, calendar or document source from a participant
invitation or from credentials being technically available.

The default excludes:

- roster, grade, submission and attendance data;
- advising notes, holds, accommodations and conduct records;
- financial-aid, billing, health, disability and basic-needs records;
- background synchronization or writeback to an institutional system;
- institutional reporting about an identifiable student;
- model training on pilot content; and
- any source, field, purpose or recipient absent from the approved register.

## Source register

Add one row per approved source. “None” is a valid pilot design.

| Source system | Exact objects and fields | Purpose | System-of-record owner | Semester steward | Direction | Freshness expectation | Retention / deletion | Classification | Approved sandbox evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `[NONE or SOURCE]` | `[OBJECT.FIELD LIST]` | `[WHY NEEDED]` | `[INSTITUTION NAME / ROLE]` | `[NAME / ROLE]` | `[READ / WRITE]` | `[SLA]` | `[RULE]` | `[T0–T6]` | `[LINK]` |

Every write direction also requires the preview-and-confirm authority path,
the rollback procedure and the named institutional decision owner. A source
with no approved sandbox evidence stays disconnected.

## Permitted recipients and uses

| Recipient | May receive | Purpose | Prohibited use |
| --- | --- | --- | --- |
| Participating student | Their own approved pilot data | Planning, studying and source verification | Treating Semester as the official record |
| Semester support | Minimum consented support view | Resolve a participant-requested issue | Browsing student content without active consent |
| Institution staff | Only the approved fields and cohort-level outputs above | Operate and evaluate the named pilot | Hidden risk scoring, discipline, grading or unrelated surveillance |
| Approved AI provider | Only fields explicitly authorized in the source register | The named, student-visible task | Training, unrelated reuse or silent transfer |

## Change rule

Any new source, field, recipient, purpose, write direction, retention period or
AI use is a scope change. It requires a new row, privacy/security review when
applicable, both approvals below and a recorded effective date before it is
enabled. The narrower approved scope wins when product capability and this
document differ.

## Exit and verification

At pilot end, Semester exports participant-owned content on request, disables
pilot access and connections, verifies retention/deletion against the approved
rows, and records unresolved exceptions. The institution verifies that any
writeback reconciles to its system of record. The pilot is not evidence of a
production integration until those checks are complete.

## Approval

| Decision | Name and role | Date | Evidence |
| --- | --- | --- | --- |
| Semester approves this exact scope | `[NAME / ROLE]` | `[YYYY-MM-DD]` | `[SIGNATURE OR DECISION LINK]` |
| Institution approves this exact scope and names each source owner | `[NAME / ROLE]` | `[YYYY-MM-DD]` | `[SIGNATURE OR DECISION LINK]` |
