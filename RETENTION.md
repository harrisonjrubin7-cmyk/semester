# How long this project keeps things

The schedule exists. It was never written down in one place, which is a
different problem from not having one, and it is the problem this file is for.

Several clocks run today, and everything else follows an explicit deletion or
institutional-retention decision. They span migrations, Edge Functions and
scheduled jobs, and the promise they are all held to is a paragraph on a
screen.
Nobody deciding whether this project is safe to pilot could have assembled that,
and the first person who had to would have been assembling it under pressure.

`app/src/lib/retention.test.ts` is the tripwire. It is bidirectional, in the
shape [`SECURITY.md`](SECURITY.md) uses: every table in the schema must appear
here, and every table named here must exist. A table added later with no
retention answer is the failure this catches, and it is silent otherwise —
nothing goes red, the document still reads well, and the answer is missing on
the day somebody needs it.

## The promise this cannot break

`app/src/lib/privacy.ts` tells every student, on a screen in the app:

> **How long anything is kept.** Until you delete it. There is no retention
> schedule that quietly removes your work, and no archive kept after you delete
> your account. Nothing is used to train anything. The one thing that does age
> out is not your work but a record about it: the log of who has read your rows,
> described below, keeps ninety days and drops what is older.

That is a commitment, not a default, and it decides the shape of everything
below. **A retention schedule here may age out records _about_ a student's work.
It may not age out the work.** Adding a clock to `notes`, `tasks`, `courses`,
`state` or anything else a student typed would make that paragraph false, and
the paragraph is load-bearing — `VANDERBILT-AUDIT.md` and the competitive
review both rest the product's honest-privacy claim on it.

So "no retention schedule" is not a gap in this project. It is the decision.
What was missing is the sentence saying so, and the list of the exceptions.

## The clocks that run

| What | Kept | Where it is enforced | How it runs |
| --- | --- | --- | --- |
| `access_log` | **90 days** | `supabase/migrations/20260921143653_access_log.sql` | On write, inside `note_access()`, scoped to the account being written to |
| `activity` | **400 days** | `supabase/migrations/20260921151000_activity.sql` | On write, inside `note_activity()`, scoped to the account being written to |
| `gateway_review` | **Unconfirmed reviews: one day after expiry; completed/refused reviews: ninety days after expiry; unresolved processing/pending/uncertain reviews: until reconciliation** | `private.gateway_purge_journal()` in `supabase/migrations/20260924184500_gateway_action_journal.sql` | Server-only hourly sweep; encrypted bodies remain inaccessible to browser roles |
| `gateway_audit`, `gateway_intelligence_audit` | **180 days** | `private.gateway_purge_journal()` in `supabase/migrations/20260924184500_gateway_action_journal.sql` | Server-only hourly sweep; metadata only, never source text, prompts or model prose |
| `gateway_rate_limit` | **One day** | `private.gateway_purge_journal()` in `supabase/migrations/20260924184500_gateway_action_journal.sql` | Server-only hourly sweep of fixed-window counters |
| `gateway_intelligence_action` | **Unconfirmed actions: one day after expiry; claimed actions: ninety days** | `private.gateway_purge_journal()` in `supabase/migrations/20260924184500_gateway_action_journal.sql` | Server-only hourly sweep; action bodies are encrypted and single-use |
| `gateway_health_probe` | **One singleton row, overwritten by readiness probes and retention sweeps** | `private.gateway_journal_health()` and `public.gateway_purge_journal()` in the two pending gateway migrations | Upsert; contains only successful write and retention-sweep timestamps |
| `push_queue` | **Until sent** | `supabase/functions/push/index.ts` | Deleted per account by id after a successful send |
| `push_devices` | **Until a gateway has said it is gone twice running** | `supabase/functions/push/index.ts` | A 404 or 410 *marks* the row (`gone_at`); still gone on the next run retires it, and any success clears the mark |
| Tombstones in `notes`, `tasks`, `appointments`, `sittings`, `courses` | **90 days after deletion** | `public.sweep_tombstones`, in `supabase/migrations/20260901000700_records.sql` | `pg_cron`, weekly — the `tombstones` job in `supabase/scheduler.sql` |

