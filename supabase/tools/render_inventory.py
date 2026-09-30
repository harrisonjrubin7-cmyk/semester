#!/usr/bin/env python3
"""Render docs/ROLE-PERMISSION-MATRIX.md and docs/DATA-INVENTORY-AND-LINEAGE.md
from the output of `supabase/tools/introspect.sh supabase/tools/inventory.sql`.

    supabase/tools/introspect.sh supabase/tools/inventory.sql > /tmp/inv.out
    python3 supabase/tools/render_inventory.py /tmp/inv.out docs
"""
import sys, collections, os

src, out = sys.argv[1], sys.argv[2]
roles, caps, rc, tables = {}, {}, {}, []
for line in open(src):
    line = line.rstrip('\n')
    if not line or '|' not in line:
        continue
    k, *rest = line.split('|')
    if k == 'ROLE':
        roles[rest[0]] = rest[1] == 't'
    elif k == 'CAP':
        caps[rest[0]] = '|'.join(rest[1:])
    elif k == 'RC':
        rc[rest[0]] = rest[1].split(',')
    elif k == 'TABLE':
        n, rls, pol, ten, acct, rd, wr = rest
        tables.append(dict(name=n, rls=rls == 't', pol=int(pol), tenant=ten == 't', acct=acct == 't', read=rd == 't', write=wr == 't'))

HEADER = """<!-- Rendered by supabase/tools/render_inventory.py from a database built by applying every
     migration to a throwaway Postgres 17. Do not edit by hand; regenerate:
       supabase/tools/introspect.sh supabase/tools/inventory.sql > /tmp/inv.out
       python3 supabase/tools/render_inventory.py /tmp/inv.out docs -->
"""

# ── role × capability ──────────────────────────────────────────────────────
by_cap = collections.defaultdict(list)
for r, cs in rc.items():
    for c in cs:
        by_cap[c].append(r)
nocap = [r for r in roles if r not in rc]

m = [HEADER, "# Role and permission matrix\n"]
m.append(f"""What the migrations grant, read from a database built by applying all of them: **{len(roles)} roles**, **{len(caps)} capabilities**, **{sum(len(v) for v in rc.values())} role–capability grants**. {len(rc)} roles hold at least one capability; {len(nocap)} hold none and act only through rows they own.

## How to read it

- A policy asks whether the caller holds a **capability** at a **scope**, never whether they hold a role: `private.has_capability(capability, scope_kind, scope_id)`. A role is a bundle of capabilities.
- A grant lives in `role_grants(subject, role, scope_kind, scope_id)`. Scope kinds: `platform`, `school`, `organization`, `course`, `department`, `office`, `residence`, `business`, `employer`, `cohort`, `partner`. A **global** role (marked below) is granted at platform scope; every other role is scoped to a resource.
- **This is RBAC only.** The attribute rules that narrow a grant — consent, minimum age (13, and minors kept off social surfaces until 18), time-limited support-access and break-glass grants, feature state and release cohort, and object-level ownership — are enforced in policies and definer functions, not in this table. They are listed in [DEFINER-RLS-REGISTER.md](DEFINER-RLS-REGISTER.md) and proved, allowed and denied, by the `supabase/*.check.sql` suites (for example `role-grant-audit`, `support-access`, `console-approvals`, `minimum-age`, `integration-rls-matrix`).
- Student data is owned by the account (`auth.uid()`), not by a tenant or a role. No role here reads a student's private work by default.
- The UI role model (`app/src/lib/role.ts`) is not a security boundary; this table and the policies behind it are.

## Roles

| Role | Scope | Capabilities |
| --- | --- | --- |""")
for r in sorted(roles):
    cs = rc.get(r)
    m.append(f"| `{r}` | {'global' if roles[r] else 'resource'} | " + (', '.join(f'`{c}`' for c in cs) if cs else '— (none)') + " |")
m.append("\n## Capabilities\n\n| Capability | What it allows | Held by |\n| --- | --- | --- |")
for c in sorted(caps):
    hb = by_cap.get(c)
    m.append(f"| `{c}` | {caps[c]} | " + (', '.join(f'`{r}`' for r in sorted(hb)) if hb else '— (no role holds it yet)') + " |")
orphan = sorted(set(by_cap) - set(caps))
m.append("\n## Consistency\n")
m.append(f"- Capabilities granted to a role but not defined: {', '.join(orphan) if orphan else 'none'}.")
m.append(f"- Capabilities defined but held by no role: {', '.join(sorted(set(caps)-set(by_cap))) or 'none'}.")
m.append("""
## What this page does not show

It says who *may* hold a capability, not who *does*: grants are per person and per scope, in production data this page never sees. Whether a role is ready to give to a real person is the [Role Launch Register](ROLE-LAUNCH-REGISTER.md). Tenant-specific role limits on a feature flag (roles and release cohorts) are in the `tenant_feature_policy` table and `FEATURE-FLAG-REGISTRY.md`.
""")
open(os.path.join(out, 'ROLE-PERMISSION-MATRIX.md'), 'w').write('\n'.join(m))

