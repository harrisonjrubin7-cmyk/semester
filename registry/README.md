# Registry

Machine-checked records that tie a product component to its owners, boundaries,
dependencies, controls, tests, and lifecycle. The first slice is the **component
passport**. Shape is enforced by `app/src/lib/registry/passport.ts`. Reference
resolution is enforced by `app/src/lib/registry/references.ts`: a policy, evidence,
release, test or SLO identifier must name a passport, or appear in the open list in
`references.test.ts` with its reason. Owners, and the evidence, test, release and SLO
records themselves, are not yet checked.

## Passports

`passports/<ID>.json` — one file per component, file name equal to `passport.identity.id`.

Required sections: `identity`, `accountability`, `boundaries`, `dependencies`,
`control_plane`, `quality`, `lifecycle`. The rules are in
`app/src/lib/registry/passport.ts`; `app/src/lib/registry/passport.test.ts`
validates every file here and proves the rules reject bad input.

- `identity.type` is one of the nine types in `PASSPORT_TYPES`.
- `identity.id` uses an uppercase prefix, e.g. `CAP-`, `WF-`, `POL-`, `SCR-`, `API-`,
  `EVT-`, `TST-`, `EVD-`, `REL-`, `SLO-`.
- `boundaries.allowed_uses` and `prohibited_uses` must both be non-empty.
- A reference must carry the prefix of the artifact it names: `control_plane.policy_ids` → `POL-`,
  `control_plane.required_evidence` → `EVD-`, `control_plane.release_gate` → `REL-`,
  `quality.test_suites` → `TST-`, `quality.service_objectives` → `SLO-`.
  `upstream`, `downstream` and `audit_events` are free text and are not prefix-checked.
- A passport whose `lifecycle.current_status` is anything other than `proposed`
  must carry dated `created_at` and `last_reviewed_at` (`YYYY-MM-DD`).

The source material writes passports as YAML. The app has no YAML parser and
this change adds no dependency, so passports are JSON with the same keys.

## Status of entries

| ID | Status | Notes |
| --- | --- | --- |
| `WF-READINESS-001` | `proposed` | Shape from the continuation brief. Owners are the brief's role labels, not confirmed people. Upstream `integrations.sis` (the platform-control key; its connector record is `registry/connectors/SIS-READINESS-001.yaml`, not a component passport and not certified) and `POL-READINESS-001` (not in this repo yet). |
| `SVC-DESIGN-SYSTEM-001` | `implemented_not_release_verified` | Package authority, boundaries, CI checks, and safe-off path are registered. Component-level passport coverage and the referenced policy, evidence, test, and release artifacts are not complete. |
