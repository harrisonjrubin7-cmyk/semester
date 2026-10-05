# Tenant mapping configuration

Part 1, item 9. Phase 1a. **Waits for #779.** Nothing here is built yet.

## What exists on main

- `public.scim_group_mapping`
  (`supabase/migrations/20260924150142_institution_identity_provisioning.sql`)
  maps a school's directory groups onto Semester roles — a tenant mapping for
  identity, with the review and audit pattern this part should copy.
- `public.tenant_feature_policy` and its audit trigger into
  `tenant_policy_audit_event` (`supabase/migrations/20260923210000_intelligence_policy.sql`)
  is the existing versioned, audited, tenant-scoped configuration.

## In flight

#779 adds `integration_mappings`. That is the mapping; what it lacks is history.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `tenant_mapping_configurations` | **Reuse** `integration_mappings` (#779) | Same thing |
| `tenant_mapping_versions` | **New**, append-only | Each version: the mapping document, who proposed it, the simulation run that tested it, who approved it, when it went live, what it replaced |

A mapping is chosen from **bounded templates**: a transform is one of a fixed
list (rename, date format, enum map, trim, concatenate), never an expression a
school writes.

## Capabilities and flags

- Propose: `tenant:implement` (exists). Approve: `tenant:configure` (exists).
  The same person cannot do both on one version.
- Rides `module.integration_quality`.

## Hard boundaries

- No version goes live without a passing simulation run referenced on it.
- Rollback is "make the previous version live", recorded as a new event — the
  history is never rewritten.
- A mapping never contains or displays a credential; credentials stay where
  #779 keeps them.

## Tests

- Propose → simulate → approve → live → rollback, each step audited.
- Same-person approval is refused by policy.
- A transform outside the template list is refused by a check constraint.