### This file describes the repository, and the repository is not the database

Every row above was read out of the migration or the function that enforces it.
That is the right source for *what the rule is* and the wrong one for *whether
it is running*, and on 21 September [`MIGRATION-HISTORY.md`](MIGRATION-HISTORY.md)
established the difference: four migrations in `supabase/migrations/` have never
been applied to production — `usage_atomic`, `group_columns_pinned`, `forms` and
`access_log` — verified object by object rather than inferred, with the project's
schema deploy recorded as `MIGRATIONS_FAILED` since three minutes after the
`access_log` merge.

So for three days two things in this file were claims about a schema production
did not have: `access_log`'s ninety days was not running, because the table and
`note_access()` were not there, and `forms` and `form_responses` were named in
the account-deletion table for the same reason. Neither contradicted the
privacy page, which promises a *ceiling* on what is kept rather than a floor;
both were this file describing intent as though it were deployment, which is
the error it exists to prevent.

**Closed 21 September, and re-read on the 22nd rather than assumed.** All four
are in production's ledger — `usage_atomic`, `group_columns_pinned`, `forms`,
`access_log` — and the objects are there: `public.access_log`, `public.forms`,
`public.form_responses`, `public.note_access()`. The ninety-day clock in the
row above is running. `MIGRATION-HISTORY.md` carries how the deploy was
repaired and *The deploy, observed* is the section that reports it working.

The sweep that the row for `notes`, `tasks`, `appointments`, `sittings` and
`courses` relies on is also live now: the `tombstones` job in
`supabase/scheduler.sql` read active on `17 4 * * 0` off `cron.job` on
22 September, with no run yet because no Sunday has passed.

The whole push queue is also deleted immediately when a student switches
reminders off — that is in the privacy text above and is a user action rather
than a clock, but it is the reason the queue never holds much.

**One row above is easy to write down wrong, and this file did.** It said a 404
or 410 retires the device. It does not, and the difference is the whole reason
`gone_at` exists. A single rejection only marks the row; a device is deleted
only if the *next* run finds it gone as well, and an endpoint that answers at
any point in a run is neither marked nor retired — proof that it is alive
outranks proof that it is not. `functions/push/index.ts` is explicit that a
single 404 deleting the device is "exactly the behaviour the column exists to
prevent", because the failure is silent: the phone just stops getting
reminders and no screen has anything to say about it. So the retention here is
two consecutive failed runs, not one rejection, and this file described the bug
that was fixed rather than the code that fixed it.

`access_log` prunes on write rather than on a schedule, and the migration says
why: a `pg_cron` entry is a third thing to deploy and a fourth thing to notice
has stopped. The cost is that a dormant account's log is not pruned until
something touches it again, which is a property worth knowing and not a defect —
the rows are per account per day per client family, never an address and never a
user agent.

## The tombstone sweep, and the decision behind it

`public.sweep_tombstones(older_than interval default '90 days')`, in
`supabase/migrations/20260901000700_records.sql`, deletes soft-deleted rows from
`notes`, `tasks`, `appointments`, `sittings` and `courses`.

**For a long time nothing called it.** It is revoked from `public`, `anon` and
`authenticated`, so it is not reachable from the API, and for weeks the only
caller anywhere in this repository was `supabase/records.check.sql` — the test
suite. So the live state was that a row a student deleted left a tombstone kept
indefinitely. That was never a contradiction of the privacy page above: a
tombstone is `{ id, deleted_at }` with the content already gone. But
"indefinitely" was a decision nobody had taken, and this project *does* have
`pg_cron` — `supabase/scheduler.sql` already runs the push job on it.

**It is scheduled now**, as the `tombstones` job in `scheduler.sql`: weekly, at
04:17 UTC on Sunday, at the function's own ninety-day default. The migration's
header asked for exactly this and said what it wanted first —

> Not scheduled here. Run it by hand, or attach it to `pg_cron` if you have it —
> an automatic job that deletes rows is not something this file should switch on
> without you having read this paragraph.

