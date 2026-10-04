# Releases and change communication

> **Type:** how-to · **Audience:** contributors, institution-admins · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/releases.test.ts`

How a change gets from a merged pull request to the people it affects: what you
write in the pull request, what you cut for a cohort or an institution, and what
you tell an administrator before their users notice. Read it if you are about to
merge something a person could see, or about to tell a customer what changed.

**Status:** by design the product ships continuously — every push to `main`
redeploys the live page ([`README.md`](../../README.md)) — so a "release" here is
a dated cut of the changelog that you choose to send, not a build with a number.
Nothing is versioned, tagged or published on a schedule, and no release note has
been cut yet. The first is expected with the first pilot cohort.

## Four places a change is announced

These are the channels that exist. A fifth — role-filtered release notes sent to
an institution's administrators — is *designed* in
[`INSTITUTIONAL-CHANGE-MANAGEMENT.md`](../INSTITUTIONAL-CHANGE-MANAGEMENT.md) and
not built, so for now an institution administrator is told by a person, using a
[change notice](../documentation/templates/institution-change-notice.md).

| Channel | Who reads it | Written | Held by |
| --- | --- | --- | --- |
| [`CHANGELOG.md`](../../CHANGELOG.md) | People testing Semester, and everyone below as the source | In the pull request that makes the change | The `screens` rule of `docs:impact`; the changelog's own three rules |
| The *What changed* screen in the app ([`whatsnew.ts`](../../app/src/lib/whatsnew.ts)) | Students and staff, filtered to the modules their school has switched on | In the pull request, when a person can notice the change | [`whatsnew.test.ts`](../../app/src/lib/whatsnew.test.ts): a date, a real screen, a sentence about what to do |
| A release note in `docs/releases/notes/` | A cohort, or one institution | At a cut, from the changelog | [`releases.test.ts`](../../app/src/lib/docs/releases.test.ts): every change it names is a changelog heading; no `TODO(edit)` left |
| The [status page](../../app/public/status.html) and its [feed](../../app/public/status-feed.xml) | Anyone, during an incident or planned maintenance | When an incident is declared or closes | [`statushistory.test.ts`](../../app/src/lib/statushistory.test.ts) |

Incidents are communicated by [`INCIDENT-COMMUNICATIONS.md`](../operating-model/INCIDENT-COMMUNICATIONS.md),
by audience, and are not release notes.

## In every pull request

1. If a tester can notice the change — including something that got worse or
   was taken away — add an entry under `## Unreleased` in
   [`CHANGELOG.md`](../../CHANGELOG.md), in its own rules: what you will *see*,
   whether you have to do anything.
2. If a student or staff member can notice it, add a note to `NOTES` in
   [`app/src/lib/whatsnew.ts`](../../app/src/lib/whatsnew.ts). It is dated the day
   it reaches the live page, names the modules it concerns, and says what to do.
3. Decide which [class of change](CHANGE-COMMUNICATION.md#classes-of-change) it
   is. A class above *visible* has a notice that someone must send, and the pull
   request says who.
4. Say which documentation moved with it, or `Docs: none because …`
   ([how that is checked](../documentation/OWNERSHIP-AND-REVIEW.md#what-a-change-owes)).

## Cutting a release note

Do this when a cohort or an institution should be told, in one place, what
changed since they were last told.

```bash
cd app
npm run release:draft                              # the Unreleased entries, to the screen
npm run release:draft -- --date 2026-11-02 --write # writes docs/releases/notes/2026-11-02.md
```

1. The draft copies each change's heading from the changelog exactly, with its
   first paragraph and the commit it was cut from. It is full of `TODO(edit)`.
2. Edit every one. Keep, shorten or remove each change; say what got worse or was
   taken away; write "What you need to do" even if the answer is "Nothing.";
   write "Known problems" only after looking.
3. Add the note to the table below. A note that is not listed fails the test.
4. Run `npx vitest run src/lib/docs/releases.test.ts src/lib/docs/docsystem.test.ts`.
5. Send it by the route in [`CHANGE-COMMUNICATION.md`](CHANGE-COMMUNICATION.md),
   and keep that record.

A note names the commit it was cut from. That commit is how an institution is
pinned to what applied on the day it went live: the documentation at that commit
is the documentation of that release
([versioning](../documentation/OWNERSHIP-AND-REVIEW.md#versioning)).

### Notes cut so far

| Date | Note | Cut from |
| --- | --- | --- |
| — | None yet | — |

## Deprecating something

Something a partner or an administrator depends on — a route, a field, an event
version, a screen, a setting — is not removed without a notice. Copy
[`deprecation-notice.md`](../documentation/templates/deprecation-notice.md), fill
the date and the replacement, and send it by the route for a *breaking change* in
[`CHANGE-COMMUNICATION.md`](CHANGE-COMMUNICATION.md). The reference page for the
thing carries a **Status** line naming the date from the day the notice goes out.