# ── data inventory ─────────────────────────────────────────────────────────
n = len(tables)
rls_off = [t for t in tables if not t['rls']]
nopol = [t for t in tables if t['rls'] and t['pol'] == 0]
acct = [t for t in tables if t['acct']]
tenant = [t for t in tables if t['tenant']]
neither = [t for t in tables if not t['acct'] and not t['tenant']]
writes = [t for t in tables if t['write']]
d = [HEADER, "# Data inventory and lineage\n"]
d.append(f"""What the schema holds, read from a database built by applying every migration: **{n} tables in `public`**. This is the *structural* inventory. Field-level classification, retention and the reason each table exists are in [RETENTION.md](../RETENTION.md) (a row per table, held in both directions by `retention.test.ts`), [operating-model/DATA-STEWARDSHIP.md](operating-model/DATA-STEWARDSHIP.md) (tiers T0–T6) and [DEFINER-RLS-REGISTER.md](DEFINER-RLS-REGISTER.md). This page does not restate them.

## Summary

| Measure | Count |
| --- | --- |
| Tables in `public` | {n} |
| Row-level security on | {n-len(rls_off)} |
| **Row-level security off** | {len(rls_off)} |
| RLS on, **no policy** (deny by default; reached only by definer functions or the service role) | {len(nopol)} |
| Owned by an account (foreign key to `auth.users`) | {len(acct)} |
| Carry a `tenant_id` | {len(tenant)} |
| **Neither** account-owned nor tenant-scoped | {len(neither)} |
| Writable directly by a signed-in client role (before RLS) | {len(writes)} |

Account-owned tables are walked by `private.account_data_map()`, which derives them from the catalog, so export and erasure cover a new one automatically (`erasure.test.ts`, `deletion.check.sql`). A table that is neither account-owned nor tenant-scoped is not necessarily wrong — a catalog, a platform configuration table, a counter — but each is a place where nothing in the schema says whose data it is, so each is listed for review.

## Row-level security off
""")
d.append(', '.join(f"`{t['name']}`" for t in rls_off) if rls_off else "None. `supabase/rls-coverage.check.sql` fails the build if this list is ever not empty.")
d.append("\n## Neither account-owned nor tenant-scoped (review)\n")
d.append(', '.join(f"`{t['name']}`" for t in neither) or 'None.')
d.append("\n\n## RLS on with no policy (deny by default)\n")
d.append("Counted from `pg_policy` in the built database. [DEFINER-RLS-REGISTER.md](DEFINER-RLS-REGISTER.md) reports 45 from a static parse of the migrations; the two disagree, and the catalog count here is the one to trust for these migrations. The register's count should be reconciled (its own note DR-03 says policies created in loops are invisible to the parser).\n")
d.append(', '.join(f"`{t['name']}`" for t in nopol) or 'None.')
d.append("\n\n## Every table\n\n`Client read/write` is table privilege for the `authenticated` role before RLS; a row is still refused unless a policy admits it.\n\n| Table | RLS | Policies | tenant_id | Account FK | Client read | Client write |\n| --- | --- | --- | --- | --- | --- | --- |")
yn = lambda b: 'yes' if b else '—'
for t in tables:
    d.append(f"| `{t['name']}` | {yn(t['rls'])} | {t['pol']} | {yn(t['tenant'])} | {yn(t['acct'])} | {yn(t['read'])} | {yn(t['write'])} |")
d.append("""
## Lineage: where a record's authority is stated

Every content or data item is meant to carry one of five source labels — `institution_verified`, `imported`, `student_entered`, `estimated`, `needs_review` (`app/src/lib/source.ts`, drift-guarded by `source.test.ts`).

- **Database-enforced** (CHECK constraint): `term_plan_courses`, `registration_time_tickets` and two other tables from `20260926150000_expansion_roles_and_features.sql`.
- **Provenance tables** for integrations: `source_records`, `source_snapshots`, `source_freshness_events`, `canonical_entity_references`, `integration_source_owners`, with per-connection classification T0–T3.
- **Not labelled:** core student tables (`notes`, `courses`, `tasks`, `appointments`) carry no per-record authority label, and no Source Card shows a record with its sync time. This is gap G-12 in [FULL-BETA-REQUIREMENTS.md](FULL-BETA-REQUIREMENTS.md); it is planned for Milestone 2 and is **not** done.
- **Two trust vocabularies** are still in use, and the display badge adds two values that never reach a row.

## Flows out of the system

Recorded elsewhere, not derived here: subprocessors in [SUBPROCESSORS.md](SUBPROCESSORS.md); exports and hand-offs in [DATA-PORTABILITY-AND-OFFBOARDING.md](DATA-PORTABILITY-AND-OFFBOARDING.md); the AI providers' terms in the AI assurance pages. Data held **only on the device** (localStorage, IndexedDB files) is by design outside this inventory and outside the server's export — see gap G-01.
""")
open(os.path.join(out, 'DATA-INVENTORY-AND-LINEAGE.md'), 'w').write('\n'.join(d))
print(f"roles={len(roles)} caps={len(caps)} tables={n} rls_off={len(rls_off)} nopol={len(nopol)} neither={len(neither)}")
