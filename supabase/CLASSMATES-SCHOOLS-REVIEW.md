# Classmates, for any university — what to check before merging

On branch `classmates-any-school`. Not merged, because the client half and the
SQL half have to land together: the room key changes shape, and the existing
`code` check constraint refuses the new shape.

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
