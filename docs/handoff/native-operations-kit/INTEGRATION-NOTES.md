# How this kit fits (14 Oct)

Uploaded as `Semester_Native_Operations_Execution_Kit`; filed here unchanged. Its own ledger (SOURCE_AND_STATUS.md) is honest: everything is **PROPOSED**, no branch, migration, deployment, approval, payment or message was executed, owners are UNASSIGNED.

## Already in this project — extend, don't duplicate
| Kit artifact | Existing home | Action |
|---|---|---|
| consoles_33.csv | ui_kits/native-ops (13 + 9 + 11 = 33), ui_kits/ops | Same 33. Keep the design routes as aliases of the existing #/console and #/ops shells. |
| authorization_14_proposed.csv (C01–C14) | gate.ts in handoff/live-integration; registrar policy checks | Map each check to the function that enforces it before adding new code. |
| agents_12_proposed.csv | ui_kits/agent-ops; handoff/agent-operations | Repo's real agent identities weren't recovered by the kit, so these 12 are proposals, not renames. |
| specs/native_finance.md | docs/finance/NATIVE_FINANCIAL_PLATFORM.md; ui_kits/native-finance | Integer minor units, balanced per currency, Stripe-hosted card entry (SAQ-A posture). |
| specs/investor_portal.md | ui_kits/investor-portal | Same governance rules. |
| specs/operations_workflows_inbox.md | ui_kits/ops-inbox; handoff/build-plan/registrar event pipeline | Inbox items come from the outbox; no second queue. |
| roadmap_90days.csv / proposed_branches.csv | Completion register work packages | Branches are NOT CREATED; create them only from a reviewed plan. |

## Reference tests
`reference/TEST_RESULTS.txt`: 19 local Python tests (14 authorization denials, journal balancing, agent handoff depth/cycle/budget limits, digest stability). They test the reference functions only; no database, browser or payment provider. They weren't re-run here.

## Two cautions
- The 25 / 692 screen-catalog diff in the roadmap isn't recovered. The current catalog here is 673 screens in ui_kits/master-catalog; reconcile counts against that before quoting either number.
- Finance: Stripe webhooks must be signature-verified and replay-safe (handoff/live-integration/live-payments already does this). FinCEN money-transmitter status depends on facts and needs counsel — the kit makes no compliance claim and nor should any deck.