— and the paragraph it points at is the reasoning this rests on: *"Ninety days
is far longer than any device is plausibly offline and short enough that the
tables do not accumulate a term of deletions."*

**What it costs, stated rather than buried.** A tombstone is what stops a
deletion being resurrected by a device that was offline when it happened.
Deleting one after ninety days means a device offline for longer than that,
still holding the row, syncs it back as though it were new. Ninety days is
where `records.sql` drew that line, and this schedule adopts it rather than
re-arguing it.

Two smaller properties worth knowing. The job is **active**, unlike `push`,
which is parked until its Edge Function has a secret — this one calls a
function that is already there and waits for nothing. And it is **weekly rather
than nightly**, because the work is proportional to deletions rather than to
the size of the tables, so running it seven times as often would delete the
same rows seven days sooner and buy nothing.

**This is not covered by `supabase/check.sh`.** That harness applies the
migrations to a throwaway Postgres that has no `pg_cron`, so no `.check.sql`
suite can see a schedule. What holds it instead is
`app/src/lib/retention.test.ts`, which pins this document and `scheduler.sql`
to the same interval and the same job name — a sweep silently unscheduled, or
rescheduled at a different retention than the one written here, goes red there.

## Everything else: until you delete it

Every remaining table is kept for the life of the account and removed when the
account is deleted. That path is `deleteEverything` in `app/src/lib/cloud.ts`,
which sends one delete per table under row-level security, and it is checked two
ways: `app/src/lib/privacy.test.ts` reads every module that writes a table and
fails if one is missing from the list, and `supabase/deletion.check.sql` proves
the policies actually permit each delete against a real Postgres.

That pairing matters more than it looks. A delete the policies refuse returns
`row_count = 0` rather than an error, so a forgotten delete policy is a row left
behind and a client that believes it succeeded.

