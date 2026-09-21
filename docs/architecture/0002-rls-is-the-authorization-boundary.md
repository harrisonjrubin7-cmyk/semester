# 0002 · Row-level security is the authorization boundary

**Status:** Accepted. The strongest part of the codebase; do not weaken it.

## Decision

Authorization lives in Postgres row-level security policies. The client holds a
**publishable** key and is assumed hostile. No client check is treated as
security.

## Why

`lib/invite.ts` states it plainly: the key this app carries is publishable, so
anything reachable with it is public unless a policy says otherwise. The client
can be read, modified and replayed; the policy cannot.

## How it is held

`supabase/check.sh` applies every migration to a throwaway Postgres and runs a
`.check.sql` suite per area — **15 suites, 334 checks** at `d5bd897`. Each makes
synthetic users and walks a *pair* of them through what real accounts would do,
because **a policy is only ever wrong in a way you notice when a second account
is involved.** It is a CI step, not an optional script.

Two things the suites learned the hard way, both worth keeping:

1. **A refusal can come from the wrong lock.** `app_admins` has RLS on and no
   policy *and* the relation revoked. Every assertion that counted zero rows was
   being answered by the revoke, before a policy was consulted — so RLS itself
   was untested. The fix hands the grant back inside the rolled-back
   transaction, to ask what row-level security alone would do.
2. **A zero is also what a broken probe returns.** Every suite therefore carries
   a control that must come back non-zero, before anything is concluded from a
   zero.

## What it was chosen over

An application server doing authorization in code (see
[0003](0003-no-application-server.md)). Policies were chosen because they hold
even when a new client, a new function, or a mistaken `select *` arrives — the
boundary is at the data, not in front of it.

## What this constrains, for every later phase

Every new table a client touches needs, in the same migration: a policy, a
`.check.sql` suite walking two accounts, an entry in `RETENTION.md` saying what
deletion does to it, and a decision recorded in `privacy.test.ts`. Phases 4, 6,
10, 11 and 12 each add several. **Blocking in particular must be enforced in
policy before any surface exposes a person** — a UI-only block is not a block.
