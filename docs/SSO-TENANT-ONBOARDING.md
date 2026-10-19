# SSO tenant onboarding

The order a new institution goes through. Each step links to where it is
specified. Vanderbilt's filled-in version is
[`docs/vanderbilt/`](vanderbilt/).

## 1. Before anything technical

- [ ] Contract, DPA and security review recorded, outside this repository
- [ ] Named owners: campus identity, campus directory/SCIM, campus LMS (if LTI),
      Semester security, Semester deployment, pilot owner
- [ ] Secure channel agreed for metadata, certificates and credentials

## 2. Tenant

- [ ] `schools` row with the institution's email domains
- [ ] Plan and modules chosen; entitlement inputs recorded
      ([ENTITLEMENT-RESOLUTION.md](ENTITLEMENT-RESOLUTION.md))
- [ ] Data classification and course-policy defaults agreed

## 3. Identity

- [ ] SAML IdP registered in Supabase Auth
      ([SAML runbook](SAML-IMPLEMENTATION-RUNBOOK.md))
- [ ] `institution_identity_provider` row, `pending`, with minimal
      `attribute_mapping` ([claim mapping](SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md))
- [ ] SCIM credential issued once, vaulted, hash stored
      ([SCIM](SCIM-LIFECYCLE-MANAGEMENT.md))
- [ ] Group → role mappings approved by a tenant administrator

## 4. LMS (optional)

- [ ] `lti_platform` row per deployment, with `tenant_id` set to this school
      ([LTI runbook](LTI-1.3-LAUNCH-RUNBOOK.md))
- [ ] AGS left off unless the institution approves grade passback

## 5. Acceptance and authorization

- [ ] Controlled test accounts: student, faculty, staff/admin
- [ ] Every case in the acceptance checklist passes in staging, including
      deprovisioning, unknown group and tenant mismatch
- [ ] Provider set to `authorized` only after sign-off

## Safe failure states

| Situation | What the person sees |
| --- | --- |
| Domain matches no authorized provider | No campus button. Ordinary sign-in only |
| Valid SSO, no active membership | Signed in with no institutional access. The gateway answers 403 "no verified access" |
| Membership suspended or deprovisioned | Same, from the next request. No data is deleted |
| Same, arriving from an LMS course link (linked account) | Refused with a 403 page, "Your school access is not active". No session is opened |
| Provider disabled | Campus button disappears. Existing sessions lose institutional access on their next request |
