# Tenant contracts

A school's signed terms, as data, one file each: `contracts/<tenant id>.json`.
The shape is `TenantContract` in
[`app/src/lib/contract/tenantcontract.ts`](../app/src/lib/contract/tenantcontract.ts);
[`docs/TENANT-CONTRACT.md`](../docs/TENANT-CONTRACT.md) says what each clause does.

**Who writes them.** Harrison Rubin, the owner, and nobody else (D-1019). A
contract lives in this repository, not in the database, so a school's own
administrator can never reach it, and it cannot be widened without a commit that
`.github/CODEOWNERS` routes to him. A contract only ever narrows what the
platform allows.

**How.** Add or change the file in a pull request. `contractfiles.test.ts`
reads every file here and fails the pull request if one is not a sound
contract, is named for a different tenant, or is anything other than JSON.

**Empty today.** No school has a contract recorded, and this layer constrains
nothing for a school without one. A contract is written from a signed order
form, never from a guess, so this directory stays empty until there is one.
Nothing calls `evaluateUnderContract` in the running app yet; that wiring, and
the same checks in the gateway and the database, are still to be built.
