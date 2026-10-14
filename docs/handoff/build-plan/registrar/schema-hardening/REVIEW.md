# Review (14 Oct)

Filed unchanged. Your 22 tests passed locally (synthetic JSON Schema only). I re-checked the enrollment command schema here with ajv (draft 2020-12, formats on): it compiles, and a valid add is accepted, unknown fields are rejected, and a drop carrying `sectionIds` is rejected.

Three things the schema allows that the registrar contracts don't:
1. **Uneven swap.** `swap` with 1 `fromEnrollmentIds` and 3 `sectionIds` is accepted. If a swap is one-for-one, set both arrays to `maxItems: 1` (or require equal length in the server, since JSON Schema can't compare array lengths).
2. **Any year.** `termCode` accepts `0000FA`. Constrain to the institution's term list server-side; the pattern can at least be `^(19|20)[0-9]{2}(FA|SP|SU)$`.
3. **No idempotency key in the body** — correct if it travels as the `Idempotency-Key` header (as in `live-institution-command` and `registration.enroll.v2`). Say so in the schema description so nobody adds it to the body later; the body rejects it today.

And one the schema can't check: `studentId` must equal the authenticated student unless the caller is registrar staff acting with a scoped grant. That belongs in the command handler (already in `101_controlled_actions_hardening`'s grant check).

## v2 (applied)

`enrollment_commands.v2.schema.json` applies items 1–3: swap is one-for-one (both arrays `maxItems: 1`, matching `registration_swap(from, to)`), `termCode` is `^(19|20)[0-9]{2}(FA|SP|SU)$`, and the description states the idempotency key is the header and that `studentId` is checked by the handler. v1 is unchanged.

`v2-fixtures.json` (12 cases) ran here with ajv — results in `v2-results.json`: 12/12 as expected. Add the fixtures to `test_registrar_schemas.py` so the Python suite covers v2 too.

`test_enrollment_v2.py` runs the same fixtures under Python `jsonschema` and adds a tightening guard: the three cases v2 now rejects (uneven swaps, year 0000) must still pass v1, so the change stays deliberate and visible. Logic checked here with ajv; Python not run.

## One contract, not two

The reference OpenAPI (`reference-package/enrollment.openapi.json`, `EnrollmentCommand`) and this schema describe the same endpoint but had drifted:

| | Reference OpenAPI | This schema |
|---|---|---|
| Term | `termId` (uuid) | `termCode` (`2027SP`) |
| Max sections | 8 | 12 |
| Override ids | `overrideIds` (≤5) | — |
| Swap | was many-to-many → **now 1:1** | 1:1 (v2) |

**Source of truth: the reference OpenAPI.** It's the one the validator, live runner and repo patch use, and `termId` is what `registration_enroll` takes. I applied the one-for-one swap and the header/handler notes to it (ajv: 1:1 swap accepted, 1:2 rejected, add accepted). Treat `enrollment_commands.v2.schema.json` as a test-bench copy for the Python OAS-migration suite; before using it as a contract, switch it to `termId`, 8 sections and `overrideIds` — or generate it from the OpenAPI so they can't drift again.

## Generated schema (no drift)

`generate_from_openapi.py` builds `enrollment_commands.generated.schema.json` from the reference OpenAPI (`--check` in CI fails if it's stale). `generated-fixtures.json`: 16 cases in the real contract shape (`termId`, 8-section cap, `overrideIds` ≤5, withdraw needs `withdrawalReasonCode`) — 16/16 as expected under ajv. Point `test_enrollment_v2.py` at the generated schema + these fixtures and retire the hand-written v2 file.
