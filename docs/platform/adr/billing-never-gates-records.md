# Billing never gates a student's records

**Status:** Accepted for the platform primitive. **Not yet in
`supabase/functions/_shared/entitlement.ts`** — that is MIGRATION phase 5, first.

## Decision

`ALWAYS_ENTITLED` — records access, data export, account deletion, accessibility
settings, safety alerts, support contact, billing management — is checked **before**
the plan, in `checkEntitlement`, and is allowed in every subscription state,
including none. A plan cannot remove an item from it. Everything else is plan →
key → `{enabled, limit?}`, with trial/active/past-due-grace/canceled-until states,
contract overrides that carry a reason, and idempotent metering. `requireEntitlement`
raises a 402 with a way forward.

## Why

The thesis is that every part of a student's educational life works natively; a
lapsed card must not lock a student out of their own record, their export, their
deletion, or a safety channel. The audit's design law is "prohibited shortcut:
unexplained profiling, dark patterns, or access beyond consent"; a paywall on
records is the commercial version. Making it a checked list rather than a policy
sentence means it cannot be quietly dropped by a plan edit.

## What it was chosen over

- **A flag per plan:** the safety property would live in data a sales tool edits.
- **Gating by feature and trusting plans to include the essentials:** the first
  bad plan row is the incident.

## How it is held

`packages/platform/src/engines/engines.test.ts` — every always-entitled key under
four subscription states including none, with a control that an ordinary key is
refused in the same states; grace, canceled-until, overrides, tenant mismatch,
metering, the 402. Mutation: removing the always-entitled check turns it red.

## What this constrains

Anything that *is* a record, export, deletion, accessibility or safety capability is
named in the list and never behind `checkEntitlement`'s plan branch. Adding to the
list needs no ceremony; removing from it is a decision.
