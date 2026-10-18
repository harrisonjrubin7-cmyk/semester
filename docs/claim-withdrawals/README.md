# Claim withdrawals

One file per withdrawal, named `<date>-<slug>.md`. The procedure is
[`../CLAIM-WITHDRAWAL-RUNBOOK.md`](../CLAIM-WITHDRAWAL-RUNBOOK.md). There is one
file per entry, not one shared log, so two open pull requests cannot collide on
it (see `CLAUDE.md`, "A decision takes its pull request's number").

`app/src/lib/gtm/withdrawal.test.ts` holds every entry here to these rules.

## Rules

1. The `Status` is `OPEN` or `DONE`.
2. The `Claim` row carries the **exact words**, in backticks, and they stay after the claim is gone.
3. `Detected` is an ISO date and time. `Completed` is `—` while `OPEN`, and an ISO date and time **no earlier than** `Detected` when `DONE`.
4. Every channel row has one state: `Removed`, `Open`, `Not present`, `Cannot remove` or `Out of scope`. `Cannot remove` and `Out of scope` need a reason in the notes.
5. An entry is `DONE` only when **no** channel is `Open`.
6. Every `CLM-` and `M-` id cited exists in its register.

## Template

```
# Withdrawal: <short title>

| Field | Value |
| --- | --- |
| Status | OPEN |
| Claim | `<exact words>` |
| Detected | 2026-01-01T00:00Z |
| Completed | — |
| Trigger | <contradicted, unsupported, expired, unapproved, third-party request, found in the wild> |
| Register rows | <CLM-… / M-…> |
| Escalation | <not required, and why; or who was told and when> |
| Owner | <function> |

## Channels

| Channel | Location | State | Notes |
| --- | --- | --- | --- |
| … | … | Open | … |

## Root cause and prevention

<which gate should have caught it; what was changed or proposed>
```
