# 0001 · Local-first working copy, Supabase as the second copy

**Status:** Accepted — and **under review**, because the transformation command
asks for a product this decision cannot carry. See the last section.

## Decision

`localStorage` is the working copy. Every screen reads it, and the app is fully
usable signed out. Signing in adds a second copy in Postgres and keeps the two
in step. Attached files live in IndexedDB and are **never** synced.

## Why, rather than a server as the source of truth

Because of what the app is allowed to promise. A syllabus is the student's
document; a private note is the student's note. With the working copy on the
device, "a private note never leaves the phone" is a fact about the
architecture rather than a policy somebody could change. That promise is the
reason the app can ask for a syllabus at all.

## What it was chosen over, and what that cost

Server-as-truth was the alternative and would have made Phases 4–12 of the
command trivial. It was not chosen, and the cost is recorded honestly in
`lib/role.ts`: five of the six roles the app names cannot ship, because a role
that reads *somebody else's* data needs a server, an authenticated identity on
both sides, and an authorization model.

The sync reconciliation was also got wrong once, in a way worth keeping in the
record. It used to be **last-write-wins across the whole copy**, which sounds
modest and was destructive: two devices each writing a note offline meant the
one that synced second won its entire list, and the other note was gone with
nothing to say so. `lib/merge.ts` merges field by field now. One record edited
on both devices still resolves to the later edit, and the UI says so rather
than implying more.

## Why files are excluded

They can be tens of megabytes. Uploading them silently on a phone plan is not a
decision the app should make for somebody. The screen says they stay put.

## What would have to change to revisit this

A campus social graph is the one thing local-first cannot do: its whole value
is other people's data, arriving without their device being present. The
command's Phases 4, 6, 8, 10, 11 and 12 all require it.

So this is not a decision to quietly erode — it is a decision to **replace
deliberately, once**, with a stated answer to what happens to the privacy
promise. Half-migrating is the bad outcome: a product that syncs enough to
break the promise and not enough to be a network.

See §0 of [SEMESTER_IMPLEMENTATION_PLAN.md](../../SEMESTER_IMPLEMENTATION_PLAN.md).
