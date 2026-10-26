# Traceability and ship program
Every object carries stable decision/capability/contract/code/test/evidence/release/operation references. A source design mapping is one edge, not proof of the chain. Existing workflow catalog uses different namespaces and has gaps; retain aliases rather than guessing authority.

Nine proposed promotion states: catalogued → designed → implemented → locally tested → target validated → reviewed → authorized → activated → operated. These are workflow stages, separate from six maturity facts. Deployment is a scoped artifact fact and does not imply activation. Withdrawal/expiry/material scope change returns affected scope to held.

Twelve operating proof items: entry identity; grants; first value; full loop; source authority; current data; denied access; failure handling; durable receipt; reconciliation; staffed support; recovery/offboarding.
Workspace register has 17 proposed scopes, each with 20 review gates; it is not an assertion that these names match the canonical 17 scopes. Reconcile IDs first. Default activation disabled. Current source README declares a canonical control plane; extend it rather than installing a parallel one.

Passports must identify object/tenant/candidate SHA/environment/cohort/data mode, allowed purpose, source authority, adapter owner, minimum dataset, consent/policy references, freshness target, grants, idempotency, reconciliation, stop/rollback, qualified reviews and expiry. No 'pilot-certified' status from a schema-valid passport alone. Unknown is explicit; never a zero or silent pass.

Schema counts: requested 21 handoff streams, dated audit185 migrations and proposed227 table manifest are separate claims. This session did not reconcile the full live migration history. Do not report these as verified totals.

Local build evidence: lab/core.py has real synthetic SQLite transactions and tested invariants. It is not a replacement database for Semester and has no production RLS/migration/provider authority. Transfer behavior into canonical TypeScript/Postgres systems in a reviewed branch.
