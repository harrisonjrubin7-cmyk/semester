# Limiting a university's course rooms to its members

Full-beta G-03. Built 30 Sep 2026 on the owner's approval of the staged plan. **Off for every school that exists**; nothing changes for anyone until Semester staff switch a school on. Migration `20260930185000_school_membership_enforcement.sql`; proved by `supabase/school-membership.check.sql` (32 checks, six guards shown red by mutation).

## What it is

A course room key is `<school>/<COURSE>` (for example `north/ECON 1020`). Before this, any confirmed, age-cleared account could enrol in any school's room. Now each school has a switch, `schools.enforce_membership`. While it is **off** the school's rooms behave exactly as before. When it is **on**, a room whose key names that school is open only to accounts whose `profiles.school_id` is that school:

| Route | Enforced-school room, non-member |
| --- | --- |
| Join (enrol) | refused |
| Read messages / reactions | nothing returned |
| Post | refused |
| Be listed as a classmate, or see members' profiles | not visible, both ways |
| Live presence channel | refused |
| Words posted before the switch | hidden from members (restrictive policy) |

It affects only rooms of the switched school. Another school's rooms, enforced or not, are untouched.

## How a person becomes a member

1. **Auto-claim, only when unambiguous.** The Account screen claims a school for you once when exactly one configured school publishes your confirmed address's domain. Two schools publishing one domain (a multi-campus system) is not guessed. The server re-checks the address it confirmed; the screen only decides whether to ask. If you leave, it is not redone for you on that device.
2. **Claim by choice**, for a school whose address you hold (`claim_school`, unchanged in effect).
3. **Ask to join**, one tap plus a sentence, when your address is not any school's (personal address, visiting student). It grants nothing. A person holding `tenant:configure` at **that** school sees the handle and the sentence (never an address) and approves or declines. Nobody can decide their own request or another school's.

## Recovery

- You can **leave** (after a confirm); nothing you made is deleted.
- You can **withdraw** a waiting request.
- A school administrator can **remove** a member of their own school (a shared address, the wrong campus).
- Operator can switch a school **off** at once; the room is open as it was, outsiders' earlier words included.

## Switching a school on (operator only)

1. Confirm the school row lists its email domains. The switch refuses a school that publishes none: nobody could claim their way back in.
2. Ask the school's administrator to open Account → *For this university's staff* and read the counts, or call `school_enforcement_readiness('<school>')`: members, people enrolled in its rooms, **people who would be locked out**, and requests waiting.
3. Announce it to that school's students; give them the claim / ask-to-join route and a date.
4. Approve the waiting requests you can.
5. Call `set_school_enforcement('<school>', true, <locked_out>)`, passing the exact locked-out number from step 2. A wrong or missing number is refused. Only a platform administrator can call it; a school administrator cannot, and a direct write to the column is refused by a trigger.
6. Watch support for a day. To undo: `set_school_enforcement('<school>', false)`.

Every step is on the audit record (`school.membership_claimed`, `_requested`, `_approved`, `_rejected`, `_withdrawn`, `_left`, `_revoked`, `school.enforcement_on`, `_off`), pseudonymised, with no address in it; three-year retention like the other audit tables.

## Readiness evidence required before the first school is switched on

Not met today. Record each in `docs/evidence/` when done.

- [ ] The migration applied to a Supabase preview branch, and `school-membership` run against it (CI runs it on a disposable database; the preview branch has only applied the migrations).
- [ ] The school's domains entered and checked by its own IT contact.
- [ ] The readiness count taken on the real data, and the owner's written approval for that number.
- [ ] A rehearsal on a staging school: switch on, confirm a locked-out account gets back in by claim and by approval, switch off.
- [ ] Support briefed; the student announcement sent.

## Limits, said plainly

- **Not a proof of enrolment.** Membership means "recognised as being at this university", by address or by staff decision. It says nothing about whether a person is enrolled in a course.
- **A request is only as good as the staff who approve it.** They see a handle and a sentence.
- **`claim_school` still returns success for an account that has no profile row yet**; the screen reads the column back, so it reports nothing claimed. Fixing that is separate.
- **A school can be switched on before its students claim**, which is why the count must be stated. The design makes that a deliberate act, not an accident.
- Room *keys* are still chosen by the client. Enforcement rests on the key naming a school; a key naming an unknown school is not enforced by anyone.
- Not a FERPA or privacy certification of any kind.
