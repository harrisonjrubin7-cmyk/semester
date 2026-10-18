# Registry

Machine-checked records that tie a product component to its owners, boundaries,
dependencies, controls, tests, and lifecycle. The first slice is the **component
passport**. Only shape is enforced here; whether the named owners, policies,
tests, and evidence exist is not yet checked.

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
- A passport whose `lifecycle.current_status` is anything other than `proposed`
  must carry dated `created_at` and `last_reviewed_at` (`YYYY-MM-DD`).

The source material writes passports as YAML. The app has no YAML parser and
this change adds no dependency, so passports are JSON with the same keys.

## Status of entries

| ID | Status | Notes |
| --- | --- | --- |
| `WF-READINESS-001` | `proposed` | Shape from the continuation brief. Owners are the brief's role labels, not confirmed people. Upstream `integrations.sis` (the platform-control key; its connector record is `registry/connectors/SIS-READINESS-001.yaml`, not a component passport and not certified) and `POL-READINESS-001` (not in this repo yet). |
