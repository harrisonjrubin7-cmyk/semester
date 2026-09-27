# Consent design: athlete academic-support sharing and supporter view

**Status: decided by owner 27 Sep 2026 — every recommendation in §9 approved
(D1–D6; D7 is the school's review and stays open until the pilot school
gives it). Built in the order of §8. No migration is applied to production
without a separate approval.** Phase 4 of the brief asks for "student-controlled academic-support
sharing" in the Athlete Plan and "student-consented limited sharing only" in
the Supporter View. This document says how both would work, what already
exists to build them on, and what has to be decided before any of it ships.

It is a design, not legal advice. Sharing education records with a parent or
a staff member is governed by FERPA and by the school's own policies; the
school's registrar and compliance office decide what their consent forms
require, and this design is built so their answer can be followed rather than
guessed at.

## 1. The rules both kinds of sharing follow

These are not preferences. Each one is a failure somebody would otherwise
live through.

1. **Only the student starts it.** No coach, parent, staff role or
   institution setting creates a share. A role says what a person *may be
   granted*; only a student's grant says what they *can read*.
2. **One named person, not a link.** A share names a recipient account. There
   are no bearer links in the pilot: a link forwarded once is shared with
   everyone it reaches. (Matches D-016 for advisors.)
3. **Named items, not whole categories.** A category alone grants nothing
   (`family_grants.resource_ids` already defaults to the empty set for this
   reason). The student picks the things; "everything in Academic" is not an
   option in the pilot.
4. **It ends.** Every share has an expiry, required and term-bounded (at most
   200 days, as `accommodation_shares` already enforces). There is no
   "until I revoke it".
5. **It stops the moment the student says so.** Revoking takes effect on the
   next read, with no grace period and no confirmation from the recipient.
6. **The recipient accepts.** A grant nobody accepted is not one
   (`family_grants.accepted_at`). The student sees whether it was accepted.
7. **The student sees every read.** Each time the recipient opens a shared
   item, a row is written that the student can see: who, what, when
   (`accommodation_access_events` is the model).
8. **The student sees exactly what the recipient will see, before granting.**
   The preview is the recipient's page, rendered from the same data, not a
   description of it. `familyPreview` already does this on the device.
9. **Nothing is sent for the student.** The app makes an invite code; the
   student hands it over however they like. No email, text or notification
   leaves the app on their behalf.
10. **Nothing is inferred.** The recipient sees what was shared, as it was
    recorded, with its source label. No summary score, risk flag, "on track"
    judgement or trend is computed for the recipient. (The brief prohibits
    hidden academic-risk scoring; a supporter view is where it would creep in
    first.)

## 2. What already exists

| Piece | Where | State |
|---|---|---|
| Family plan: 10 categories, access `none / selected / view / payment`, expiry, revoke, preview | `app/src/lib/family.ts`, `screens/Family.tsx`, `semester.family.v1` | Device-only. By its own header, "It grants nothing". |
| `family_grants` table: per category, `resource_ids`, `accepted_at`, `expires_at`, `revoked_at`, RLS from `allowsFamilyRequest` | `supabase/migrations/20260921161500_roles.sql:69`; `packages/institution/src/index.ts:430` | Applied, but no code writes or reads it. |
| Family invites: 8-character code, claim = accept | `claude/inspiring-goldberg-kv3yzn`, `supabase/migrations/20260922015000_family_invites.sql` | Branch, 5 days old, no PR. Solves "the parent has no account id yet". |
| `accommodation_shares` + `accommodation_access_events` + `read_shared_accommodation()` (security definer, re-checks expiry and revocation on every read, logs the read) | `supabase/migrations/20260926150000_expansion_roles_and_features.sql:550-627` | Applied. The best existing model of a staff share. |
| `support_access_grant` / `support_access_event` | `20260925103000_support_access.sql` | Applied; support staff, not this. |
| Athletics: schedule (practice, competition, travel), class conflicts, hours log, eligibility checklist, travel study pack, absence drafts | `lib/athletics.ts`, `screens/Athletics.tsx`, `components/TravelPack.tsx`, `components/AbsenceNotices.tsx` | Device-only. The screen says staff actions need verified access. |
| Roles: `learning_center_staff`, `athletics_compliance_officer`, `counseling_liaison` … | expansion migration :40-80 | Seeded; `athlete` is a `student_context`, not a role. |
| Advisor shares | D-016 (other session): `advisor_shares` modelled on `accommodation_shares` | Proposed; not built. This design must not diverge from it. |

