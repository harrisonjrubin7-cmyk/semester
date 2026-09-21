# Architecture decision records

What §43 of the transformation command asks for: the significant decisions, and
**why** rather than what.

## Why these are short, and mostly pointers

This repository already documents its reasoning, at length, in the place the
reasoning is load-bearing — the source file it governs. `lib/cloud.ts` explains
why sync merges field by field and why files never leave the device.
`lib/role.ts` explains why five of six roles cannot ship. `supabase/check.sh`
explains why a policy is only ever wrong when a second account is involved.
That is better than an ADR directory, because a decision recorded beside the
code it constrains cannot drift from it.

So these records do not restate those arguments. They **index** them, and add
only the part the source cannot carry: what was chosen, what it was chosen
over, and what would have to change for the decision to be revisited.

One decision per file. A record is only added when something real turns on it;
an empty ADR for a technology nobody has chosen yet is a decision pretending to
have been made.

## Records

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-local-first-with-supabase.md) | Local-first working copy, Supabase as the second copy | Accepted, **under review** |
| [0002](0002-rls-is-the-authorization-boundary.md) | Row-level security is the authorization boundary | Accepted |
| [0003](0003-no-application-server.md) | No application server; edge functions instead | Accepted, will be tested by Phases 6–15 |
| [0004](0004-ai-through-a-metered-gateway.md) | AI through a server-side metered gateway, tool-based | Accepted, **not deployed** |
| [0005](0005-multi-campus-scoping.md) | Campus scoping via an admin-written `schools` table | Accepted — `20260921170000_schools.sql` |
| [0006](0006-search-is-one-ranker.md) | One ranker for search, extended rather than duplicated | Accepted |

Not yet decided, and deliberately not recorded as if they were: messaging
fan-out, notification digests, payments processor, object storage for generated
media. Each becomes a record when a phase needs it.
