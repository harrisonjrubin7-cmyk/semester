# Control plane

Reference material for the connection and control backbone. Nothing here is deployed.

| File | What it is | Enforced by |
| --- | --- | --- |
| `access-request.schema.json` | The public body of an access request: intent only, never identity, capability, score or approval | `access-saga.test.ts`, same way |
| `component.schema.json` | The shape of one component definition: owner, implementation, contracts, dependencies, authority, controls, recovery | `packages/institution/src/registry.test.ts`, which fails when the schema and `registry.ts` disagree |

The code is `packages/institution/src/access-saga.ts` (the grant provisioning state machine) and `registry.ts` (the definition validator and cross-definition checks). The reasoning, and what was proposed and not adopted, is in [`docs/master/SEMESTER_NATIVE_PDF_DELTA.md`](../master/SEMESTER_NATIVE_PDF_DELTA.md).

No component is registered. A definition's repository reference and revision come from verified implementation evidence, never from a catalogue.
