# Semester platform control

This package is the repository-owned implementation control plane. It turns a bounded slice of the ecosystem catalog into machine-checkable records for capabilities, systems, roles, screens, workflows, integrations, controls, documents, and tenants.

It deliberately separates repository implementation evidence from deployment, activation, and observed operation. A stage may be `true` only when that exact stage has evidence, and stages cannot skip an earlier false gate.

Run from the repository root:

```sh
npm run registry:validate
npm run registry:build
npm run platform-control:test
npm run release:check
npm run tenant:create -- --key demo-campus --name "Demo Campus" --owner platform-security --synthetic
```

`release:check` is expected to fail until every in-scope capability has production-ready evidence. It writes the fail-closed decision to `generated/release-evidence.json`; a failed release check is evidence that release is blocked, not that the registry is broken.

`tenant:create` creates only a new, unactivated synthetic registry record and refuses production provisioning. It does not create credentials, deploy infrastructure, or activate a tenant.

The first registry slice is `registration.readiness`. Extend the registry one real job loop at a time; do not bulk-mark the larger static catalog as implemented.
