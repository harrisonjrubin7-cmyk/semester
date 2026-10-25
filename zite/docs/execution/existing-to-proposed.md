# Existing-to-proposed map (build contract, required first step)

Source package (owner upload, 2026-10-22): 32 proposed apps, 71 logical services, 79 role templates and
the Zite implementation contract. Every item in that package is marked "not verified" or "proposed".
This map places each item against what exists today. Evidence is cited, and anything without evidence
is recorded as "no".

## Apps — `existing-to-proposed-apps.csv`
- **19 of 32** have something built:
  - 11 live in Zite app screens;
  - 2 in the verified Postgres layer (registrar, student accounts);
  - 1 is deployed (the public Site, APP-032).
- **13 of 32** have nothing built: institution IT (blocked on SSO and SIS), analytics, developer
  portal, app review, marketing, content, customer success, implementation, support, people,
  legal, platform operations, board.
- No app is institution-authorized or production-enabled.
- The editor agent's Company app (CRM, contracts, projects, tickets) is **in the trash**. It is
  mapped as "none". Its two defects, owner self-approval and evidence deletion, matter only if
  it is restored.

## Roles — `existing-to-proposed-roles.csv`
- **15 of 79** templates have a counterpart: Zite membership roles (Student, Faculty, Advisor, Staff,
  Administrator) and the per-app users (Applicants, Employers, Family).
- The other 64 have no implementation. All 79 remain "proposed template; not an approved
  entitlement".
- Zite roles are coarse labels on a membership. They have no capability table and no workspace
  scope; the verified Postgres layer has both.

## Services
The 71 entries are logical boundaries, which the contract allows to share a deployment. Implemented
and tested, in the verified layer only:
- identity and tenant (iam);
- the registration command;
- private files;
- the append-only audit and outbox;
- payment webhook and ledger;
- JWT and token-bucket gateway pieces.
Everything else is not built.

## Contract implementation order: status
1. Inventory and evidence registry — **this document**.
2. Identity, tenant enforcement, private files, server-side policy, command and receipt model —
   **verified in test** (Postgres layer, 93 + 28 checks). Not connected to Zite and not deployed.
3. Company invoice, approval and reconciliation slice — **not started**. Next.
4. Institution read-only readiness and source reconciliation — Zite readiness exists; no source
   reconciliation (no SIS).
5. Developer sandbox, app registration, scoped install and revocation — not started.
6. Marketing draft, review and approved publication, with sending disabled — not started.
7. Remaining workspaces — not started.