## 3. One pattern, three tables

Supporter, advisor and athletic-support sharing are one consent pattern
applied to three different relationships. The pattern is shared; the tables
are not.

- **Supporter (family)** keeps `family_grants` and finishes the invite flow
  from the existing branch. A supporter is not an institution role, so
  nothing about it goes through `role_grants`.
- **Athletic academic support** gets its own table, `support_shares`,
  modelled column for column on `accommodation_shares` (and on D-016's
  `advisor_shares`): one staff recipient, a term-bounded expiry, revocation,
  an access-event table and a security-definer reader.
- **Why not one table for all three:** a single table would let a bug in one
  relationship's policy leak another's. A parent must never be able to read
  through a staff policy, and a staff member must never read through a family
  one. Three narrow tables with one shared check suite
  (`supabase/expansion.check.sql` style) is the safer shape.

The client side is one module: a `lib/sharing.ts` that knows the rules in §1
and renders every share (any of the three) in one **Sharing** list on Me →
Privacy, where the Trust Center (the other session's Phase N) already plans
to list active shares.

## 4. Athlete academic-support sharing

### Who can receive it

A named staff member who, **at the time of each read**, holds an academic
support role at the student's school. If they lose the role, the share stops
working without anybody revoking it.

Which role that is needs deciding (§9, D1). `learning_center_staff` exists;
there is no role for athletic academic advisors or learning specialists, who
at most schools are a separate unit inside athletics.

**`athletics_compliance_officer` is not a recipient.** Compliance enforces
eligibility; academic support helps a student meet it. Letting the office that
decides eligibility read a student's study data turns a support tool into an
evidence file. The same goes for coaches.

### What can be shared (the student picks items, per share)

| Item | What the recipient sees | Default |
|---|---|---|
| Travel and competition dates | Date ranges and the classes each one misses, from `athletics.ts` `runsOver` | Offered |
| Missed-class list, per course | Course code, date, whether the student has contacted the instructor (their own tick) | Offered |
| Absence notices | The student's own drafts, marked "draft — sent by the student" or "sent", as they recorded it | Offered |
| Travel study pack progress | Which packs exist and which items are marked done. Not the materials | Offered |
| Term course list | Course codes and titles | Offered |
| Upcoming deadlines during travel | Title and date, with the source label (Institution verified / Imported / Student entered) | Offered |

### What is never offered in the athlete share

- Grades, GPA, standing and "readiness" ranges: the brief bars hidden
  academic-risk scoring, and a grade is an education record the school's own
  systems already release under their own consent process.
- NIL deals and income (`nil.ts` is device-only and stays so).
- The countable-hours log (`athletics.ts` hours): it is compliance evidence,
  and the student keeping it for themselves is the point.
- Health, counselling, accommodations (these have their own flow), finances,
  location, messages.

## 5. Supporter view

### Categories and access, tightened for the pilot

The ten categories in `FAMILY_LABELS` stay.

**Correction, made while building slice 1.** The first version of this table
described `view` as "the whole category". It is not, and never was:
- `allowsFamilyRequest` (`packages/institution/src/index.ts`) reads only
  items named in `resourceIds`, for `view` and `selected` alike.
- `familyPreview` does the same, and the Family screen labels `view` as
  "View selected items".

So rule 3 was already enforced for both levels. D5's decision stands, and its
effect is:

| Access | Pilot | Why |
|---|---|---|
| `none` | Default | |
| `selected` | **The one granting level offered** | Named items only (rule 3). |
| `view` | Not offered; a stored `view` is read as `selected` | It already meant the same named items, so two labels for one behaviour only confused the choice. |
| `payment` | Off | No billing exists (D-009); nothing can be paid through Semester. A stored `payment` shows nothing, as it already did. |

Two categories keep their current narrow meanings and the design holds them
there:

- **`health-admin`**: administrative items only (a form is due, insurance
  waiver deadline). Never a record, a diagnosis or an appointment. The item
  editor refuses free text in this category beyond a title and a due date.
- **`emergency`**: public campus information only (the emergency line, the
  alert sign-up page). Never the student's location or schedule.

### What a supporter sees

A read-only page: "Shared by <student> until <date>", then each item as the
student wrote it, with its source label and due date. Items the student
marks done show as done. There is nothing to click that changes anything,
and no message box: a supporter who wants to ask something asks the student.

## 6. The lifecycle, the same for both

1. **Draft (on the device).** The student picks the recipient type, the
   items and an expiry. Nothing leaves the device. (Family already works
   like this.)
2. **Preview.** The exact recipient page, rendered from the draft, with the
   expiry and "they will see only these N items".
3. **Confirm.** One explicit button naming the person, the item count and the
   end date. This is the first moment anything is written to the server.
4. **Invite code.** 8 characters (the existing branch's format), single use,
   valid for 7 days, revocable before it is claimed. The student hands it over
   themselves (rule 9).
5. **Claim = accept.** The recipient signs in (a supporter creates an account
   if they have none) and enters the code. For staff, the claim also checks
   the role (D1). The grant's `accepted_at` is set; the student's list shows
   "Accepted <date>".
6. **Reads.** Each read goes through a security-definer function that
   re-checks expiry, revocation and (for staff) the role, then logs the read.
7. **End.** Expiry, the student's revoke, or (staff) loss of role. The
   recipient sees "This share has ended" with no further detail.

**Editing a live share** narrows it immediately (removing an item) but
**widening it** (adding an item, extending the date) creates a new preview
and confirmation. A share only ever becomes broader through step 3.

## 7. Threats this has to survive

| Threat | Mitigation |
|---|---|
| Pressure to share: a parent or coach insists | Short maximum expiry; revoke is silent to the recipient (D3); the student can narrow at any time; the access log shows whether it is being read. The app cannot remove pressure, and does not claim to. |
| A forwarded or intercepted invite code | Single use, 7 days, revocable before claim; the student sees who claimed it and can revoke. |
| A recipient screenshots or copies | Cannot be prevented, and the preview says so: "Anything shared can be copied by the person who sees it." |
| A staff member changes jobs | Role re-checked at every read, not only at claim. |
| Share outlives the relationship | Mandatory expiry, at most one term (200 days). |
| One policy bug exposes another relationship | Three tables, one check suite (§3). |
| A supporter infers what was not shared | No computed summaries, counts across categories, or "last active" timestamps on the recipient side. |
| Account compromise of the recipient | Expiry, and the student's read log shows unexpected reads. |

## 8. Build plan, once decided

Each slice is small and would ship behind approval of its migration:

1. **Client consent model**: `lib/sharing.ts` (the rules in §1, pure and
   tested), the Sharing list on Me → Privacy, previews. No server.
2. **Supporter invites**: port the existing branch's migration and check
   file; finish claim and read in the app. **Needs approval to apply a
   production migration.**
3. **Supporter recipient page**: read-only, through a security-definer reader
   that logs reads.
   *Built (D-038): the student's confirmation stores a copy of the named
   items with the code; `read_family_share()` re-checks and logs every read.*
4. **`support_shares`**: migration modelled on `accommodation_shares`, check
   suite extended. **Needs approval.**
   *Built (D-039): modelled on `advisor_shares` as well, so the two staff
   shares match; the role is re-checked at every read.*
5. **Athlete share UI**: item picker from `athletics.ts`, preview, recipient
   page.
   *Built (D-039, slice 5 note): Athletics → Share. Absence notices and
   travel-pack progress are shown but not offered, because Semester keeps no
   record of either; nor of "contacted the instructor".*

Each ships with the check suite proving: a non-recipient reads nothing; an
expired, revoked or unaccepted share reads nothing; a staff recipient without
the role reads nothing; every read is logged; the student can list and revoke.

## 9. Decisions needed from the owner

- **D1. Who is the athletic academic-support recipient?** Options: reuse
  `learning_center_staff`; or add a role such as
  `athletic_academic_support`. Recommendation: add the new role, because the
  learning center and athletic academic support are different offices at most
  schools, and a share should name the one the student meant.
- **D2. Is `athletics_compliance_officer` excluded as a recipient?**
  Recommendation: yes, and coaches too (§4).
- **D3. Does the recipient learn that a share was revoked?** Recommendation:
  only "This share has ended", the same words as expiry, so revoking cannot
  be distinguished from time running out.
- **D4. Maximum expiry?** Recommendation: the end of the current term, capped
  at 200 days, matching `accommodation_shares`.
- **D5. Pilot access levels for supporters.** Recommendation: `selected` only;
  `view` and `payment` off (§5).
- **D6. Adopt the family-invite branch's migration** (8-character code,
  claim = accept) rather than redesigning it. Recommendation: yes; it answers
  the problem it names, and it is five days old with no PR.
- **D7. Consent language.** Before the pilot, the school's registrar and
  compliance office should review the preview and confirmation wording
  against their FERPA consent requirements. This design does not decide that.

Recorded as D-037.
