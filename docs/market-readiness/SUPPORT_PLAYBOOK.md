# Support Playbook

**Status: `NOT_STARTED`**

## Tiers

| Tier | Handles | Escalates when |
| --- | --- | --- |
| **T1** | Account, navigation, how-to | The answer needs data access |
| **T2** | Integration failures, sync issues, data questions | Code change or tenant config needed |
| **T3** | Engineering | — |

## What a supporter is allowed to see

Unresolved, and it must be resolved before a pilot. RLS means support staff
cannot currently read a student's data to help them — which is correct by
default and unworkable as a permanent answer.

The wrong fix is a support account with broad read. The right shape is
**time-boxed, audited, consented access**: a student grants access for a
window, every read is recorded, and the grant expires on its own.

`family_grants` in `20260921161500_roles.sql` already implements almost exactly
this pattern for family members — scoped by category, with acceptance and
expiry. It is the model to follow rather than invent.

## Channels, SLAs, knowledge base

None defined. A university will ask for all three in procurement.

## Next

Define the support access model on the `family_grants` pattern. Everything else
here is ordinary and can follow.