| Table | Kept until | Notes |
| --- | --- | --- |
| `state` | account deletion | the sync payload |
| `courses` | account deletion | soft-deleted rows leave a tombstone — see above |
| `usage` | account deletion | which screens have been opened, and the day each last was |
| `notes`, `tasks`, `appointments`, `sittings` | account deletion | soft-deleted rows leave a tombstone — see above |
| `profiles`, `enrollments` | account deletion | |
| `messages`, `message_reactions` | account deletion | |
| `groups`, `group_members`, `group_tasks` | account deletion of the member | a group you started **stays** — other members rely on it. `KEPT_TABLES` in `deletion.check.sql` holds the three exceptions with the reason the privacy page prints |
| `forms`, `form_responses` | account deletion | |
| `calendar_feeds` | account deletion | the published feed token; the Export screen can retire and reissue it |
| `connections` | account deletion of **either** end | both columns are `on delete cascade`, which is the whole answer and is deliberate: a connection is a fact two accounts agreed on, so it cannot outlive either of them. There is no tombstone and no sweep — the row *is* the agreement, and a removed connection is removed rather than marked, because "we kept a record of who you used to be connected to" is not a sentence this project wants to be able to say |
| `reports` | account deletion of the reporter | |
| `feedback` | account deletion of its author | what somebody said was wrong, with the screen *shape*, device class and build the app supplied — never a route, a user-agent or an address, and the check constraints in `20260921215800_feedback.sql` are what make that a property of the database rather than a promise about `lib/feedback.ts`. No clock: a bug report is worth keeping until the person who sent it leaves, and there is no version of "we aged out your bug report" that helps anybody. Readable and deletable by its author, never rewritable by anyone |
| `schools` | **never**, by any account's deletion | reference data, not anybody's record: the list of universities the server recognises, written only by an admin and readable by everyone. No account creates a row here, so no account's departure can take one. `profiles.school_id` points at it and is cleared to null when a school is removed, which is a school closing rather than a student leaving |
| `blocks` | **not** lifted by deletion | keyed on `blocked`, not `user_id`, so deleting your account cannot undo somebody else's protection. This is deliberate and `deletion.check.sql` pins it |
| `push_devices`, `push_queue` | see the clocks above | |
| `access_log` | 90 days, see above | readable by the account it is about, which is the difference between an audit log and an operator's private diary |
| `activity` | 400 days, see above | one row per account, day and mark, for the three figures the pilot is judged on. Readable by the account it is about, for the same reason the access log is. `ANALYTICS.md` is what it is for; `lib/privacy.ts` names it on the screen |
| `referral_codes` | account deletion | one generated code per ambassador. Deleting it takes every `referrals` row pointing at it, by the foreign key — an ambassador who leaves is not remembered by a count of who they recruited |
| `referrals` | account deletion, of either side | the row saying which code an account arrived on. It goes when that account is deleted, **and** when the ambassador whose code it names is. Never readable by the ambassador: it is a count on their screen and nothing else |
| `lti_platform` | **kept until an administrator removes it** | not personal data at all: one row per Brightspace deployment of this tool, holding an issuer, a client id and two public URLs. It is configuration a school installed, and it outlives every student who launches through it — deleting it on any account's deletion would uninstall the integration for everybody |
| `lti_nonce` | minutes, swept an hour past expiry | the one-time state and nonce of a launch in flight, and deliberately nothing about the person: no subject, no name, no course. It exists for the few seconds between redirecting a student to Brightspace and Brightspace posting back, is single-use, and `sweep_lti_nonce()` deletes what is an hour past expiry. There is nothing here for an account deletion to reach, which is the point of it carrying no identity |
| `family_grants` | account deletion of the student | what a student let one named person see, per category and per named thing, with an expiry of its own. It is the student's statement, so it is keyed on the student's column and goes when they do. **A recipient deleting their account does not take it** — `OWNED_TABLES` sends one filter per table and that filter is the student's — so a parent who leaves is still named by a grant until the student revokes it or it lapses. `supabase/family.check.sql` proves either party *may* delete one; the button does not yet send both |
| `app_admins` | account deletion, by cascade only | who may open the internal administrator dashboard. Not written or readable through the API by anyone, including the administrator it names, so no client deletes from it — the row goes when the `auth.users` row does. Deleting everything does not remove the sign-in itself, so an administrator who empties their account is still an administrator |
| `lti_identity` | account deletion | which Semester account a Brightspace launch opens. It cascades on the account it points at, so deleting your account unbinds the launch too — and a later launch from the same school provisions a fresh account rather than reopening a deleted one, which is the correct reading of having asked to be forgotten |
| `lti_link_ticket` | minutes, swept an hour past expiry | the single-use proof that a launch was validated, held only long enough for a student to say they already have an account. It names no person: an issuer, an opaque subject the platform chose, and the account the launch just made. Cascades with that account, and sweep_lti_link_ticket() removes what is an hour past expiry |
| `lti_line_item` | account deletion, by cascade through `lti_identity` | which Brightspace gradebook column a course's link owns, so a quiz score can find its way back. A row exists only when an instructor placed the link as a *graded* activity — the launch says so, and an ordinary link writes nothing here. It holds addresses and a course title, never a score: the number goes to the platform and is not kept on this side. Keyed to the identity rather than the account, so retiring a provisioned account in favour of the student's own takes the memory of where their grade went with it, which is the correct reading of the binding having moved |
| `organizations` | **never**, by any account's deletion | a student organization outlives everybody in it, which is what distinguishes it from a study group. `organizations.created_by` is `on delete set null`, so a founder who deletes their account leaves the organization standing with no founder recorded — the opposite of `groups.created_by`, and for the opposite reason: a group is its four people, an organization is not its founder |
| `organization_members` | account deletion | your standing in an organization and the capabilities that go with it. Both API roles are off DELETE on the table — the row is somebody else's judgement about you, and a table anybody can delete their own row from is one an applicant can un-decline themselves in — so it goes through `forget_my_organizations()`, which takes the `DECLINED` and `REMOVED` rows that leaving refuses to touch. If you were the only administrator the organization is left with none and any member can take it on; if you were the last member it goes with you |
| `role_grants` | account deletion of the **subject**, by cascade. The grantor's deletion does not take it | which roles somebody holds, over what, and who said so. Not writable through the API at all, so no client deletes from it — the row goes when the `auth.users` row it names as subject does. `role_grants.granted_by` is ON DELETE SET NULL on purpose and is the asymmetry worth reading twice: removing a member of staff must not silently strip the roles they granted, so the grant survives them and forgets who made it. **Revoked and expired rows are kept, not swept**, and that is a decision rather than an omission — the select policy lets a person read their own revoked grants, which is how somebody finds out why a workspace they had yesterday is gone. The cost is that the table remembers every role an account ever held for as long as the account exists; if that becomes the wrong trade, the sweep belongs beside `sweep_lti_nonce()` and should keep the most recent revocation per scope rather than delete blindly |
| `app_roles`, `app_capabilities`, `role_capabilities` | **kept until a migration changes them** | not personal data and not anybody's rows: the twenty roles, the fourteen capabilities and the matrix between them, identical for every account. Written only by migration — no client may insert, update or delete, and there is no write policy on any of the three — so there is nothing here an account deletion could reach and nothing it should. Readable by any signed-in account, because item 240's context switcher has to know which tools a role carries and every row of it is printed in `docs/ROLE_REQUIREMENTS.md` anyway. The same answer `lti_platform` has, for the same reason: configuration outlives the people it applies to |
| `tenant_feature_policy`, `ai_policy` | **kept until a tenant administrator changes it or the school is removed** | institutional configuration rather than a student's work. Both cascade with `schools`, and no account deletion removes the policy a whole campus relies on. Each change is preserved separately in `tenant_policy_audit_event` |
| `approved_source` | **kept until a tenant source approver removes it or the school is removed** | a course-source decision belongs to the institution, not the staff account that made it. The created-by field identifies the approver while that account exists; removal is an explicit institutional action and is audited |
| `consent_record` | account deletion of the **subject**, or school removal | the student's versioned decision. It cascades with both the student and tenant, can be changed only by the student it names, and is not aged out while the account exists because a consent-sensitive recording needs the decision that governed it |
| `evidence_reference`, `concept_evidence`, `mistake_evidence` | account deletion, or school removal | provenance and learning evidence are tenant- and person-scoped. A reference cascades with the student or school; concept and mistake rows cascade with the reference. They are not silently aged out while the account exists, because removing the evidence would make a mastery recommendation impossible to explain |
| `skill_claim`, `skill_claim_evidence` | account deletion, or school removal | a claim belongs to one student in one tenant and cascades with either. Its evidence links cascade with the claim or referenced evidence. Institution verification does not change ownership or retention, and deleting the verifier clears only the verifier field |
| `capture_asset`, `capture_segment`, `capture_artifact` | account deletion, school removal, or explicit deletion by the student | each original is bound to a versioned `consent_record`; segments and derived artifacts cascade with the original. Consent withdrawal or expiry immediately marks the original removed and its derivatives withdrawn, making them unreadable through row-level policy, but **does not physically delete those rows**. The per-asset retention timestamp also prevents expired material from being treated as active, but no scheduled deletion job exists yet; a tenant that requires timed physical erasure must add and verify that job before production |
| `tenant_policy_audit_event` | **kept until the school is removed** | the append-only institutional record of feature, AI, source and consent changes. Deleting an actor clears the actor and actor-grant references rather than deleting the event, preserving the fact and timing of the institutional action without retaining a deleted account's identity. A time-based institutional retention schedule must be added before production if a university requires one; none is silently implied here |
| `role_grant_audit_event` | **kept until an approved institutional audit-retention process removes it; no time-based purge exists today** | append-only evidence of future role grants, changes, revocations and deletions. It stores tenant/scope/role metadata plus SHA-256 pseudonyms, never raw account IDs, names or email addresses. Account and school deletion therefore do not silently erase or rewrite the evidence. Vanderbilt must approve a retention period or documented legal basis before production; implementing that decision requires a narrowly authorized purge path because ordinary updates and deletes are deliberately refused |
| `moderation_audit_event` | **kept until an approved trust-and-safety retention process removes it; no time-based purge exists today** | append-only evidence of report-status transitions. It stores the report identifier, before/after status and SHA-256 pseudonyms for the reporter, reported account and actor; it never copies the complaint, message, name or email address. Account deletion does not silently erase or rewrite this operational evidence. Legal/privacy review must approve its retention period or documented basis before production; ordinary updates and deletes are deliberately refused |
| `support_access_grant` | becomes unreadable on consent withdrawal, explicit student revocation or its seven-day maximum expiry; physically removed on account deletion of either party or school removal | one student, one verified supporter and the single `learning-progress` aggregate scope. Every read rechecks the role, tenant, consent, recipient, expiry and revocation. Raw notes, excerpts, recordings and mistake detail are never granted. No scheduled expiry purge exists yet, so an approved institutional retention period is still required |
| `support_access_event` | **kept until an approved institutional audit-retention process removes it; no time-based purge exists today** | immutable evidence of grant lifecycle and aggregate signal reads. It stores tenant, grant, fixed scope, expiry/revocation timestamps, action, time and SHA-256 pseudonyms in typed columns, never names, email, free-form reasons, notes, source text, recordings, protected traits or emotion inference. Account or school deletion removes the live grant but deliberately leaves this pseudonymous evidence |
| `institution_identity_provider` | **kept until a tenant administrator removes the provider or the school is removed** | institution-wide SAML configuration, not one account's data. Disabling a provider stops new authorization without erasing the record needed to explain existing memberships |
| `institution_membership` | **kept until the school is removed or the approved institutional retention process removes it** | current and deprovisioned institutional access. Account deletion clears the linked Auth user rather than erasing the institution's lifecycle record; deprovisioning immediately clears roles and access. Vanderbilt must approve the time-based retention period before production — the repository does not silently invent one |
| `scim_credential` | **kept until a tenant administrator removes it or the school is removed** | salted verification material and lifecycle timestamps, never the bearer token. Revocation makes it unusable immediately; retaining the revoked row prevents its identity from being silently reused and supports provisioning audit evidence |
| `scim_external_identity` | **kept with its institutional membership until the approved retention process removes it or the school is removed** | the tenant-scoped SCIM external identifier, user name and group identifiers needed for idempotent provisioning, deprovisioning and explicit reactivation. It is not treated as student-authored work and is not silently removed on account deletion |
| `scim_group_mapping` | **kept until a tenant administrator removes the mapping or the school is removed** | administrator-approved group-to-role configuration. Unknown groups grant nothing; removing a mapping is an explicit institutional policy change rather than an account-deletion side effect |
| `provisioning_audit_event` | **kept until the school is removed, unless an approved institutional schedule is added** | immutable metadata-only evidence of provisioning decisions. It contains request, tenant, credential and resource identifiers but no SCIM bearer secret or academic content. Vanderbilt's legal/privacy review must set a time-based period before production if required |
| `approved_source_content` | **kept until its approved source is removed** | server-only course-source text, evidence identifiers and a checksum. It cascades with `approved_source`, is never readable by browser roles, and is the only source body the institutional model gateway may send to an approved provider |
| `ai_usage_month` | **the tenant AI policy's retention-days setting** | monthly aggregate cost and token counts with no prompt, response or source text. `private.sweep_ai_runtime_metadata()` removes expired rows daily through the `ai-runtime-metadata` scheduler job |
| `ai_usage_reservation` | **five minutes against budget; physically removed after the tenant AI policy's retention-days setting** | metadata-only provider budget reservations. A crashed request stops counting after its explicit expiry; the same daily cleanup removes settled, released and expired rows, with no prompt or academic content stored |
| `student_context`, `term_plan_courses`, `registration_time_tickets`, `seat_watches`, `graduation_scenarios`, `cost_plans`, `ai_memories`, `weekly_checkins`, `contact_channels`, `onboarding_progress`, `study_match_optins` | account deletion | the student's own planning, preferences and reminders, from `20260926150000_expansion_roles_and_features.sql`. Each is readable and deletable only by its owner (study opt-ins also by other opted-in students in the same section; onboarding progress also by an accepted, unexpired peer mentor). `study_match_optins` also lapses from view after its own expires_at |
| `transfer_evaluations` | account deletion | the student's estimate or request. The institution's decision arrives through the service role and goes with the account |
| `skill_records` | account deletion | a skill the student recorded and, if they asked, who verified it. The verifier's deletion clears verified_by and leaves the record |
| `talent_profiles`, `talent_profile_views` | account deletion of the student; a view also on the profile's deletion | consent to be found **lapses** on expires_at (180 days by default, at most a year) and is renewed rather than remembered. A viewer's deletion clears viewer_id and leaves the student's record that they were viewed |
| `peer_mentor_assignments` | account deletion of **either** end | ends early on revoked_at by either person, and cannot be reopened; lapses on expires_at (at most 200 days) |
| `accommodation_passports` | account deletion of the student, or school removal | a functional summary issued by disability services, never a diagnosis. Expires on its own clock (at most 400 days). The issuer's deletion clears verified_by |
| `accommodation_shares`, `accommodation_access_events` | account deletion of either the student or the instructor; events go with their share | a share lapses on expires_at (at most 200 days) or the student's revocation; the events are the student's record of every read |
| `course_reviews` | **kept after the author's deletion** — see the note | the review is anonymous by construction: authorship is in `course_review_authors`, which goes with the account. What stays is a workload figure and two ratings with nobody attached, so a department's picture of a course does not vanish when one student graduates. Removed by a moderator (status = 'removed') or with the school |
| `course_review_authors` | account deletion | the only link between a review and a person |
| `alumni_mentor_offers` | account deletion, or school removal | |
| `data_requests` | **kept after the requester's deletion, with user_id cleared** | a deletion request has to outlive the account it deleted, or nobody can show it was honoured. It carries the kind, the status and the dates, and after deletion no person |
| `registration_windows`, `catalog_sections`, `articulation_rules`, `institution_actions`, `opportunities` | **kept until the publisher withdraws or removes it, or the school is removed** | institutional publications, not a student's data. A publisher's deletion clears published_by / proposed_by / approved_by / publisher_id and leaves the row. An institution action targeted at one student goes with that student |
| `course_demand_snapshots`, `outcome_aggregates` | **replaced on every refresh; removed with the school** | aggregates of ten or more students, enforced by a check constraint, counting only students who opted in. No row names a person, so no account's deletion takes one — the next refresh simply counts one fewer |
| `invites`, `access_gate` | **no answer yet** — see below | |

