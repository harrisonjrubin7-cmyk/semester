# SSO claim mapping and data minimization

Status: **BUILT.** Rule: `packages/institution/src/identity.ts`. Constraint:
`supabase/migrations/20260927120000_identity_claim_minimization.sql`. Tests:
`identity.test.ts` (which also holds the two lists equal) and the claim block in
`supabase/identity-provisioning.check.sql`.

## The mapping

`institution_identity_provider.attribute_mapping` is
`{ "<Semester claim>": "<IdP attribute name>" }`. The database refuses a row
unless:

1. every key is one of the allowed claims below;
2. every value is a string of 1–300 characters; and
3. no value, lowercased with separators removed, contains a prohibited fragment.

| Semester claim | Use | Never used for |
| --- | --- | --- |
| `subject` | Durable institutional link | A public identifier |
| `email` | Discovery, the SCIM `userName` match, contact | An immutable key, or a personal-account merge |
| `display_name`, `given_name`, `family_name` | Presentation default the student may change | Proof of legal identity, or a peer-visible field without consent |
| `affiliation` | Candidate membership type | Access by itself |
| `groups` | Candidate role input, through `scim_group_mapping` | A direct grant |
| `campus` | Which campus's services show | Location tracking |
| `department` | Optional scope, if approved | Inference or targeting |

## Prohibited, by category

Grades and GPA (`gpa`, `grade`, `transcript`). Financial aid (`financialaid`,
`fafsa`). Health, disability and counseling (`health`, `medical`, `disability`,
`accommodation`, `counsel`). Conduct (`conduct`, `disciplin`). Immigration
(`immigration`, `visa`, `citizenship`). Government identifiers (`ssn`,
`socialsecurity`, `dateofbirth`, `birthdate`). Rosters and enrollments
(`roster`, `enrollment`). Submissions (`submission`). Attendance and location
(`attendance`, `geolocation`, `locationhistory`). Private messages
(`privatemessage`).

## What the rule can and cannot see

The **allowlist is the guard.** Whatever an IdP sends can only land in one of
nine claims, none of which holds a record. The **fragment list is the
explanation.** It catches an attribute *named* `cumulativeGPA` and says which
FERPA category it hit. It cannot recognise a prohibited attribute sent under an
opaque OID. That case is still confined to an allowed claim, and it is why a
person reviews every mapping before a provider is `authorized`.

It fails closed on purpose in one known case: `ssn` also matches `className`.
The administrator maps a different attribute. A false pass would keep a Social
Security number.

## At sign-in, and the gap

Today two things minimize a SAML sign-in, and neither is this column:

1. **The campus's attribute release policy.** Ask the IdP to release only the
   minimum attributes, since what is never sent cannot be kept.
2. **Supabase Auth's own SSO attribute mapping** (`supabase sso add
   --attribute-mapping-file`). Supabase Auth, not Semester, receives the
   assertion and keeps the attributes that mapping names in the user's identity
   data.

`minimizeClaims(assertion, mapping)` is the function a Semester-side sign-in
path should use. It keeps only mapped claims, strings of at most 300
characters, and at most 200 `groups`. **Nothing calls it yet, and nothing keeps
Supabase's mapping file equal to `attribute_mapping`.** Until that sync exists,
write the Supabase mapping from the approved `attribute_mapping` row by hand,
and check it in acceptance.

## Nothing here grants access

`affiliation` and `groups` are inputs to an administrator-approved mapping. The
resulting role is checked again by `private.has_capability` on every row read.
