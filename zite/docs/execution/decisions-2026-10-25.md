# Decisions, 25 Oct 2026

The founder delegated these six decisions ("you choose for all ... whatever makes most sense"). Each records what was
chosen, why, and what it changes. They can be reversed by the founder; reversing one means updating this file.

## D1 Sign-up and self-chosen roles (closes the open part of C11 / SEC-004)
- **Personal workspace:** self-service, any role including Administrator. It is a single-member tenant; nobody
  else's data is in it.
- **Shared Sample institution:** self-service as Student, Faculty or Advisor over synthetic data. **Administrator
  is refused** (`api/onboard.ts`), because everyone who signs up shares this tenant.
- **Real institutions:** invite code only, membership starts Pending until an existing administrator approves;
  Administrator is never self-service.
- Not done: existing Sample memberships that already hold Administrator were not changed (hosted data); list and
  remove them only on the founder's instruction.

## D2 Private file store (SEC-053/056/057)
- Build a private store inside the current stack: file bytes in Postgres, each file bound to tenant, owner and
  classification, served only through an endpoint that re-authorizes every download. No public or shareable URLs.
  Size cap per file; larger files wait for an external private bucket with short-lived signed URLs.
- Uploads stay switched off until the store passes its tests (cross-tenant and cross-user denial, revoked-share
  denial, size limit).

## D3 Institutional sign-on before real data
- SSO (SAML or OIDC through the institution's identity provider) is **required before any real student record**
  enters Semester. Until then: synthetic data only; invite-code pilots stay synthetic.

## D4 Owners (interim)
- Security review, incident response and backups: **Harrison Rubin (founder)**, interim owner of all three.
- Before real data: an independent security reviewer is named, and one restore drill from the database
  provider's point-in-time recovery is performed and recorded. Both are launch gates.

## D5 One builder in the Zite project
- This session is the only one writing code to the Zite monorepo. Other sessions read, or work on separate
  GitHub branches outside `zite/`. Reason: on 25 Oct two sessions edited the same files within minutes, forcing a
  manual merge and creating two parallel 135-module registers.

## D6 GitHub
- Pushing to GitHub is approved. `zite/` syncs go to a new branch per sync (`zite/sync-<date>`); the founder or a
  reviewer merges. Pull requests are opened through the repository's provenance tooling when it applies, otherwise
  from the compare link.