## What has no answer, stated rather than rounded off

Two, and neither is urgent, and both should be answered before a pilot grows
past people the owner knows by name.

A third was here until `20260921234500_organization_succession.sql`: what
deleting an account does to a membership, when the only administrator of an
organization cannot be allowed to leave it locked and a cascade cannot be
refused. The answer is in the table above and in that migration's header — the
organization is left with no administrator, which is honest, and any member can
take it on.

- **`invites` is an allow-list of email addresses with no expiry.** The table is
  `(email, invited_at, note)` and nothing removes a row. Somebody invited to a
  pilot in September is still an invited address indefinitely. It is revoked
  from `anon` and `authenticated` and unreachable from the API, so the exposure
  is small — but an address collected for a pilot that ended is a record kept
  for no one's benefit, which is the same argument `access_log` was given a
  ninety-day life on.
- **An abandoned account is kept forever.** Nothing ages out an account nobody
  opens again. That is the correct default for coursework — a student who comes
  back in January should find their semester — but it is a default, not a
  decision, and it is the one a data-protection reviewer will ask about.

Neither is a bug. Both are questions this document exists to stop being
invisible.

## Changing any of this

1. Decide it, and write the reason here — this file is the record.
2. If it touches what a student sees, `app/src/lib/privacy.ts` says it in the
   app, and that text is what people are actually told. It wins over this file;
   this file explains it.
3. Run `supabase/check.sh` — the policy suites run against a real Postgres with
   every migration applied, and a retention change that breaks a delete policy
   fails there rather than in production.
4. `npm test` from `app/` runs the tripwire.
