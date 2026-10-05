# Daily strategy support and standards activation follow-through

The 21 supplied PDFs and six screenshots are requirement sources. Their
filenames, page counts and hashes are recorded in
`2026-10-01-supplied-requirements.json`. None is evidence that a capability is
operational. This change closes two implementation gaps; it does not close the
entire institutional-readiness programme.

## Implemented in this change

- Daily operating rhythm on Today, including a fresh empty workspace and both
  home layouts. One meaningful outcome, definition of done, fixed commitments,
  Daily Three, first small action, time box, if–then fallback and minimum progress.
- Student-selected context packet and eight self-advocacy draft types. Drafts
  are displayed for the student to copy and review, never sent automatically.
- Midday repair, editable progress state, end-of-day close and ten support-audit
  questions with Not yet / Partial / Ready states. No student performance score,
  diagnosis, attendance metric or inferred academic risk.
- Validated account-scoped private device storage, pause/resume, historical dates,
  explicit export, recovery for corrupt storage and confirmed deletion. Workspace
  backups include these plans and private reflections with an explicit disclosure.
  No network sync, AI context or automatic advisor sharing is added.
- Searchable, filterable and exportable 1EdTech–NIST Rev. 5 engineering crosswalk
  in the authorized Operations Console's Evidence view. Eight mappings cover
  Core launch, Deep Linking, NRPS, AGS, identity, canonical data, optional consent
  and daily planning. Every mapping names its implementation, verification files,
  owner to assign, purpose, data boundary and remaining activation evidence.

## Standards interpretation

The mapping is an engineering interpretation, not an independent assessment,
certification or assertion of equivalency. Institutions select their control
baseline. Several supplied documents use Rev. 4 Appendix J family vocabulary
alongside Rev. 5 controls. The implemented view uses actual Rev. 5 control IDs,
including PT-2, PT-3, PT-4, PT-5, SI-12 and SI-18, rather than representing
AR/AP/DM/IP/SE/TR/UL as Rev. 5 families.

Primary references:

- https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final
- https://pages.nist.gov/oscal-tools/demos/csx/baseline-matrix/
- https://www.1edtech.org/standards/lti
- https://standards.1edtech.org/lti/guides/migration/migration-guide

## Production observations and remaining gates

The committed frontend configuration targets `lzrqvlugnawcgywkhqlz`. A read-only
production aggregate query during this work found zero records in `lti_platform`,
`tenant_sso_policy` and `integration_connections`. This proves absence of configured
records in those registries, not absence of deployed function code. No customer
record contents or secrets were retrieved.

| Area | Remaining requirement before green/active |
| --- | --- |
| Institutional LTI Core | Named institution, issuer, client ID, deployment ID, approved endpoints and redirects; actual launch and negative security UAT |
| Deep Linking | Approved faculty workflow and actual placements/course-copy tests |
| NRPS | Approved purpose and fields; add/drop, cache-expiry and revocation evidence |
| AGS | Explicit institutional write authority, activity enablement, scope, reconciliation/correction and rollback |
| SSO / SCIM | Real IdP metadata and provisioning configuration; MFA, role-change and deprovision verification |
| Registrar / Edu-API feeds | Source approval, production adapter configuration and source reconciliation |
| Google / Microsoft / Zoom | Real provider client registrations, proxy configuration and consent/sync/revoke evidence |
| Paid plans | Approved live processor setup, prices and live checkout/webhook/cancel/refund evidence |
| Export / account deletion | Authenticated designated-account verification of full server data/files and receipt |
| Browser accessibility | Actual browser checks plus human keyboard, zoom and assistive-technology evaluation |
| Recovery / monitoring | Real backup restore and timed rollback; exercised alerts to a named operator |
| 24/7 support | Staffed rota and exercised escalation, not an interface setting |
| Contracts / procurement | Actual sponsor, approved data scope, counsel review, executed order/DPA/SLA and reviewed questionnaires |
| External certification | Independent assessment/report or certificate for the defined scope |
| Native LMS / credentials / global phases | Complete contracted end-to-end workflows, governed issuance and real migration/reconciliation; existing planning records are not these release outcomes |

The details in `screenshot-readiness-2026-10-01.md` continue to apply. No production
identity, grade-writing scope, provider credential, certification, staff member or
agreement is invented or activated by this change. Public badges for these areas
must remain limited until the corresponding evidence exists.

## Verification

- Daily implementation and backup-account isolation checks passed.
- Crosswalk tests check every implementation/verification path exists, combine
  filters, preserve activation limitations and export only the shown mappings.
- Console tests continue to exercise the authorization gate.
- The first full suite after daily implementation passed 19,329 tests, with 51
  skips; the shuffled suite passed 19,333 tests with 51 skips, seed 1790870279011.
- Production type/build, university gateway typecheck and lint passed.
  Existing allowed lint warnings are not represented as zero warnings.
- Public-production smoke could not reach frontend HTML from this environment.
  This is a verification limitation, not a demonstrated production outage.
- Chromium was unavailable. A download attempt returned an invalid archive,
  so no browser visual inspection or WCAG conformance result is claimed.

Release verification must name the deployed commit and successful Pages run.
A merged PR alone is not evidence that the code is live.
