# How to ship a change behind a flag

> **Type:** how-to · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-08 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page is for registering a tenant feature flag and gating a change on it; stop reading if the change is safe to ship on, because a flag is a cost that the complexity budget counts.

**Status:** LIVE for the registry and the evaluator. Per [`docs/FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md), every flag defaults off, and a flag is never a substitute for authorization.

There are two layers and they are different.

- **Tenant flags** are registered in `app/src/lib/flags.ts`. A school's state is a row in `public.tenant_feature_policy`, and a kill switch is a row in `public.feature_kill_switch`. This page is about them.
- **Build-time switches** are `VITE_*` variables read in `app/src/lib/experience-flags.ts` and `app/src/lib/aiflags.ts`. They decide whether code ships in a build. They never turn a feature on for a school by themselves. The names are in `app/.env.example`.

For a new build-time switch, make the deploy path explicit as well as the reader:

1. Add the name and fail-closed default to `app/.env.example`, the relevant flag reader and `SECRETS.md`.
2. Add it explicitly to the Pages workflow's build environment and to that workflow's allowlist of variables carried into the exact-SHA deploy. A repository variable that is not mapped there does not reach the build.
3. Cover both the off and on readings in the flag tests, and cover the workflow mapping in `app/src/lib/pagesdeploy.test.ts`.
4. Keep external authorization separate. A browser flag may reveal an approved control, but it must not stand in for a server approval switch, provider contract, tenant policy, institution registration or production UAT.

`VITE_SUPPORT_EMAIL_NOTICES` is the concrete example: only exact `true` exposes the student's opt-in, while the server still refuses delivery unless its independent `SUPPORT_NOTIFY_VENDOR_APPROVED` gate and sender credentials are configured. The Pages deploy carries the variable but leaves it unset by default.

1. Check main for the flag.
2. Choose the type. The key prefix must match it: `module.`, `integration.` (type `connector`), `scope.`, `release.`, `experiment.`, `ops.`, `safety.` or `writeback.`.
3. Add `flag({ ... })` to `app/src/lib/flags.ts` under the right group comment. Required: `key`, `description`, `type`, `owner`, `scopes`, `highRisk`, `reviewAt`, `rollout`, `successCriteria`, `rollback`, `killSwitches` and `capabilityIds`. `release` and `experiment` flags need an `expiresAt` after `reviewAt`. `connector`, `scope`, `writeback` and `safety` flags must be `highRisk: true`. Every flag binds to at least one capability that `capabilityDefinition` knows. Kill switches must be from `KILL_SWITCHES`.
4. Add the key, in backticks, to the table in [`docs/FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md).
5. Add a row to `OPERATION_POLICIES` in `app/src/lib/governance/operation-policy.ts` with the same risk class and capability ids.
6. For a `module` or `ops` flag, add a charter to `CHARTERS` in `app/src/lib/governance/charters.ts`. `charterProblems` in the same file lists the required fields.
7. Raise the flag count in `app/complexity-budgets.json`. The test message says to reuse or retire something, or raise the figure and argue it in the pull request. Argue it.
8. Regenerate the pages that mirror the registry.

   ```bash
   REGISTERS=write npx vitest run src/lib/governance/activation-control-plane.test.ts
   ```

9. Gate the code on the evaluator, `evaluateFlag` in `flags.ts`, not on a copy of its answer.
10. Run, from `app/`:

    ```bash
    npx vitest run src/lib/flags.test.ts src/lib/complexitybudgets.test.ts src/lib/governance
    ```

## What fails if you get it wrong

These were followed in a scratch copy on 2026-10-04 with a `module.scratch_demo` flag bound to an existing capability.

| Step skipped | Test that failed |
| --- | --- |
| Step 4, the registry page row | `flags.test.ts`, `is written down, key for key, in docs/FEATURE-FLAG-REGISTRY.md` |
| Step 7, the budget | `complexitybudgets.test.ts`, `flags: 29 is within its budget` |
| Step 5, the operation policy | `operation-policy.test.ts`, `covers every flag exactly once, with the same risk and allowed capabilities` |
| Step 8, the rendered page | `activation-control-plane.test.ts`, `is what docs/ACTIVATION-CONTROL-PLANE.md says` |
| Step 6, the charter | `charters.test.ts`, `charters every module and ops flag, and nothing that is not a flag` |

After steps 4, 5, 7 and 8, `flags.test.ts`, `complexitybudgets.test.ts`, `operation-policy.test.ts` and `activation-control-plane.test.ts` passed together, 69 tests. The charter was not written in the scratch copy, so its test stayed red there; the field list comes from `charterProblems`, not from a completed charter.
