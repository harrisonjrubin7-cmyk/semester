# Semester consent and preference management specification — controlled draft

- **Status:** `PARTIAL / SCOPE-DEPENDENT`
- **Owner:** Privacy/Product owner with Security, Communications, and customer authority
- **Evidence date:** 2026-10-03

## Purpose and rules

This specification separates consent from notices, contracts, legitimate institutional instructions, required service/security messages, course policy, and other approved authority. Consent must be specific, informed, freely given where required, unbundled, accessible, affirmative, versioned, purpose/channel/provider scoped, age/authority appropriate, easy to withdraw, and enforced downstream. No consent is inferred from silence, preselection, product use, institutional contact data, or another purpose.

## Preference record

| Field | Required value |
| --- | --- |
| subject/account/tenant and verified authority | `[TBD]` |
| purpose, data, action, recipients/providers | `[TBD]` |
| notice/text/version/language/context | `[TBD]` |
| affirmative action, timestamp/time zone and source | `[TBD]` |
| age/guardian/institution/jurisdiction decision | `[TBD]` |
| expiry/renewal/withdrawal/suppression | `[TBD]` |
| downstream enforcement and evidence | `[TBD]` |

## Control map

| Scope | Code/config evidence | Operational evidence | Owner | Missing test/proof |
| --- | --- | --- | --- | --- |
| student/institution sharing | consent and FERPA workflow sources/tests | no named-institution acceptance | Privacy/Product | target grant/withdraw/audit exercise |
| course/AI policy | course/tool policy and disclosure controls | provider/use/legal approval incomplete | AI/Customer | exact feature/provider UAT |
| marketing communications | draft consent and suppression controls | no approved campaign/vendor operation | Communications/Privacy | opt-in/withdraw/suppression test |
| storage/cookies | storage inventories and fail-closed spec | deployed network/storage verification open | Privacy/Engineering | target pre/post-choice capture |
| testimonial/publicity | draft permission controls | no executed permission/outcome evidence | Communications/Legal | rights-holder workflow |

## Claim ceiling and activation blockers

Permitted: “Semester has tested selected consent and policy controls and draft requirements for preference evidence.” Prohibited: universal valid consent, all preferences enforced, institution authority, minor/guardian sufficiency, compliant marketing, or approved AI/data use. Blocks: qualified basis/applicability review, exact purposes/providers/data, age/authority logic, accessible interfaces, version/evidence store, withdrawal/suppression propagation, target tests, customer approval, retention, monitoring, exception handling, and owner/backups.
