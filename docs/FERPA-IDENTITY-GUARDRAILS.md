# FERPA identity guardrails

What each identity flow may carry, and what enforces it. This is an engineering
document, not legal advice. The institution's privacy office sets retention
periods and approves disclosures.

## Minimum necessary, per flow

| Flow | May carry | Enforced by |
| --- | --- | --- |
| SAML | Stable subject, email, name, affiliation, groups, campus, department | `attribute_mapping` constraint ([claim mapping](SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md)) |
| SCIM | `userName`, `externalId`, `displayName`, `active`, group membership | `parseScimUser` / `parseScimGroup` read only these fields; everything else is dropped |
| LTI | Opaque subject, issuer, deployment, context, resource, role | `checkLaunch` output shape; name and email go only to display metadata |

## Never obtained through a generic identity flow

Grades, GPA, transcripts. Financial aid. Health, disability, counseling and
accommodations. Conduct records. Immigration records. Government identifiers.
Full rosters and course enrollments. Student submissions. Attendance and
location history. Private messages.

For SAML this is a database constraint. For SCIM it holds because the parser has
nowhere to put such a field. For LTI it holds because NRPS is not implemented and
AGS only *sends* a score Semester already has.

## Lifecycle

- Deprovisioning removes institutional access and clears roles. It does **not**
  delete the account or student-created work.
- Provisioning audit events are immutable and hold identifiers, never content or
  secrets.
- Retention periods are in [RETENTION.md](../RETENTION.md). Where it says
  "until the school is removed", the institution's privacy review must set a
  time-based period before production if one is required.

## Redisclosure

Institutional identity data is readable only by the person it describes and by
holders of `audit:read` in that tenant (RLS on every identity table). It is not
used for advertising, profiling or unapproved AI processing, and it is not
exposed to peers.
