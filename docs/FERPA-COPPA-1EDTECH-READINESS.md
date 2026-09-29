# FERPA, COPPA and 1EdTech Readiness Register

**Status: `IN_PROGRESS`.** This is a register of what an institution's
privacy office, counsel and LMS team will ask, and what this repository can
show today. Launch-readiness Phase 4. It sits beside
[`market-readiness/HECVAT_READINESS.md`](market-readiness/HECVAT_READINESS.md),
which covers security, accessibility (VPAT/ACR, WCAG) and AI. Those rows are
not repeated here.

**Nothing here claims compliance with FERPA or COPPA, or 1EdTech
certification.** FERPA and COPPA are laws, and whether an arrangement meets
them is a judgment for the institution's counsel. 1EdTech certification is
granted by 1EdTech. Each row names one thing a reviewer will ask about, what
the tree can show, and what would move it forward.

## The rules this file is held to

`app/src/lib/trust/ferpa-coppa-readiness.test.ts` parses the table and fails
when:

- a status is outside the five-word vocabulary shared with the HECVAT
  register;
- a row cites a path (in backticks) that does not exist;
- a row is `READY` or `TESTING` with no existing path cited;
- a row is not `READY` and says nothing about what would move it;
- a row whose evidence can only come from outside this repository (a signed
  DPA, counsel's review, a 1EdTech certification or TrustEd Apps review, a
  parental-consent mechanism counsel has approved) is above `IN_PROGRESS`
  without a file under `docs/evidence/`.

Raise a status by changing its evidence in the same commit.

## Register

| ID | Area | Control | Status | Evidence | What moves it |
| --- | --- | --- | --- | --- | --- |
| FERPA-1 | FERPA | School-official terms in a signed agreement (direct control, legitimate educational interest) | `NOT_STARTED` | — | Counsel drafts the DPA; each signed copy goes under `docs/evidence/`. Same as HECVAT PRIV-4 |
| FERPA-2 | FERPA | Data used only for the institution's purposes: no sale, no advertising, no risk scoring for others to read | `IN_PROGRESS` | `app/src/lib/privacy.ts`, `docs/operating-model/TRUST-BRAND-AND-LEGAL.md` | State it in the terms and the DPA; today it is policy and code, not a contractual promise |
| FERPA-3 | FERPA | Minimum necessary: no roster, grades or enrollments requested through identity or LMS flows | `TESTING` | `app/src/lib/ltikey.test.ts` | Merge the claim-mapping constraint in #803 and cite its check suite |
| FERPA-4 | FERPA | A record of who accessed a student's records | `READY` | `supabase/access.check.sql`, `supabase/support-access.check.sql`, `supabase/help-requests.check.sql` | — |
| FERPA-5 | FERPA | No redisclosure: shared data reaches only the recipient the student named, for the window they chose | `READY` | `supabase/support-access.check.sql`, `supabase/family.check.sql` | — |
| FERPA-6 | FERPA | The student can inspect, export and delete their own data | `READY` | `app/src/lib/export.ts`, `supabase/deletion.check.sql` | — |
| FERPA-7 | FERPA | Return or destruction of institutional data when the agreement ends | `IN_PROGRESS` | `RETENTION.md` | Write the institutional offboarding runbook (the export, the purge, certificate of destruction) and exercise it on a sandbox tenant |
| FERPA-8 | FERPA | One institution's records isolated from another's | `IN_PROGRESS` | `supabase/tenancy.check.sql` | Extend the cross-tenant checks to every legacy table. Same as HECVAT TEN-1 |
| FERPA-9 | FERPA | Education records never routed to a consumer AI model | `TESTING` | `supabase/integration-control-plane.check.sql`, `app/src/lib/integration/classification.test.ts` | Exercise the classification floor against a pilot tenant's real sources |
| FERPA-10 | FERPA | Notice to the institution after an incident involving its students' records | `IN_PROGRESS` | `docs/market-readiness/INCIDENT_RESPONSE.md` | Name the owner and the institution's contact, then run one tabletop exercise |
| FERPA-11 | FERPA | Subprocessors disclosed | `TESTING` | `docs/SUBPROCESSORS.md`, `app/src/lib/trust/subprocessors.ts` | Counsel's review, each subprocessor's terms on file, hosting regions stated |
| COPPA-1 | COPPA | A stated minimum age, and the service not directed to children under 13 | `TESTING` | `supabase/minimum-age.check.sql` | The owner set the minimum at 13 (D-139): sign-up asks for a date of birth and the database refuses anyone under 13; an account made another way is asked once. The terms draft says 13. Counsel has not reviewed it, and a stated age is self-reported |
| COPPA-2 | COPPA | No behavioural advertising or third-party tracking | `TESTING` | `app/index.html`, `app/src/lib/csp.test.ts` | The content-security policy allows scripts from Semester's own origin only, and no advertising host can be reached. Add the statement to the privacy disclosure and the terms |
| COPPA-3 | COPPA | Minors in dual enrollment identified by the institution, not guessed | `IN_PROGRESS` | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` | The `dual_enrollment_student` role exists; write which features, sponsorship and data flows are off for it, with counsel |
| COPPA-4 | COPPA | Counsel's review of any context where a user may be a minor | `NOT_STARTED` | — | A review memo filed under `docs/evidence/` before any dual-enrollment cohort |
| COPPA-5 | COPPA | Parental consent, only where law and the institution require it | `NOT_STARTED` | — | Not built, deliberately. Build only after COPPA-4 says it is needed, and with the mechanism counsel approves |
| EDT-1 | 1EdTech | LTI 1.3 Core launch with signed-token verification and a single-use nonce | `TESTING` | `supabase/lti.check.sql`, `supabase/functions/lti/index.ts` | A first launch from a real institution's LMS |
| EDT-2 | 1EdTech | LTI Deep Linking | `TESTING` | `supabase/functions/_shared/ltideeplink.ts` | An instructor placing Semester content through a real LMS's deep-linking picker |
| EDT-3 | 1EdTech | LTI Assignment and Grade Services, gated per registration | `TESTING` | `supabase/ltiags.check.sql`, `supabase/lti-integration.check.sql` | Bind every live registration to its school; unbound registrations still answer `allowed-unbound` |
| EDT-4 | 1EdTech | Names and Roles (roster) deliberately not requested | `READY` | `app/src/lib/ltikey.test.ts` | — |
| EDT-5 | 1EdTech | 1EdTech LTI Advantage certification | `NOT_STARTED` | — | Apply once one institution's launch is live. The certificate goes under `docs/evidence/` |
| EDT-6 | 1EdTech | OneRoster | `NOT_STARTED` | — | Not planned for a first pilot; the pilot runs without rosters by design |
| EDT-7 | 1EdTech | TrustEd Apps data-privacy review | `NOT_STARTED` | — | Pursue after FERPA-1 and COPPA-1 exist; the result goes under `docs/evidence/` |
| EDT-8 | 1EdTech | SAML single sign-on with lifecycle provisioning | `TESTING` | `supabase/identity-provisioning.check.sql` | One exchange with a real IdP. Same as HECVAT IAM-1 |

## What is honestly true today

- **Strongest:** record of access, no redisclosure, student export and
  deletion, no roster collection. Each is proven by a database check that
  runs in CI.
- **Built but not yet exercised with a real institution:** SSO, LTI, AI
  classification, the subprocessor register.
- **Missing, and the first to fix before any pilot:** a signed agreement with
  school-official terms, terms of service with a minimum age, and a written
  position on minors in dual enrollment.
