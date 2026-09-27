# SAML, OIDC, SCIM and LTI compared

Which protocol does which job, and which of them Semester speaks today. See
[INSTITUTIONAL-SSO-ARCHITECTURE.md](INSTITUTIONAL-SSO-ARCHITECTURE.md) for where
each lives in the code.

| Protocol | Job | Starts at | Semester receives | In Semester |
| --- | --- | --- | --- | --- |
| SAML 2.0 | Enterprise web sign-in | Campus IdP | Signed assertion: subject, email, mapped attributes | **BUILT** via Supabase Auth SSO |
| OpenID Connect | Modern sign-in | Campus IdP | ID token after an authorization-code exchange | **NOT BUILT** |
| SCIM 2.0 | Account lifecycle | IdP / directory | Create, replace, patch, deactivate; group membership | **BUILT** |
| LTI 1.3 | Course-context launch | LMS | Signed launch: issuer, deployment, context, resource, roles | **BUILT** |
| LTI Advantage: Deep Linking | Instructor places an activity | LMS | Deep-linking request; Semester returns a signed item | **BUILT** |
| LTI Advantage: AGS | Grade passback | Semester → LMS | Line item captured at launch; score posted on request | **BUILT**, needs `LTI_PRIVATE_KEY`; gated per school by `lti_passback_decision` |
| LTI Advantage: NRPS | Course roster | LMS | Names and roles | **NOT BUILT**, on purpose (roster is out of scope) |

## Which to use

- **SAML + SCIM** is the institution-wide bundle and the one Semester supports
  end to end. SCIM creates the membership first. The first SAML sign-in binds to
  it (`bind_institution_sso_membership`). SCIM `active: false` ends it.
- **SAML without SCIM** (just-in-time only) is **not** supported. A valid SAML
  sign-in with no SCIM-provisioned membership is refused
  (`missing-membership` in `membership.ts`). That is deliberate: without a
  lifecycle feed nothing would ever deprovision the account.
- **LTI** adds course context. It is not a lifecycle mechanism and never creates
  an institutional membership.
- **OIDC + SCIM** would be the modern equivalent of SAML + SCIM. See
  [OIDC-IMPLEMENTATION-RUNBOOK.md](OIDC-IMPLEMENTATION-RUNBOOK.md) for what it
  would take.

## Plan packaging

What a plan can include. This is not a statement of what is sold today.

| Plan | SSO | SCIM | LTI 1.3 | Lifecycle |
| --- | --- | --- | --- | --- |
| Department Starter | Optional | No | Optional | Manual |
| Department Growth | Optional | Optional | Yes | Scoped SCIM |
| Campus Core | Yes | Yes | Yes | SCIM lifecycle |
| Campus Academic | Yes | Yes | Yes | Full lifecycle |
| University OS | Yes | Yes | Yes | Full lifecycle, group mappings, audit exports |
| System / Consortium | Yes, per campus | Yes | Yes | Per-campus policies |

Where a plan reads "SSO: Yes, SCIM: Optional" in the source command, this table
says SCIM: Yes, because SSO without SCIM is refused, as above.
