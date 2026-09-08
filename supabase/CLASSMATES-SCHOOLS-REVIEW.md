# Classmates, for any university

> **Merged in PR #3 — and the SQL half has to be run now.**
>
> This document was written before the merge and said the two halves had to
> land together. The client half has landed. Until `classmates-schools.sql`
> runs against the live database, **joining a room fails**: the client now
> writes `vanderbilt/ECON 1020` (`roomKey` in `app/src/lib/classmates.ts`) and
> the live `enrollments.code` constraint is still
> `check (code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$')`, which refuses the slash
> and the lowercase prefix. The insert is rejected outright.
>
> It affects signed-in users only, and only Classmates — nothing else reads
> that table. Run the SQL, in the order below, and it is resolved. The checks
> in "What to check in the SQL" are still the right ones to make first.

The rest of this document is as written before the merge, and its reasoning
stands.

## The thing being fixed

`supabase/classmates.sql` has this, inside a row-level-security policy:

```sql
and lower(u.email) like '%@vanderbilt.edu'
```

That is a per-school check in the security layer. Every student at every other
university is refused the feature outright. The ground rules you wrote say
never to restrict by email domain, and this was the only place in the project
that did.

## What changes

| | Before | After |
|---|---|---|
| Server check | confirmed **and** `@vanderbilt.edu` | confirmed |
| Client check | `DOMAIN = 'vanderbilt.edu'` constant | the active school's `emailDomains` |
| Room key | `ECON 1020` | `vanderbilt/ECON 1020` |
| A school with no domains listed | could not use it at all | any confirmed address, and the screen says so |

Vanderbilt's profile now carries `emailDomains: ["vanderbilt.edu"]`, so a
Vanderbilt student sees no difference in the app.

## The honest cost, stated plainly

**Server-side, the domain guarantee is gone for everyone, Vanderbilt
included.** Today a Vanderbilt student knows every person in a room holds a
vanderbilt.edu mailbox, because the database enforced it. After this, the
database enforces only that the address is confirmed; the domain check runs in
the client, and a client check is not security — `classmates.sql` has always
said the policies are the security.

Somebody willing to call the API directly could join a Vanderbilt room from any
confirmed address. What they would get is a course-code chat room. What they
could not get is anybody's email, grades, notes or coursework: none of that is
in these tables, and the profile row is a handle and a 140-character bio by
design.

Putting the strength back needs the Phase 2 `schools` table plus a `school_id`
on `profiles`, so the policy can compare an address against that school's
domains server-side. That is the right fix and it belongs with Phase 2 rather
than here.

**If that trade is not acceptable yet**, the alternative is to leave this
branch unmerged and keep Classmates as a Vanderbilt-only feature until Phase 2
lands. Nothing else in the school work depends on it. That is a legitimate
choice and it is yours.

## What to check in the SQL

1. **Step 2 drops the constraint before step 3 rewrites the data.** In the
   other order the update fails on its first row.
2. **The prefix migration is `where code ~ '^[A-Z]{2,4} ...'`** — only rows
   with no prefix yet. Run it twice and the second run matches nothing.
3. **Every existing row really is Vanderbilt's.** It has to be: the old policy
   refused any other address, so nothing else could have been written. This is
   a rename, not a guess. Worth confirming against the live table:
   ```sql
   select count(*) from public.enrollments
    where code !~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$';   -- expect 0 before running
   ```
4. **The new constraint still refuses a malformed course code.** The course
   half of the pattern is unchanged; only the `<school>/` prefix is new.
5. **`messages.code` has no constraint** (it never did) but is migrated in the
   same transaction, so a room's history moves with the room.

## Rollback

At the bottom of the SQL file. It is only safe before anybody outside
Vanderbilt has joined a room — after that, stripping the prefix would merge
other schools' rooms into Vanderbilt's, which is worse than leaving it applied.

## Client side, already done on this branch

- `lib/classmates.ts` — `eligible(email, school)`, `proves(school)`,
  `roomKey(schoolId, code)`, `codeOf(key)`; `DOMAIN` deleted.
- `roomsFor` takes the school id and returns `{ key, code, joined }`.
- `screens/Classmates.tsx` — says what verification does and does not prove,
  and refuses to open a room with no school set rather than guessing.
- Tests cover the lookalike domain, the no-domains school, and the case that
  matters most: another school's room of the same course code must not count
  as one you have joined.

## Since this was written

Rebased onto main. One conflict, in `Classmates.tsx`: main had moved the
screen onto the `<Page>` shell and the type tokens while this branch changed
the same paragraph's wording. Resolved as main's shell with this branch's
sentence, which is the point of the branch — the old copy named Vanderbilt in
a line every school would read.

The migration needed a real correction, not just a rebase. It said

    create or replace function public.verified_student()

and that function now lives in `private`. In `public` it was also a URL, since
PostgREST publishes what anon or authenticated may execute there; applied
unchanged, this would have created a *second* copy in the exposed schema and
resurrected `/rest/v1/rpc/verified_student`, which no policy reads any more.
Dead code whose only effect is an endpoint. Retargeted, and brought in line
with the rest of the hardening: empty search_path, `auth.uid()` hoisted, and
EXECUTE granted to both roles because the policies calling it are `TO public`.

## A third option, which was not on the table before

The choice above is stated as merge-and-lose-the-guarantee or stay-Vanderbilt-
only until Phase 2. There is a middle path that keeps the guarantee *and*
opens the feature, and it is smaller than Phase 2 because it does not need
`school_id` on `profiles` — the school is already in the room key.

Put the domain list in the database:

```sql
create table public.school_domains (
  school_id text not null,
  domain    text not null,
  primary key (school_id, domain)
);
alter table public.school_domains enable row level security;
-- No policies. Only SECURITY DEFINER functions read it, and they bypass RLS;
-- a table with RLS on and no policy refuses everyone else.
```

and check the address against the school named in the code:

```sql
create or replace function private.may_join(want_code text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
      and (
        exists (select 1 from public.school_domains d
                 where d.school_id = split_part(want_code, '/', 1)
                   and lower(u.email) like '%@' || d.domain)
        or not exists (select 1 from public.school_domains d
                        where d.school_id = split_part(want_code, '/', 1))
      )
  );
$$;
```

A Vanderbilt room still admits only vanderbilt.edu, enforced by the database.
A school that lists no domains admits any confirmed address, which is the
same rule this branch already describes to the reader. A school nobody has
seeded is a room nobody else is in.

What it costs: one table, and seeding it as schools are added — the domains
live in the client-side school packs today, so they would need a home on the
server as well. That duplication is the honest price, and it is a smaller one
than losing a security property.
