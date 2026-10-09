# How long this project keeps things

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](SEMESTER-OPERATING-SYSTEM.md).

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

> **How long anything is kept.** Your courses, deadlines, notes, plans and other
> study work stay until you delete them, and no archive is kept after you delete
> your account. Nothing is used to train anything. Individual-beta support
> questions not associated with a school deployment are the one content
> exception: a resolved or closed ticket and its replies are deleted 180 days
> after the last activity unless a legal hold requires preservation. A ticket
> associated with a school deployment follows that school's contract instead;
> no automatic school-ticket purge runs until that rule is configured. The
> access log and daily activity records also age out on the clocks below.

That is a commitment, not a default, and it decides the shape of everything
below. **A retention schedule here may age out records _about_ a student's work
and the disclosed support-ticket exception. It may not age out study work.**
Adding a clock to `notes`, `tasks`, `courses`, `state` or other study content
would make that paragraph false, and the paragraph is load-bearing —
`VANDERBILT-AUDIT.md` and the competitive review both rest the product's
honest-privacy claim on it.

So the absence of a study-work retention clock is not a gap in this project.
It is the decision. What was missing is the sentence saying so, and the list
of the disclosed exceptions.

## The clocks that run

| What | Kept | Where it is enforced | How it runs |
| --- | --- | --- | --- |
| `access_log` | **90 days** | `supabase/migrations/20260921143653_access_log.sql` | On write, inside `note_access()`, scoped to the account being written to |
| `activity` | **400 days** | `supabase/migrations/20260921151000_activity.sql` | On write, inside `note_activity()`, scoped to the account being written to |
| `gateway_review` | **Unconfirmed reviews: one day after expiry; completed/refused reviews: ninety days after expiry; unresolved processing/pending/uncertain reviews: until reconciliation** | `private.gateway_purge_journal()` in `supabase/migrations/20260924184500_gateway_action_journal.sql` | Server-only hourly sweep; encrypted bodies remain inaccessible to browser roles |
| `gateway_audit`, `gateway_intelligence_audit` | **180 days** | `private.gateway_purge_journal()` in `supabase/migrations/20260924184500_gateway_action_journal.sql` | Server-only hourly sweep; metadata only, never source text, prompts or model prose |
| `gateway_audit.correlation_id` | **With the row — 180 days** | `private.gateway_purge_journal()` as above; the column is added by `supabase/migrations/20260928320000_audit_correlation_and_outbox.sql` | An opaque request id, held to the gateway's own pattern by a check constraint; never a session token or a name |
| `domain_outbox_events`, `domain_event_receipts` | **Published payloads scrubbed after 30 days; terminal envelopes and receipts expire by class: operational 90 days, student record and commercial 400 days, audit 3 years** | `private.prune_projection_history()` in `supabase/migrations/20261008220000_projection_history_retention.sql` | Manual service-role operation only; pending and dead-lettered work is never touched, and tenant/platform legal holds preserve covered history. No scheduler is enabled |
| `read_model_registry`, `projection_watermark`, `projection_rebuild_run` | **Kept while the projection or read model exists; no sweep, and none needed yet** | `supabase/migrations/20261006130000_projection_foundation.sql` | One row per read model version, per projection version and per rebuild. They hold names, versions, timestamps and a sanitized error of at most 500 characters, no person's content. The entitlement and rollout projectors advance separate watermarks; the bounded worker remains dormant and unscheduled |
| `ops_tenant_entitlement_projection` | **Current row kept while the school exists; replaced in place by newer events** | `supabase/migrations/20261008200000_tenant_entitlement_projection.sql` | One bounded policy id, capability, state/tombstone and source event cursor per school capability. No person, role/cohort list, reason or source prose. The school foreign key cascades on removal |
| `ops_tenant_rollout_projection` | **Current row kept while the school exists; replaced in place by newer events** | `supabase/migrations/20261008230000_tenant_rollout_projection.sql` | One bounded lifecycle state, optional resume state and source event cursor per school. It excludes the transition reason and actor. The school foreign key cascades on removal |
| `projection_invalidation` | **90 days** | `private.prune_projection_history()` in `supabase/migrations/20261008220000_projection_history_retention.sql` | One transient refetch signal per applied projection write; the manual service-role operation honors tenant and platform legal holds. No scheduler is enabled |
| `course_material_retention_policy` | **Version history is kept while the school exists; withdrawal appends a version instead of rewriting or deleting one** | `supabase/migrations/20261009001500_course_material_retention_policy.sql` | Private policy metadata only: tenant, version, active/withdrawn state, retention days, approval/evidence references, actor, correlation and timestamps. One approved `tenant-policy` request is consumed per version with fresh MFA and fail-closed console audit. The table contains no course material or student content; legal hold still governs any material retained under a version |
| `course_materials` | metadata remains while no hold-aware object/metadata purge exists; policy withdrawal blocks new intake but never rewrites an existing row's bound policy version | `supabase/migrations/20261009003000_course_material_metadata.sql` | private institution-published material metadata only: exact tenant/course/term, pseudonymous publisher, planned internal object key, bounded filename/type/size, lifecycle and the exact retention-policy id/version/duration in force at intake. No bucket, object, scan receipt, extracted content or read URL exists in this slice. Rows cannot be physically deleted; a later purge must implement the recorded duration and make tenant/platform legal holds win |
| `course_material_operations` | retained with its course-material metadata; append-only and not physically purged in this slice | `supabase/migrations/20261009003000_course_material_metadata.sql` | bounded idempotency/provenance receipts for plan, withdrawal and restore. Actor identity is pseudonymized and the direct reference clears on account deletion; result metadata contains no filename, key or content. A future hold-aware purge must preserve covered history |
| `gateway_rate_limit` | **One day** | `private.gateway_purge_journal()` in `supabase/migrations/20260924184500_gateway_action_journal.sql` | Server-only hourly sweep of fixed-window counters |
| `direct_rate_limit` | **The limit's own window — at most one day; with the account, by foreign key** | `private.take_direct_rate_limit()` in `supabase/migrations/20260928230000_direct_rate_limits.sql` | On write: each call deletes that account's expired hits for the bucket, plus up to 200 day-old hits from anybody. Holds an account id, a table name and a time — never what was written |
| `gateway_intelligence_action` | **Unconfirmed actions: one day after expiry; claimed actions: ninety days** | `private.gateway_purge_journal()` in `supabase/migrations/20260924184500_gateway_action_journal.sql` | Server-only hourly sweep; action bodies are encrypted and single-use |
| `gateway_health_probe` | **One singleton row, overwritten by readiness probes and retention sweeps** | `private.gateway_journal_health()` and `public.gateway_purge_journal()` in the two pending gateway migrations | Upsert; contains only successful write and retention-sweep timestamps |
| `push_queue` | **Until sent** | `supabase/functions/push/index.ts` | Deleted per account by id after a successful send |
| `push_devices` | **Until a gateway has said it is gone twice running** | `supabase/functions/push/index.ts` | A 404 or 410 *marks* the row (`gone_at`); still gone on the next run retires it, and any success clears the mark |
| Tombstones in `notes`, `tasks`, `appointments`, `sittings`, `courses` | **90 days after deletion** | `public.sweep_tombstones`, in `supabase/migrations/20260901000700_records.sql` | `pg_cron`, weekly — the `tombstones` job in `supabase/scheduler.sql` |
| `invites` never taken up | **90 days after sending, when no account has the address** | `private.sweep_stale_invites()` in `supabase/migrations/20260929030000_retention_sweeps.sql` | `pg_cron`, daily — the `invite-retention` job in `supabase/scheduler.sql` |
| `beta_invitations` never accepted or revoked | **90 days after sending if never accepted; 90 days after revocation** | `private.sweep_stale_invites()`, same migration | The same `invite-retention` job |
| Sign-ups never finished | **30 days after creation, for an account never confirmed and never signed in** | `private.sweep_abandoned_signups()`, same migration | `pg_cron`, daily — the `abandoned-signups` job |
| `role_grant_audit_event`, `moderation_audit_event`, `provisioning_audit_event` | **3 years after the event** | `private.sweep_audit_retention()`, same migration | `pg_cron`, daily — the `audit-retention` job, through a narrowly authorized path the immutability triggers allow only for rows past the period |
| `audit_event` | **3 years after the event**, then removed by the `audit-retention` job | the common audit envelope (`supabase/migrations/20260930000000_audit_and_subject_requests.sql`): a verb, an object kind, an outcome and SHA-256 pseudonyms, never a name, address or content (a 2 KB cap on the details column keeps free text out). Same narrow purge path as the three tables above; ordinary updates and deletes are refused. No school foreign key, so removing a school does not remove the evidence |
| `data_subject_request` | **with the account** — deleting the account deletes its requests | a person's export, erasure, correction or restriction request, its status and its thirty-day due date. The fact that an erasure was completed is kept without an identity in `data_requests`, as before |
| `privacy_completion_certificate` | **kept as completion evidence; the direct subject link is cleared when the account is deleted** | an immutable request reference, SHA-256 subject pseudonym, tenant, request kind, evidence pointer, approval reference and issuance metadata. It contains no request detail. The retention period needs institutional and counsel agreement before a production sweep is added; legal holds and audit obligations take precedence |
| `school_membership_requests` | **with the account** — deleting the account deletes its requests; a school's removal deletes its requests | a person's request to be recognised as a member of a university whose address they do not hold, its status, who decided it and when. Stores no address; the note is capped at 300 characters. Decisions are also kept, pseudonymously, in `audit_event` (three years) |
| `school_offboarding` | **kept as a record; never deleted, even with the school** — a case is the evidence that a departure was proposed, sized, approved by both sides, disabled, exported, verified and archived. Erasing a staff member's account does not touch it: the people it names are uuids with no foreign key | one school's departure: the reason, who proposed and approved (uuids, no names), the dependency inventory (table names and row counts), the student-notice date, the export's hash and row counts and to whom it went, the retention window, and any purge authorization. Holds no student record. The window's length is a placeholder until counsel sets it |
| `school_offboarding_undo` | **kept as a record; never edited or deleted** — it is what lets a restoration give back exactly what was revoked | the ids of the role grants and integration connections an offboarding revoked, and what a connection's status and credential pointer were (a pointer such as `vault:…`, never a secret). No student data |
| `lti_nonce`, `lti_link_ticket` | **An hour past expiry** | `public.sweep_lti_nonce()` and `public.sweep_lti_link_ticket()` | `pg_cron`, hourly — the `lti-nonce` and `lti-link-ticket` jobs |
| `handoff_transactions` | **Fifteen minutes to be used; finished rows seven days** | `public.sweep_handoffs()` in `supabase/migrations/20261006000000_onboarding_journeys_and_handoff.sql`, and the table's own check that a hand-off cannot outlive fifteen minutes | `pg_cron`, daily, the job named handoffs in `supabase/scheduler.sql`. Holds a hash of a one-time nonce and a screen name from a fixed list; nothing that identifies a person until it is used, and then only the account that used it |
| `capture_asset` state | **Marked removed when its retention date passes or its consent ends** | `private.expire_capture_assets()` | `pg_cron`, hourly — the `capture-expiry` job. Marks state only; see the row below for what it does not delete |

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
which calls the `delete-account` function with the student's own token; the
function runs `public.erase_account` (every row naming the account, in one
transaction, refused up front when a legal hold covers the account) and then
deletes the sign-in. The per-table list is checked two
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
| `course_sources` | active sources: account deletion; explicit source deletion: metadata remains through a **30-day recovery window** and, today, after that window until a hold-aware purge is implemented | private student-source metadata only, including the display filename and object key but no bytes or extracted text. The owner foreign key cascades on account deletion; an account/tenant/platform legal hold blocks the account delete or the source deletion request. The 30-day tombstone is recoverable and preserves the prior lifecycle state. No purge or bucket exists in this slice, so expiry of the window does **not** claim physical removal |
| `course_source_corrections` | with its `course_sources` row or the confirming account's deletion | append-only source/derived-value hashes and revision links, never the corrected value. Cascades with the source and with the confirming owner |
| `course_source_operations` | with its `course_sources` row or the acting account's deletion | append-only idempotency receipts for plan, correction, conflict recording/withdrawal, delete and restore. Contains bounded result metadata, not filename, source text, compared values or correction values; cascades with the source and actor |
| `course_source_resolution_batches` | with either referenced `course_sources` row or the owning account's deletion | private source-pair and derived-snapshot hashes for one explicit re-import decision map. A withdrawal marks the batch voided but preserves the evidence; no source values or extracted text are stored |
| `course_source_resolution_choices` | with its `course_source_resolution_batches` row | append-only stable conflict keys and keep-current / use-imported choices. Cascades with the resolution batch; no compared values, quotations or source content are stored |
| `usage` | account deletion | which screens have been opened, and the day each last was |
| `notes`, `tasks`, `appointments`, `sittings` | account deletion | soft-deleted rows leave a tombstone — see above |
| `profiles`, `enrollments` | account deletion | |
| `messages`, `message_reactions` | account deletion | |
| `groups`, `group_members`, `group_tasks` | account deletion of the member | a group you started **stays** — other members rely on it. `KEPT_TABLES` in `deletion.check.sql` holds the three exceptions with the reason the privacy page prints |
| `forms`, `form_responses` | account deletion | |
| `form_publications` | its form's withdrawal or its owner's account deletion | the respondent's half of a form — questions and window, no answer key and no owner — kept in step with `forms` by a trigger and taken with it by `on delete cascade` (`20260929000000_published_forms_invoker.sql`) |
| `calendar_feeds` | account deletion | the published feed token; the Export screen can retire and reissue it |
| `connections` | account deletion of **either** end | both columns are `on delete cascade`, which is the whole answer and is deliberate: a connection is a fact two accounts agreed on, so it cannot outlive either of them. There is no tombstone and no sweep — the row *is* the agreement, and a removed connection is removed rather than marked, because "we kept a record of who you used to be connected to" is not a sentence this project wants to be able to say |
| `reports` | kept when the reporter deletes their account, with the reporter column cleared (20260929010000; before it, the auth cascade would have taken it) | a record about somebody else, which deleting an account is not a way to withdraw — `KEPT_TABLES` says so |
| `feedback` | account deletion of its author | what somebody said was wrong, with the screen *shape*, device class and build the app supplied — never a route, a user-agent or an address, and the check constraints in `20260921215800_feedback.sql` are what make that a property of the database rather than a promise about `lib/feedback.ts`. No clock: a bug report is worth keeping until the person who sent it leaves, and there is no version of "we aged out your bug report" that helps anybody. Readable and deletable by its author, never rewritable by anyone |
| `schools` | **never**, by any account's deletion | reference data, not anybody's record: the list of universities the server recognises, written only by an admin and readable by everyone. No account creates a row here, so no account's departure can take one. `profiles.school_id` points at it and is cleared to null when a school is removed, which is a school closing rather than a student leaving |
| `blocks` | **not** lifted by deletion | keyed on `blocked`, not `user_id`, so deleting your account cannot undo somebody else's protection. This is deliberate and `deletion.check.sql` pins it |
| `push_devices`, `push_queue` | see the clocks above | |
| `access_log` | 90 days, see above | readable by the account it is about, which is the difference between an audit log and an operator's private diary |
| `activity` | 400 days, see above | one row per account, day and mark, for the three figures the pilot is judged on. Readable by the account it is about, for the same reason the access log is. `ANALYTICS.md` is what it is for; `lib/privacy.ts` names it on the screen |
| `referral_codes` | account deletion | one generated code per ambassador. Deleting it takes every `referrals` row pointing at it, by the foreign key — an ambassador who leaves is not remembered by a count of who they recruited |
| `referrals` | account deletion, of either side | the row saying which code an account arrived on. It goes when that account is deleted, **and** when the ambassador whose code it names is. Never readable by the ambassador: it is a count on their screen and nothing else |
| `lti_platform` | **kept until an administrator removes it** | not personal data at all: one row per Brightspace deployment of this tool, holding an issuer, a client id and two public URLs. It is configuration a school installed, and it outlives every student who launches through it — deleting it on any account's deletion would uninstall the integration for everybody |
| `lti_nonce` | minutes, swept an hour past expiry | the one-time state and nonce of a launch in flight, and deliberately nothing about the person: no subject, no name, no course. It exists for the few seconds between redirecting a student to Brightspace and Brightspace posting back, is single-use, and `sweep_lti_nonce()` deletes what is an hour past expiry, hourly, as the `lti-nonce` job. There is nothing here for an account deletion to reach, which is the point of it carrying no identity |
| `course_ai_rules` | kept with the school; never by a person's deletion | the AI rules an instructor published for a course and term, one row per version (D-101). Course policy the school's students rely on, not the instructor's personal data: an instructor deleting their account clears the publisher and leaves the rules, as a department's syllabus outlives whoever wrote it. Append-only through the API, so what a student was shown on a date stays answerable. Goes with the school (`on delete cascade`) |
| `course_guidance` | kept with the school; never by a person's deletion | an instructor's published note for a course and term, one row per version. Kept for the same reason as `course_ai_rules`; an empty body is a published withdrawal |
| `study_packs` | kept with the school; never by a person's deletion | an instructor's published list of references for a course and term — titles, citations and links, never files — one row per version of a pack. A retired version takes a pack off students' lists without erasing that it existed |
| `gradebook_schemes`, `gradebook_items` | kept with the school; never by a person's deletion | a course's grading scheme per term (categories, weights, letter scale, whether moderation is required), one row per version, and its graded items (`20260929310000_gradebook.sql`). Course configuration, not anybody's personal data: an instructor deleting their account clears who set it and leaves it. Append-only through the API. Goes with the school |
| `grade_entries` | account deletion of the student; otherwise kept with the school | every version of every grade — entered, changed, moderated, released, regraded — with who and why. Append-only through the API, so how a grade came to be is always answerable. **Goes with the student's account** (`on delete cascade`), because every column naming an account must follow the auth delete (`erasure.test.ts`); a grader deleting theirs clears the grader and leaves the grade. The institution's record of a final grade is the registrar's export, taken before any account is deleted. No clock: how long a school must keep grades is the school's rule, not yet set here |
| `regrade_requests`, `regrade_resolutions` | account deletion of the student; otherwise kept with the school | what a student asked to have looked at again, and the one answer. Append-only. Go with the student's account, and with the grade versions they name |
| `grade_passbacks` | account deletion of the student; otherwise kept with the school | the queue of released grade versions sent to an LMS, one row per version, with the sender's last status. It is the ledger reconciliation reads, so it is kept after sending |
| `gradebook_operations` | kept with the school; the actor is cleared by their account's deletion | the idempotency keys the gradebook's mutations spent, with what each asked and answered — the correlation between a call and the rows it wrote. Holds a student's id only inside a request, never as a column |
| `dining_partner_connections`, `dining_locations`, `dining_hours`, `dining_menu_items` | kept with the school; never by a person's deletion | the school's card-office connection status and its dining halls, opening windows and menus (`20260929330000_dining.sql`). Not anybody's record: written by the card-office adapter; a location is paused by dining staff. Go with the school (`on delete cascade`). Menus older than the term are the adapter's to remove; nothing here sweeps them yet |
| `dining_plans`, `dining_ledger`, `dining_orders`, `dining_order_events` | account deletion of the student | a student's meal plan, their append-only card ledger, their mobile orders and each order's history. The ledger cannot be edited by anybody, its owner included; account erasure is the one path that removes it (cascade from `auth.users`). The card office's own system keeps its record under its own schedule — this is Semester's mirror of it, not the record. A staff member who moved an order is cleared from its history on their deletion (its actor column is set null) |
| `dining_pool_donations`, `dining_pool_claims` | kept with the school; the person is **cleared**, not deleted, by account deletion | swipes given to the basic-needs pool, and shared swipes drawn from it. A donor's deletion clears the donor column and leaves the gift in the pool; a recipient's clears the recipient column and leaves the draw counted, so a meal eaten stays eaten. Neither table names the other side, so nothing here, before or after a deletion, says who gave to whom |
| `family_grants` | account deletion of the student | what a student let one named person see, per category and per named thing, with an expiry of its own. It is the student's statement, so it is keyed on the student's column and goes when they do. **A recipient deleting their account does not take it** — `OWNED_TABLES` sends one filter per table and that filter is the student's — so a parent who leaves is still named by a grant until the student revokes it or it lapses. `supabase/family.check.sql` proves either party *may* delete one; the button does not yet send both |
| `family_invites` | account deletion of the student, or 7 days unclaimed | the share code a student generated and what it is worth once claimed: selected items only, a grant of at most 200 days (D-037). Two clocks, deliberately: the **code** lapses in seven days because an unclaimed one is a bearer token sitting in somebody's messages, and the **grant** it becomes carries its own expiry, set when the code was made. A claimed row is kept rather than deleted — it is the record of where a grant came from. Readable by the student who made it and by nobody else, including whoever holds the code |
| `family_shared_items` | account deletion of the student, or when the student removes it | the copy of a Family item a student confirmed sharing, stored with the code in one transaction (D-038). It is what the student saw on Preview at that moment and is not updated when the item changes on the device: a change reaches a supporter only through a new share they claim. Each copy is kept under its own code, so sharing an item again never changes what an earlier supporter was shown. A supporter reads it only through `read_family_share()`, which re-checks the grant on every read. **A copy outlives a grant that has ended** until the student stops the share, which removes the copies for that person, or deletes their account; nobody can read it in between |
| `family_access_events` | account deletion of the student | one row per supporter read: who, when and which items came back. Written only by `read_family_share()`, readable and removable only by the student it is about. A reader who deletes their account leaves the rows, with the reader cleared from them — the student's record that somebody read their share is the student's |
| `support_shares` | account deletion of the student or of the staff member (`forget_my_support_shares()` removes every share naming the account at either end), or when the student deletes it | what an athlete chose to show one athletic academic support staff member: at most the six items of the consent design, a snapshot of what they previewed, for at most 200 days (D-039). Readable by the student; the staff member reads it only through `read_support_share()`, which re-checks their role on every read. A revoked or expired row is kept until the student deletes it, so they can see what they shared |
| `support_share_events` | with the share it belongs to | one row per staff read of a support share: when, and by whom. Written only by `read_support_share()`, readable only by the student. Deleting the share deletes its log |
| `app_admins` | account deletion, by cascade only | who may open the internal administrator dashboard. Not written or readable through the API by anyone, including the administrator it names, so no client deletes from it — the row goes when the `auth.users` row does. Deleting everything does not remove the sign-in itself, so an administrator who empties their account is still an administrator |
| `lti_identity` | account deletion | which Semester account a Brightspace launch opens. It cascades on the account it points at, so deleting your account unbinds the launch too — and a later launch from the same school provisions a fresh account rather than reopening a deleted one, which is the correct reading of having asked to be forgotten |
| `lti_link_ticket` | minutes, swept an hour past expiry | the single-use proof that a launch was validated, held only long enough for a student to say they already have an account. It names no person: an issuer, an opaque subject the platform chose, and the account the launch just made. Cascades with that account, and sweep_lti_link_ticket() removes what is an hour past expiry, hourly, as the `lti-link-ticket` job |
| `lti_line_item` | account deletion, by cascade through `lti_identity` | which Brightspace gradebook column a course's link owns, so a quiz score can find its way back. A row exists only when an instructor placed the link as a *graded* activity — the launch says so, and an ordinary link writes nothing here. It holds addresses and a course title, never a score: the number goes to the platform and is not kept on this side. Keyed to the identity rather than the account, so retiring a provisioned account in favour of the student's own takes the memory of where their grade went with it, which is the correct reading of the binding having moved |
| `organizations` | **never**, by any account's deletion | a student organization outlives everybody in it, which is what distinguishes it from a study group. `organizations.created_by` is `on delete set null`, so a founder who deletes their account leaves the organization standing with no founder recorded — the opposite of `groups.created_by`, and for the opposite reason: a group is its four people, an organization is not its founder |
| `organization_members` | account deletion | your standing in an organization and the capabilities that go with it. Both API roles are off DELETE on the table — the row is somebody else's judgement about you, and a table anybody can delete their own row from is one an applicant can un-decline themselves in — so it goes through `forget_my_organizations()`, which takes the `DECLINED` and `REMOVED` rows that leaving refuses to touch. If you were the only administrator the organization is left with none and any member can take it on; if you were the last member it goes with you |
| `role_grants` | account deletion of the **subject**, by cascade. The grantor's deletion does not take it | which roles somebody holds, over what, and who said so. Not writable through the API at all, so no client deletes from it — the row goes when the `auth.users` row it names as subject does. `role_grants.granted_by` is ON DELETE SET NULL on purpose and is the asymmetry worth reading twice: removing a member of staff must not silently strip the roles they granted, so the grant survives them and forgets who made it. **Revoked and expired rows are kept, not swept**, and that is a decision rather than an omission — the select policy lets a person read their own revoked grants, which is how somebody finds out why a workspace they had yesterday is gone. The cost is that the table remembers every role an account ever held for as long as the account exists; if that becomes the wrong trade, the sweep belongs beside `sweep_lti_nonce()` and should keep the most recent revocation per scope rather than delete blindly |
| `app_roles`, `app_capabilities`, `role_capabilities` | **kept until a migration changes them** | not personal data and not anybody's rows: the twenty roles, the fourteen capabilities and the matrix between them, identical for every account. Written only by migration — no client may insert, update or delete, and there is no write policy on any of the three — so there is nothing here an account deletion could reach and nothing it should. Readable by any signed-in account, because item 240's context switcher has to know which tools a role carries and every row of it is printed in `docs/ROLE_REQUIREMENTS.md` anyway. The same answer `lti_platform` has, for the same reason: configuration outlives the people it applies to |
| `tenant_feature_policy`, `ai_policy` | **kept until a tenant administrator changes it or the school is removed** | institutional configuration rather than a student's work. Both cascade with `schools`, and no account deletion removes the policy a whole campus relies on. Each change is preserved separately in `tenant_policy_audit_event` |
| `feature_cohort_members` | **account deletion, or the school's removal** | who a school placed in a release cohort (`20260929340000_feature_cohorts.sql`). Ending a membership stamps removed_at rather than deleting, so the row records who was in a pilot and when; it cascades with the student's `auth.users` row and with `schools`. Written only by a holder of `tenant:configure`; read by the student and the school's configurers |
| `approved_source` | **kept until a tenant source approver removes it or the school is removed** | a course-source decision belongs to the institution, not the staff account that made it. The created-by field identifies the approver while that account exists; removal is an explicit institutional action and is audited |
| `consent_record` | account deletion of the **subject**, or school removal | the student's versioned decision. It cascades with both the student and tenant, can be changed only by the student it names, and is not aged out while the account exists because a consent-sensitive recording needs the decision that governed it |
| `evidence_reference`, `concept_evidence`, `mistake_evidence` | account deletion, or school removal | provenance and learning evidence are tenant- and person-scoped. A reference cascades with the student or school; concept and mistake rows cascade with the reference. They are not silently aged out while the account exists, because removing the evidence would make a mastery recommendation impossible to explain |
| `skill_claim`, `skill_claim_evidence` | account deletion, or school removal | a claim belongs to one student in one tenant and cascades with either. Its evidence links cascade with the claim or referenced evidence. Institution verification does not change ownership or retention, and deleting the verifier clears only the verifier field |
| `capture_asset`, `capture_segment`, `capture_artifact` | account deletion, school removal, or explicit deletion by the student | each original is bound to a versioned `consent_record`; segments and derived artifacts cascade with the original. Consent withdrawal or expiry immediately marks the original removed and its derivatives withdrawn, making them unreadable through row-level policy, but **does not physically delete those rows**. The per-asset retention timestamp also prevents expired material from being treated as active, and the hourly `capture-expiry` job now makes that state true for every reader, not only through the policy. **It deletes neither the rows nor the stored file**: the function's own comment says the object a storage key names needs a worker with storage access, and none exists. A tenant that requires timed physical erasure must add and verify that worker before production |
| `tenant_policy_audit_event` | **kept until the school is removed** | the append-only institutional record of feature, AI, source and consent changes. Deleting an actor clears the actor and actor-grant references rather than deleting the event, preserving the fact and timing of the institutional action without retaining a deleted account's identity. A time-based institutional retention schedule must be added before production if a university requires one; none is silently implied here |
| `role_grant_audit_event` | **3 years after the event**, then removed by the `audit-retention` job — see *Audit events* below | append-only evidence of future role grants, changes, revocations and deletions. It stores tenant/scope/role metadata plus SHA-256 pseudonyms, never raw account IDs, names or email addresses. Account and school deletion therefore do not silently erase or rewrite the evidence. Three years is Semester's default; a school whose agreement requires longer changes one interval in `sweep_audit_retention()` and one in `audit_purge_allowed()`, and the tests below hold them together. Ordinary updates and deletes are still refused |
| `moderation_audit_event` | **3 years after the event**, then removed by the `audit-retention` job | append-only evidence of report-status transitions. It stores the report identifier, before/after status and SHA-256 pseudonyms for the reporter, reported account and actor; it never copies the complaint, message, name or email address. Account deletion does not silently erase or rewrite this operational evidence. Legal/privacy review may still set a different period before production; ordinary updates and deletes are still refused |
| `support_access_grant` | becomes unreadable on consent withdrawal, explicit student revocation or its seven-day maximum expiry; physically removed on account deletion of either party or school removal | one student, one verified supporter and the single `learning-progress` aggregate scope. Every read rechecks the role, tenant, consent, recipient, expiry and revocation. Raw notes, excerpts, recordings and mistake detail are never granted. No scheduled expiry purge exists yet, so an approved institutional retention period is still required |
| `support_access_event` | **kept for as long as the student's records are — deliberately not on the 3-year clock** | immutable evidence of grant lifecycle and aggregate signal reads. It stores tenant, grant, fixed scope, expiry/revocation timestamps, action, time and SHA-256 pseudonyms in typed columns, never names, email, free-form reasons, notes, source text, recordings, protected traits or emotion inference. Account or school deletion removes the live grant but deliberately leaves this pseudonymous evidence. It is a record of each disclosure of a student's learning signals to a supporter, and FERPA (34 CFR 99.32) requires such a record to be kept with the education records it concerns — which here are kept until the student deletes them — so the audit sweep does not touch it |
| `institution_identity_provider` | **kept until a tenant administrator removes the provider or the school is removed** | institution-wide SAML configuration, not one account's data. Disabling a provider stops new authorization without erasing the record needed to explain existing memberships |
| `institution_membership` | **kept until the school is removed or the approved institutional retention process removes it** | current and deprovisioned institutional access. Account deletion clears the linked Auth user rather than erasing the institution's lifecycle record; deprovisioning immediately clears roles and access. Vanderbilt must approve the time-based retention period before production — the repository does not silently invent one |
| `scim_credential` | **kept until a tenant administrator removes it or the school is removed** | salted verification material and lifecycle timestamps, never the bearer token. Revocation makes it unusable immediately; retaining the revoked row prevents its identity from being silently reused and supports provisioning audit evidence |
| `scim_external_identity` | **kept with its institutional membership until the approved retention process removes it or the school is removed** | the tenant-scoped SCIM external identifier, user name and group identifiers needed for idempotent provisioning, deprovisioning and explicit reactivation. It is not treated as student-authored work and is not silently removed on account deletion |
| `scim_group_mapping` | **kept until a tenant administrator removes the mapping or the school is removed** | administrator-approved group-to-role configuration. Unknown groups grant nothing; removing a mapping is an explicit institutional policy change rather than an account-deletion side effect |
| `provisioning_audit_event` | **3 years after the event, or with the school if that is sooner** | immutable metadata-only evidence of provisioning decisions. It contains request, tenant, credential and resource identifiers but no SCIM bearer secret or academic content. Removed by the `audit-retention` job after three years |
| `tenant_plan` | **kept until the operator replaces it or the school is removed** | one row per school: the deal-desk tier, the entitlement status and the plan's dates. A commercial fact about the institution, not about any person, written only by the service role. Replacing it is a plan change, and the change is kept in `tenant_plan_history` |
| `tenant_plan_history` | **kept until the school is removed, unless an approved institutional schedule is added** | immutable record of every plan insert and update: tier, status, dates, reason and the operator's id. It carries no student data. It is kept for the same reason as provisioning evidence: explaining what a school was entitled to on a given day |
| `tenant_module_mode` | **kept until the school changes it or the school is removed** | one row per school and module: Connect or Core, whether Core data is frozen, the reason and who asked. A fact about the institution, with no write policy: it changes only through an approved request |
| `module_mode_request` | **kept until the school is removed, unless an approved institutional schedule is added** | a request to change one module's mode: the module, the direction, the reason, who asked and when. It carries no student data. Deleting the requester's account clears their id and keeps the request |
| `module_mode_approval` | **kept until the school is removed, unless an approved institutional schedule is added** | one administrator's yes to a request. It carries no student data. Deleting the approver's account clears their id and keeps the approval |
| `tenant_module_mode_history` | **kept until the school is removed, unless an approved institutional schedule is added** | immutable record of every mode change: from, to, frozen, reason, who asked and who approved. It carries no student data, and explains what a school's record was on a given day |
| `tenant_rollout` | **kept until the operator replaces it or the school is removed** | one row per school: where it stands in the pilot-to-production lifecycle, the state a hold resumes to, and the reason for the last move. A fact about the institution, not about any person, written only by the service role. Every move is kept in `tenant_rollout_history` |
| `tenant_rollout_evidence` | **kept until the school is removed, unless an approved institutional schedule is added** | immutable record that an exit gate was met: the gate, what was shown, the name and role of who accepted it, and the operator's id. It carries no student data. It is the proof behind every forward move, and is kept for as long as the move it justifies |
| `tenant_rollout_history` | **kept until the school is removed, unless an approved institutional schedule is added** | immutable record of every lifecycle transition: from, to, reason and the operator's id. It carries no student data, and is kept for the same reason as `tenant_plan_history`: explaining what state a school was in on a given day |
| `tenant_sso_policy` | **kept until the school's administrators change it or the school is removed** | one row per school saying whether campus SSO is required, and the reason. A security policy about the institution, not about any person. It is never deleted: turning the requirement off is a change, kept in `tenant_sso_policy_history` |
| `tenant_sso_policy_history` | **kept until the school is removed, unless an approved institutional schedule is added** | immutable record of every change to a school's SSO requirement: the value, the reason and the id of the administrator who made it. It carries no student data |
| `approved_source_content` | **kept until its approved source is removed** | server-only course-source text, evidence identifiers and a checksum. It cascades with `approved_source`, is never readable by browser roles, and is the only source body the institutional model gateway may send to an approved provider |
| `ai_usage_month` | **the tenant AI policy's retention-days setting** | monthly aggregate cost and token counts with no prompt, response or source text. `private.sweep_ai_runtime_metadata()` removes expired rows daily through the `ai-runtime-metadata` scheduler job |
| `ai_usage_reservation` | **five minutes against budget; physically removed after the tenant AI policy's retention-days setting** | metadata-only provider budget reservations. A crashed request stops counting after its explicit expiry; the same daily cleanup removes settled, released and expired rows, with no prompt or academic content stored |
| `student_context`, `term_plan_courses`, `registration_time_tickets`, `seat_watches`, `graduation_scenarios`, `cost_plans`, `ai_memories`, `weekly_checkins`, `contact_channels`, `onboarding_progress`, `study_match_optins` | account deletion | the student's own planning, preferences and reminders, from `20260926150000_expansion_roles_and_features.sql`. Each is readable and deletable only by its owner (study opt-ins also by other opted-in students in the same section; onboarding progress also by an accepted, unexpired peer mentor). `study_match_optins` also lapses from view after its own expires_at |
| `onboarding_journeys` | until retired by an operator | what the tour says, by version; no personal data, and a retired version is kept because assignments made under it point at it |
| `onboarding_assignments`, `onboarding_step_progress`, `onboarding_events` | account deletion | which journey, which version, which steps, and how the person arrived, as the short allowlist in `private.entry_context`; deleting the account deletes all three by foreign key (checked in `supabase/onboarding-journeys.check.sql`) |
| `productivity_workspace` | account deletion, by explicit erasure and foreign-key cascade from `auth.users` | the student's private productivity workspace and opt-in aggregate-sharing choice. The row is readable and writable only by its owner. Private workspace content is never returned by the institutional aggregate function; when sharing is enabled, that function returns only cohort counts and refuses cohorts smaller than ten |
| `productivity_task`, `productivity_event` | account deletion, by foreign-key cascade from `auth.users`; a deleted record is kept as a tombstone (`deleted_at`) so the sync feed can tell a device it is gone, and goes with the account | a student's tasks and calendar events, written only through the command API (`app/server/productivity/`, `docs/API-PLATFORM.md`) and readable directly only by their owner while their membership is active; a share to anyone else is decided by the policy decision point and audited, never by a row policy. From `20261004123000_productivity_commands.sql`. **Nothing writes to them yet** — no route is mounted. They are in lti_account_untouched (migration 20261004181000); the account export and erasure walk the foreign keys to `auth.users` and so already carry them, which `productivity-commands.check.sql` proves |
| `productivity_command` | **35 days** after the command was applied, by `private.productivity_sweep_commands()` — **not yet scheduled**; with the account by cascade | the idempotency ledger: a command id, a hash of the request and the outcome, no content. Operational, not evidence (the evidence is the `audit_event` row and the outbox event, which this does not touch). Kept five days longer than the 30 days a queued command may be replayed, so no command that could still arrive has lost its record |
| `productivity_owner_seq` | with the account, by foreign-key cascade | a counter per tenant and person that makes the change feed's sequence gapless. No content |
| `transfer_evaluations` | account deletion | the student's estimate or request. The institution's decision arrives through the service role and goes with the account |
| `account_ages` | account deletion, by foreign key to `auth.users` | whether the account is under 13 or a minor, and the day a minor turns 18 — never the date of birth, which the sign-up trigger strips from the account's metadata. Stated once, never changed (D-139) |
| `skill_records` | account deletion | a skill the student recorded and, if they asked, who verified it. The verifier's deletion clears verified_by and leaves the record |
| `talent_profiles`, `talent_profile_views` | account deletion of the student; a view also on the profile's deletion | consent to be found **lapses** on expires_at (180 days by default, at most a year) and is renewed rather than remembered. A viewer's deletion clears viewer_id and leaves the student's record that they were viewed |
| `peer_mentor_assignments` | account deletion of **either** end | ends early on revoked_at by either person, and cannot be reopened; lapses on expires_at (at most 200 days) |
| `accommodation_passports` | account deletion of the student, or school removal | a functional summary issued by disability services, never a diagnosis. Expires on its own clock (at most 400 days). The issuer's deletion clears verified_by |
| `accommodation_shares`, `accommodation_access_events` | account deletion of either the student or the instructor; events go with their share | a share lapses on expires_at (at most 200 days) or the student's revocation; the events are the student's record of every read |
| `advisor_shares`, `advisor_share_events` | account deletion of either the student or the advisor (`forget_my_advisor_shares()` removes every share naming the account at either end, since D-058; see `OWNED_TABLES`); the student may delete a share at any time, and its events go with it | Advisor Meeting Mode (`20260928301000_advisor_shares.sql`, D-016). A share holds only the snapshot the student previewed. It stops being readable at expires_at (at most 120 days) or on the student's revocation, but the row stays in the student's list until they delete it; the events are the student's record of every time the advisor opened it |
| `institution_action_audiences`, `institution_action_progress` | account deletion (the student's delete removes them directly; see `OWNED_TABLES`); the student may remove any row at any time; a progress row also goes when its action is deleted | Campus office action feed (`20260928302000_office_action_feed.sql`, D-048). What a student said applies to them, and which office actions they marked done. No office can read either table; an office sees only a completion count, and only at ten or more |
| `institution_action_offices` | **kept until changed by a migration** | the list of offices and which roles publish for each. Configuration, no person |
| `demand_consents` | account deletion (`forget_my_course_demand()`, which also removes the student's `term_plan_courses`, since D-058); a revoked consent is kept, with its revoked_at, until the account goes | Course demand forecasting (`20260928305000_course_demand_forecasting.sql`, D-051). When a student chose to contribute a term's plan to the anonymized demand count, and when they stopped. Only the student reads it; no staff policy exists. The contributed rows themselves are `term_plan_courses` (above), deleted when the student stops |
| `course_reviews` | **kept after the author's deletion** — see the note | the review is anonymous by construction: authorship is in `course_review_authors`, which goes with the account. What stays is a workload figure and two ratings with nobody attached, so a department's picture of a course does not vanish when one student graduates. Removed by a moderator (status = 'removed') or with the school |
| `course_review_authors` | account deletion | the only link between a review and a person |
| `alumni_mentor_offers` | account deletion, or school removal | carries a display name the alum chose (`20260928021700`); never their email |
| `guardian_links`, `guardian_link_restrictions`, `guardian_link_history` | account deletion of the student or the guardian (a link and its restriction go with either; the history goes with the student), or school removal | who a K–12 student's parent or guardian is, recorded and verified by school staff (D-1022). A link is ended, never removed, while both accounts exist; its history refuses every rewrite except the student's own deletion. A restriction is staff's note and never shown to the guardian |
| `grade_levels` | **kept until changed by the school, or the school is removed** | a K–12 school's grade codes and labels. Configuration, no person |
| `peer_mentor_offers` | account deletion, or school removal | a peer mentor's opt-in to be found in one cohort: a chosen display name, topics and a capacity. Withdrawn by deleting it |
| `mentor_requests` | account deletion of **either** end; or `forget_my_mentor_requests()` by either end | the requester's chosen display name, ticked topics, a short note and a status. Never contact details. Kept after a decision so both sides can see what was answered, until either forgets it |
| `data_requests` | **kept after the requester's deletion, with user_id cleared** | a deletion request has to outlive the account it deleted, or nobody can show it was honoured. It carries the kind, the status and the dates, and after deletion no person |
| `registration_windows`, `catalog_sections`, `articulation_rules`, `institution_actions`, `opportunities` | **kept until the publisher withdraws or removes it, or the school is removed** | institutional publications, not a student's data. A publisher's deletion clears published_by / proposed_by / approved_by / publisher_id / reviewed_by and leaves the row. An institution action targeted at one student goes with that student. Phase J (D-048): offices withdraw rather than delete, so a withdrawn action stays as the office's record of what it published |
| `registration_terms`, `registration_sections` | **kept until the registrar changes them, or the school is removed** | the official registration calendar and the sections a student enrolls into (`20260929300000_registration_transaction.sql`). Institutional configuration naming no student; a registrar's deletion clears updated_by and leaves the row |
| `registration_enrollments`, `registration_overrides`, `registration_requests`, `registration_holds`, `registration_completions` | account deletion (`on delete cascade` from the student), or the school's removal; **never by a drop or a withdrawal** | the student's enrollments in Semester's registration ledger and what the registrar and the SIS recorded about them. A drop, a withdrawal (a W), a denial and leaving a waitlist are states of a kept row, not deletions. Semester's ledger is not the school's official transcript: the school keeps its own record in its SIS on its own schedule. A hold's reason is readable by no signed-in account |
| `registration_audit_event` | **kept with the school; actor and student cleared on account deletion** | append-only record of every registration change, promotion and override, readable by the school's registrar. Like `data_requests`, it has to outlive the account it describes to show what was done |
| `course_demand_snapshots`, `outcome_aggregates` | **replaced on every refresh; removed with the school** | aggregates of ten or more students, enforced by a check constraint, counting only students who opted in (since D-051, only while their `demand_consents` row is live). No row names a person, so no account's deletion takes one — the next refresh simply counts one fewer |
| `help_destinations` | **kept until an implementer retires it or the school is removed** | which offices a university chose to reach through Semester, their official link and hours. Institutional configuration, not a student's data |
| `help_requests`, `help_request_events` | account deletion (through its own function, since no API role may delete these rows), or the destination's or school's removal; events go with their request | a question the student wrote, the named context fields they ticked, and the display name and confirmed email shown to them when they sent it (requests from before that snapshot existed were filled from the identity they would have shown). Withdrawal — at any status, closed included — empties all of those at once and leaves only the fact and dates; the events are the student's record of every open and answer. **No time-based purge of closed requests exists yet** — a university that needs one must set the period before production |
| `support_tickets`, `support_ticket_messages`, `support_notification_outbox` | classified individual-beta tickets with no signed deployment association: resolved or student-closed tickets are kept **180 days after last activity**, enforced daily by `private.sweep_support_ticket_retention()`. A school-domain claim alone remains individual beta. Tickets opened under a currently effective signed institutional order form are excluded until an institution-specific contract rule is configured. Tickets created before the durable creation-time classifier remain unclassified and outside both the automated sweep and narrow ticket-only deletion until an operator verifies the historical membership and contract evidence; the migration never infers that history from today's profile or from an unbounded terminated contract. Whole-account erasure deletes classified tickets but detaches a legacy ticket from `auth.users`, disables its email delivery, closes the now-inactive conversation, and preserves it with only the former account UUID as an opaque review key, so the account can be erased without destroying potentially held evidence. Preserved rows are excluded from ordinary support queue/thread and command-center worklists. Messages and delivery intents stay with that preserved ticket; any active account, signed-deployment-ticket or platform legal hold pauses ordinary deletion. Both deletion paths hold a shared lock on the legal-hold table from the hold check through deletion, so concurrent hold placement cannot enter between them | a question the student wrote to Semester's own support, the app details they ticked from a closed list of six (version, device class, screen name, signed in, sync state, offline), the replies, the signed deployment tenant id at the time the ticket was opened solely so a legal hold continues after membership changes and the institutional clock is not guessed, the creation-time retention-classification marker, the opaque former account UUID used only after legacy preservation, and the retry/acceptance state for each generic email notice. The outbox stores no email address or message body. Ordinary support staff read active tickets through functions that return no account id, tenant id, name or address. Open and waiting classified tickets are retained while support work is active; resolving or closing a classified individual-beta ticket starts the 180-day clock |
| `integration_connections`, `integration_scopes`, `integration_mappings` | **kept until an integration administrator removes it or the school is removed** | institutional configuration. The owner's or approver's account deletion clears owner_account_id / approved_by and leaves the row. No credential is stored — credentials_reference is a pointer into a secret manager, and revoking there is the disconnect |
| `integration_sync_runs`, `integration_sync_errors`, `integration_webhook_events`, `integration_dead_letter_events` | **runs and errors 180 days; events 30 days after processing; dead letters 90 days after resolution — by the integration retention sweep, skipped for a connection on legal hold; all go with the connection or the school** | operational logs: counts, categories, sanitized messages, payload *hashes and references* — never a payload, never an external id in the clear. The sweep runs daily at 03:29 UTC as the integration-retention job in supabase/scheduler.sql (INTEGRATION-OPERATOR-RUNBOOK.md §8) |
| `source_records`, `source_freshness_events` | **kept until the school is removed** | where an institutional fact comes from and how fresh it was. Classified T0–T3 only; nothing T4+ can be stored |
| `source_snapshots` | **retention_expires_at when set, removed by the sweep; otherwise with its source record** | a content *hash* and a storage reference, never the content |
| `canonical_entity_references` | **account deletion of the subject, by cascade, or deleted by the student at any time from the privacy page; tenant-wide rows with the school** | provenance for one imported fact. A row about one student has subject_user_id, is readable only by that student, and goes with their account. Tenant-wide rows (a term, a catalog entry) name nobody. Adapter-backed rows carry a server-declared retentionExpiresAt and are removed by the daily integration-retention sweep once it passes; source-deleted rows are also removed after 30 days. Connection holds and central account, tenant or platform legal holds skip both deadlines until released. The sweep still visits surviving rows after a connection is removed. Legacy rows without a valid deadline and direct LTI tenant-lifetime references retain the account/school lifecycle policy. |
| `feature_kill_switch`, `data_classification_rules` | **kept until changed or the school is removed** | safety configuration. Engaging a switch records who (engaged_by, cleared on their account deletion) and why; every change to a school row is kept in `tenant_policy_audit_event` |
| `governance_policy_nodes` | **kept until changed or removed, or the school is removed** | institutional configuration. A system node belongs to no school and is kept until the platform removes it. A node with children cannot be removed until they are. The creator's account deletion clears created_by and leaves the node. Every change to a school's node is kept in `tenant_policy_audit_event` |
| `governance_steward_assignments` | **kept until the school is removed**; no API role may delete one | the name of the staff member who holds a stewardship role, and optionally their account. Revoking keeps the row, because the record of who was accountable, and when, is the point. Deleting that person's account clears person_account and assigned_by but **keeps the name they held the role under**. **No time-based purge of revoked assignments exists yet**, and a university that needs one must set the period before production |
| `governance_decisions` | **kept until the school is removed** (a decision on its request); **indefinitely** for a decision about the platform | the portfolio council's append-only decision log: scores, route, rationale, review date. No student data. The decider's account deletion clears decided_by |
| `governance_config_requests` | **kept until the school is removed**; no API role may delete one | a school's configuration request and its approval steps. The requester's or updater's account deletion clears the reference and leaves the request. Every step is kept in `tenant_policy_audit_event` |
| `governance_incident_notices` | **kept until the school is removed**; **indefinitely** for a notice sent to every school | the notice as sent. It is the record an incident review and a university's own notice obligations are checked against, so it is append-only. The sender's account deletion clears sent_by |
| `integration_reconciliation_runs`, `integration_reconciliation_discrepancies`, `integration_schema_fingerprints`, `integration_schema_drift_events` | **with the connection or the school, by cascade. No time-based purge exists yet** — the integration retention sweep does not reach them, and a university that needs one must set the period before production | operational records: counts, field names, enum codes and *redacted* `sha256:` references — a check constraint refuses a provider id in a discrepancy. No value and no student. A resolver's or acknowledger's account deletion clears the reference and keeps the record |
| `integration_duplicate_candidates`, `integration_duplicate_resolutions` | **with the connection's school, by cascade**; no API role may delete a resolution | a hash of a natural key and canonical ids, never the values that matched. A resolution keeps its exact before-state so it can be reversed, and is kept after reversal as the record that it was. **No time-based purge exists yet** |
| `integration_source_owners`, `integration_mapping_versions` | **kept until changed, or with the connection or the school** | institutional configuration: who answers for a source, and every version of a mapping with who proposed and approved it. The proposer's or approver's account deletion clears the reference and leaves the row |
| `provider_registry`, `provider_evidence` | **indefinitely, until the platform removes it** | Semester's own record of what it may claim about a vendor, and the evidence for each claim. No school's or student's data. The recorder's account deletion clears recorded_by |
| `integration_simulation_runs` | **with the school, by cascade. No time-based purge exists yet** | in the private schema, out of every API's reach: a simulated run's verdict and counts against fixtures, never a real record |
| `integration_retention_runs` | **kept until the school is removed** | one row per school per sweep: counts removed and connections held. No record content |
| `communities`, `community_venues` | **kept until removed by the owner or a community manager, or with the school** | a community's name, purpose and type, and approved campus venues. No member list is readable through the API |
| `community_members`, `community_mutes`, `community_session_participants` | account deletion, or leaving | a membership, a mute or a place in a study session, each readable only by its own account. A community's deletion takes its rows |
| `community_posts` | account deletion of the author, or the author's delete | a post and a snapshot of the author's handle. The author's delete removes it outright unless a case is open, when it is withdrawn — hidden from everyone, author included. Deleting the account (forget_my_community) removes every post except one that is the subject of a moderation case, which is withdrawn, re-attributed to "Deleted account" and kept as evidence with its case. From `20260928032000_community.sql` |
| `community_sessions` | **30 days after the session ended**, by the daily community-retention sweep; earlier on the host's account deletion or the community's | a title, an approved venue and a time. The host's account id is not readable through the API |
| `community_reports` | **90 days after it was made, once no case holds it**; earlier with the post | the category and optional details. reporter_id is granted to nobody through the API, reviewers included, and neither is whether a report was set aside as brigading |
| `community_cases`, `community_decisions`, `community_case_events`, `community_signals` | **90 days after a case is closed with no action; 1 year after anything is enforced or an appeal is decided. Open and appealed cases are never swept** | Trust & Safety evidence. The daily community-retention sweep (supabase/scheduler.sql) deletes a closed or decided case once its retain_until passes, and its decisions, history and detector signals go with it; a withdrawn or removed post kept only for that case goes too. Every run writes a row to community_retention_runs, which reviewers can read. Case events and rule changes carry a hash, never an account id |
| `community_restrictions` | **90 days after the restriction ended or was lifted** | a pause on posting. Lapses on its until time or when an appeal lifts it, and the record goes ninety days later |
| `community_detector_rules` | **kept until a migration removes a rule** | the patterns the detectors run, readable by reviewers only. A senior reviewer can switch one off or change its confidence; the change is stamped with a hash of who made it. Not a record about any person |
| `community_programs` | **kept until the service role changes it, or with the school** | whether a university has switched scoped pseudonyms or volunteer moderation on. Off unless a row says otherwise; only the service role writes one |
| `community_aliases` | account deletion, or dropping the alias | a name used in one community. Readable only by its owner. A rotated alias's old name is not kept — only the posts made under it, which carry their own ref |
| `community_volunteers` | account deletion | a volunteer's status and the dates of training and agreements. A revocation's reason is kept on the row until the account goes |
| `community_calibration_items` | **kept until a senior reviewer retires one, or with the school** | example posts with a known answer, written by staff. Not a record about any person |
| `community_volunteer_tasks` | **1 day if never answered; 1 year once answered**, by the community-retention sweep | which task went to which volunteer, and for calibration items whether the answer was right. Goes with its case or item |
| `community_volunteer_votes` | **with the case, on the case's retention date** | a volunteer's vote and reason on a real case. Stays after the volunteer deletes their account, as the record of a decision about somebody else's post; nobody reads who voted through the API |
| `community_volunteer_events` | **1 year**, by the same sweep | applications, attestations, training, status changes and revocations, each carrying hashes rather than account ids |
| `community_escalation_policies` | **kept until it is replaced or retired, or with the school** | whether a university has an escalation agreement in force: its reference, the office that receives, the categories it covers, whether it requires an identity reference, the delivery channel name and when it ends. Recorded by one senior Trust & Safety person and activated by another, attributed by hash; reviewers read it |
| `community_identity_grants` | **with the case, on the case's retention date** | a Trust & Safety request to see which account is behind an alias post, a second reviewer's decision, and a four-hour expiry. Who asked and who decided are hashes; what was shown is not stored. Each look is a case event |
| `community_escalation_agreement_events` | **kept until the school is removed** | every draft, activation and retirement of an agreement, with the reason given and a hash of who did it. Readable only by agreement staff |
| `community_escalations` | **with the case, on the case's retention date** | a request to escalate a P0 or P1 case to the university, its reason, and a second reviewer's decision. Who asked and who decided are hashes, never account ids; the payload is the allowlisted summary that was sent |
| `community_escalation_deliveries` | **90 days after delivery**, by the community-retention sweep; earlier with its escalation | one queued copy of an approved escalation for the service role's delivery adapter, with its attempts, next try and last failure as a fixed code (http_502, timeout) — never what the receiver said. Reviewers see whether it went, not what it said |
| `community_safety_entries` | **1 year**, by the community-retention sweep; earlier on account deletion | the private safety state: one row per professional enforcement decision, with the case's severity and a hash of who decided. Reversed, not deleted, when an appeal is granted. Granted to nobody through the API |
| `community_media` | **with its post; 1 day if never uploaded**, by the community-retention sweep; earlier on account deletion | an image's description, its scan facts (type, size, dimensions, the verdict and its reason code) and a private file in the community-media bucket. The uploader, the file's SHA-256 and its perceptual hash are granted to nobody through the API. Account deletion removes the uploader's images except one a case holds. A known-abuse match is never deleted by any sweep or by account deletion: it is preserved with its case until the legal runbook in docs/COMMUNITY-MEDIA-SAFETY.md says otherwise |
| `community_media_blocklist` | **kept until an appeal restores the image, or with the school** | the hashes of an image a reviewer removed, so a re-upload is held. No file and no account id; who added it is a hash |
| `community_media_deletions` | **until the service role confirms the file is gone** | the storage path of a file whose row was deleted, queued for the scanner to remove from the bucket. Never queued for a known-abuse match |
| `community_retention_runs` | **1 year**, trimmed by the same sweep | the count of what each sweep removed and when, so a stalled job is visible. No row names a person |
| `beta_programs`, `beta_cohorts`, `beta_feature_flags` | **kept until an administrator removes the program** | configuration of an invite-only beta; names nobody. The creator column is cleared on that account's deletion. Removing a program cascades to everything below. `20260928220000_private_beta.sql` |
| `beta_invitations` | **until the invited address's account is deleted, or the program is removed** | an address invited to one cohort. `forget_my_beta()` removes invitations to the deleting account's confirmed address. An invitation never accepted is removed 90 days after it was sent, and a revoked one 90 days after the revocation, by the `invite-retention` job. The same address also goes on `invites`, which answers for itself below |
| `beta_memberships` | **account deletion** | who joined which cohort and when they left. Leaving sets the left-at time and keeps the row, so the program can see its own turnover; `forget_my_beta()` (the `via` in `OWNED_TABLES`) removes it |
| `beta_feedback`, `beta_exit_requests` | **account deletion, by cascade from the membership** | what a member wrote to the beta and why they left. Triage reads feedback without the sender's identity, through the queue function; leaving the beta does not delete it, deleting the account does |
| `beta_known_issues` | **kept until an administrator removes it or the program** | what the program publishes to its members. The creator column is cleared on that account's deletion |
| `gtm_prospects`, `gtm_consent`, `gtm_suppression` | **removed when the school's CRM sync removes the contact, or with the school; consent and suppression go with their contact** | a recruitment contact as a CRM reference and declared fields only, with no name, address or phone. The consent ledger is append-only while the contact exists. A contact deleted and later re-imported comes back with no consent, so nothing but transactional email can reach them until they opt in again. **No time-based purge of inactive contacts exists yet**; a school must set that period before a campaign goes live |
| `gtm_communication_events`, `gtm_conversion_events` | **with their contact or campaign; no time-based purge yet** | send decisions and funnel events, append-only. Staff read them only as counts of ten or more, through the campaign report function. The period must be set with the contact period above |
| `gtm_campaigns`, `gtm_campaign_links`, `gtm_campaign_reviews` | **kept until the school is removed** | institutional configuration. A campaign is retired rather than deleted, so its reviews and audit trail stay readable. A staff member's account deletion clears them as owner, approver or reviewer and leaves the record; an ownerless campaign cannot be activated |
| `workflow_versions` | **kept until the school is removed** | a school's workflow definitions (D-1018): at most one draft per workflow and published versions that are never edited or deleted by a client — a rollback is a new version, so history is the record of what the school ran when. It holds a definition, never a student, a request or an answer, and typed text refuses a run of card digits. A staff member's account deletion clears them as drafter or publisher and leaves every version |
| `school_config_versions` | **kept until the school is removed** | a school's configuration (D-1011): at most one draft per domain and published versions that are never edited or deleted by a client — a rollback is a new version, so history is the record of what the school ran when. It holds no person, credential or student record (the spec has no free-form key, and typed text refuses a run of card digits). A staff member's account deletion clears them as drafter or publisher and leaves every version |
| `migration_projects`, `migration_field_maps`, `migration_runs`, `migration_approvals` | **kept until the school is removed** | institutional record of how a domain left a retiring system (D-144). A migration is never deleted by a client; its runs and approvals are append-only, because they are the evidence a cutover was approved on. They hold counts and a file fingerprint, never a student record. A staff member's account deletion clears them as creator, recorder or approver and leaves the record |
| `roster_import_config` | **kept until the school is removed** | a school's roster-source setting: a credential *pointer* (`vault:`, `env:`, `secret-manager:`), never a credential (D-160). Server-only |
| `roster_import_batch`, `roster_staged_row`, `roster_snapshot`, `roster_current` | **kept until the school is removed; no time-based purge yet** | a school's roster as imported, minimised to a per-entity allowlist of keys (names, roles, course codes; no email, no grade, no date of birth). Nothing imports into it and nothing reads it yet (D-160). How long staged rows and last-known-good snapshots may be kept is a decision for counsel and the school, and is not made here |
| `academic_record_entries`, `academic_record_changes` | **kept until the school is removed** | the school's academic record of its students (D-145): an education record the institution keeps, not the student's Semester data. The ledger is append-only and has no purge; a registrar's retention schedule for academic records is permanent for transcripts, and a shorter schedule for anything here must be set by the school before it is used for real. A staff member's account deletion clears them as proposer, decider or approver and leaves the record |
| `academic_record_subjects` | **removed with the account** | the link that lets a student's account read their own record. The account's deletion removes it (`on delete cascade`); the school's record it pointed to stays |
| `student_account_entries`, `student_account_requests`, `student_account_reconciliations`, `student_account_closes`, `student_account_settings` | **kept until the school is removed** | the school's financial record of its students' accounts (D-146): what was charged, paid, refunded and credited, and the reconciliations and closes it was checked by. The school's financial-records schedule governs it, and none is set yet; the ledger has no purge, and a school must set its schedule before real use. No card data is held. A staff member's account deletion clears them as requester, approver, recorder or closer and leaves the record |
| `student_payment_plans`, `student_payment_plan_installments` | **kept until the school is removed** | payment plans on student accounts (D-146): what a student asked to spread and over how many payments, whether the school agreed, and the schedule the database wrote. Part of the school's financial record and governed by the same schedule, which no school has set yet. No payment or card data is held. A student's or staff member's account deletion clears them as asker, decider or canceller and leaves the plan with the school |
| `legal_holds` | **kept until the school is removed; never deleted** | the record that an account, a school or the platform was placed under a legal hold, why, and who placed and released it. A hold is never edited except to record its release, once, so the row is the audit trail. It stops the invite, abandoned-sign-up and audit sweeps for what it covers, and refuses deletion of a held account. See *Legal holds*, below |
| `human_overrides` | **kept until the school is removed**; the overriding person is cleared, not the override, when their account is deleted | every time a person overrode an automated decision, and why (20260930120000_human_overrides.sql): the rule, what the system had decided, what replaced it, the reason, and — where a student is meant to understand it — a plain-language explanation. Append-only. Two producers are wired, both by trigger: the academic record's registrar overrides, and break-glass access grants (permission). The moderation, credential, notification, integration, migration and AI-output domains have a path and no producer, because no row in the schema is yet an override in those domains. The override-patterns view over it is read by override reviewers only |
| `ledger_chain` | **kept until the school is removed** | one hash link per entry appended to the academic-record and student-account ledgers, per school (20260930110000_ledger_chains.sql). Append-only; it goes with the school as the ledgers do, and holds no more about a person than the ledger's own row does, which it excludes the person columns of. Entries before the migration are not chained |
| `ledger_chain_start` | **kept; never removed** | when each ledger's chain began, so the verifier can tell an entry that predates the chain from one appended without being chained. Two rows |
| `ledger_chain_key` | **kept; never removed, never rotated by a redeploy** | the one signing key for the ledger chain manifests (20260930150000_ledger_chain_seals.sql): 32 random bytes, readable by no API role and not by the service role. Losing it makes every manifest unverifiable, so a rotation is a decision with a record. One row |
| `ledger_chain_manifest` | **kept until the school is removed** | one HMAC-signed manifest per UTC day, ledger and school: the bounds, count and head hash of the chain links sealed that day. Insert-only; a day cannot be sealed twice over different rows. Holds no more about a person than the chain does, which is none |
| `ledger_chain_verification` | **kept; no clock yet** | every run of the nightly seal-and-verify job, good or bad: when, whether it was fine, how many chains it walked, and the first break it found. Insert-only. It names a ledger and a school, never a person |
| `gtm_report_access` | **kept until the school is removed** | who read which campaign's counts, and when. The reader's account deletion clears actor_id |
| `gtm_sponsor_policy`, `gtm_sponsor_placements` | **kept until the school is removed** | a school's sponsorship choices and each placement's approval record. A removed placement stays as a record, with its status set to removed |
| `gtm_accounts`, `gtm_stakeholders`, `gtm_decision_log`, `gtm_pilots`, `gtm_pilot_metrics`, `gtm_pilot_outcomes` | **kept until Semester removes the account**; unlinked, not removed, when the school is removed | Semester's own sales records about an institution: committee members by name and title, questions, evidence links, pilot terms and the signed outcome. No student data |
| `trust_artifacts`, `trust_artifact_versions` | **kept until Semester retires the artifact**; a version is never edited or removed while a grant points at it (on delete restrict) | the trust packet's own documents, as paths into a private bucket and the commit each was generated from. No student data |
| `trust_room_requests`, `trust_room_grants`, `trust_room_grant_items`, `trust_room_access_log` | **with their account**; unlinked from the school, not removed, when the school is removed | a named reviewer's name, work email and role, the NDA's reference, the expiring link's hash, and when each document was opened. The link token itself is never stored. **No time-based purge yet**; the grant expires in thirty days at most, but the record of it stays with the account |
| `commercial_products`, `commercial_plans`, `commercial_prices`, `entitlement_definitions`, `plan_entitlements` | **kept until Semester retires them**; a price is ended with an end date, not deleted, while anything references it | the public catalog the pricing page reads. Names nobody. `20260929070000_commercial_core.sql` |
| `billing_accounts`, `billing_account_tenants`, `quotes`, `quote_lines`, `contracts`, `subscriptions`, `subscription_entitlements`, `invoices`, `invoice_lines`, `payment_events`, `credits_refunds`, `checkout_sessions` | **financial records, kept past account deletion, for seven years after the end of the year they were made** (D-132). For an individual subscriber, `purge_financial_records()` removes finished records past that line, monthly; a live subscription is never removed, and an institution's records follow its contract | what was sold, signed, invoiced and paid. Deleting an account sets `billing_accounts.user_id` to null, so the invoice survives without pointing at a person; an individual account is named "Individual subscriber", never by email. No card or bank data is stored anywhere; a payment event keeps the provider's event id and a hash of the payload, not the payload. A checkout keeps when consent was given and to which wording |
| `dunning_cases`, `dunning_actions`, `cancellation_requests` | **with their subscription** | the record of a failed payment's reminders, final notice and restriction, and of a cancellation and its optional reason. Append-only where it records what happened |
| `implementation_projects`, `implementation_milestones`, `success_plans`, `qbrs`, `renewal_opportunities`, `account_health_snapshots` | **kept until Semester removes the billing account** | an institution's delivery and renewal records and Semester's account-level health view of it. No student data: health snapshots accept only the account-level signal keys in `private.health_signals_ok`. A staff member's account deletion clears them as owner or reviewer |
| `compliance_frameworks`, `compliance_controls`, `control_evidence`, `claims_register`, `content_register`, `cta_routes` | **kept until Semester removes the entry** | governance configuration behind the company site: controls, where their evidence lives, public claims, content ownership and where each call to action routes. Names nobody but the staff owner, cleared on that account's deletion |
| `payment_rails` | **kept until Semester retires the rail**: a rail is marked retired, not deleted | which payment provider Semester uses in which mode and the capabilities it has wired for it. Holds no credential and no person: the capability keys are a closed list, so a secret cannot be stored there. Service role only. `20261006090000_payment_rails_and_event_inbox.sql` |
| `provider_event_inbox` | **kept; no clock yet** — the period is a retention decision nobody has made (D-132 sets seven years for the financial records themselves, and whether this record counts as one is the owner's and the accountant's to say). Never deleted from: a trigger refuses it | one row per signature-verified payment-provider event: the provider's event id, a hash, when it happened and where it is in being applied, and a bounded projection of ids, amounts, currency, statuses and times. **Not the payload, no name, email or address, and no card number** (a 13 to 19 digit run is refused). Service role only; nothing reads or writes it yet. `20261006090000_payment_rails_and_event_inbox.sql` |
| `access_sagas` | **kept; no clock yet** — how long a record of who was granted what, and when it was revoked, is kept is a retention decision nobody has made. Never deleted from: a trigger refuses it | one row per access request in flight or finished: the subject, the one resource and action asked for, a digest of the request, the saga's state and revision, and the grant's id and expiry. **No credential, no message and no decision payload**: errors are short codes. Service role only; nothing reads or writes it yet. `20261006180000_access_saga_store.sql` |
| `access_saga_events` | **kept; no clock yet**, with `access_sagas`. Append-only: a trigger refuses any rewrite and any delete, and only its publication time is ever set | one row per saved move of a saga: its id, the revision, the time and a reason code. It is the audit trail and the outbox in one. Service role only. `20261006180000_access_saga_store.sql` |
| `access_saga_signals` | **kept; no clock yet**, with `access_sagas` | one row per signal a saga has been woken by, so a replay is recognised: the saga, the sender's event id and the kind. No claim of identity or approval. Service role only. `20261006180000_access_saga_store.sql` |
| `site_leads` | **no time-based purge yet** — the period must be set before the company site's forms go live | what a visitor typed into a company-site form: name, work email, organization, role, message, the page it came from. No IP address. Service role only; the owner reads the notification email. `20260929080000_commercial_automation.sql` |
| `site_lead_hits` | **one day**, trimmed on every submission (up to 200 older rows each time) | a salted hash of a submitting network's address and when, for the five-an-hour rate limit. Never the address itself |
| `invites`, `access_gate` | **`invites`: kept while an account has the address; otherwise 90 days after sending. `access_gate`: one row, kept** | the allow-list of addresses and the switch. See *Invitations, abandoned accounts and audit events* below |

## Invitations, abandoned accounts and audit events

This section used to be called *What has no answer*, and listed two:
`invites` had no expiry, and an abandoned account was kept forever. Both are
decided now, with audit-event retention beside them, in
`supabase/migrations/20260929030000_retention_sweeps.sql`. That file's header
has the same reasoning at more length, and `supabase/retention-sweeps.check.sql`
checks each rule on both sides of its line.

**Invitations: 90 days if never taken up.** An address on `invites` that never
became an account is removed ninety days after it was invited — the same
argument `access_log` was given its ninety days on: an address collected for a
pilot that ended is a record kept for no one's benefit. An invitation whose
address has an account is kept while that account exists, as the record of how
it was let in; once the account is deleted, the next sweep removes it.
`beta_invitations` follows the same period on its own columns.

**Abandoned accounts: two halves, and they differ on purpose.**

- A sign-up that was **never confirmed and never signed in** is deleted thirty
  days after it was made. Without a sign-in there was never a session, so
  row-level security never let it write a row: the account holds an address and
  nothing else, and removing it removes no work. Accounts an LTI launch creates
  are created confirmed, so they are never in this set.
- An account that was **used and then left is kept**. The privacy screen
  promises "until you delete it", and a student who comes back in January
  should find their semester. Retiring dormant accounts belongs to the
  institution that owns the relationship — SCIM deprovisioning, or a schedule
  in the school's own agreement — not to a clock this project runs over
  students' work. Block 7 of `supabase/health.sql` counts accounts idle for one
  and two years, so the number is visible without anything acting on it.

**Audit events: 3 years.** `role_grant_audit_event`, `moderation_audit_event`
and `provisioning_audit_event` are removed three years after the event: three
times a SOC 2 look-back, and the length of the access-review cycle a university
runs on, without becoming a permanent history of every role anybody held. Each
table is still immutable — its trigger refuses every update and every delete
except a delete of a row past three years, inside the sweep's own transaction.
`support_access_event` is **not** swept (FERPA 99.32, in its row above), and
`tenant_policy_audit_event` goes with its school. A school whose agreement needs
a longer period changes two intervals, and `retention.test.ts` holds them
together.

**The operations console (`20260929100000_console_control_plane.sql`).**
`operator_preference` is one operator's own saved views and navigation state
and goes with the account (cascade from `auth.users`). `council_seat_holder`
is the record of who held which council seat over which period: an ended seat
keeps its row with an end time, and the row goes only with the account.
`console_duty` is the duty matrix as rows, written only by migration.
`console_audit_event` is the console's append-only, hash-chained audit archive
and is **never swept**: it is a protected archive, its trigger refuses every
update and delete, and `private.sweep_audit_retention()` does not name it —
`supabase/console-control-plane.check.sql` asserts the sweep leaves its rows.
`console_audit_manifest` (one signed manifest per day) and
`console_audit_verification` (one row per nightly verification run) are
insert-only for the same reason, and `console_audit_key` is the one signing
key, seeded once and rotated only by a recorded decision.

**Approvals, break-glass and the commercial core
(`20260929110000_console_approvals_and_break_glass.sql`).** `approval_request`
and `approval_decision` are the record of who asked for a high-risk action and
who approved or refused it, and are kept for as long as the accounts they name:
a requester's or approver's rows go with that account (cascade), and nothing
else deletes them, because a decision with no record is the failure the
two-person rule exists to stop. `console_action_record` is the effect of an
approved action that has no table of its own; it is pinned column by column,
and only its actor column clears when that account is erased. `break_glass_grant`
is every emergency access ever opened, with its ticket, expiry and post-use
review, and goes only with the subject's account. `customer`,
`customer_commitment` and `customer_contract` are a school's commercial
record, scoped to the tenant, written by the service role and never by a
browser; they follow the tenant, and a contract row is kept for the life of
the school row it belongs to. None of these has a time-based sweep, and each
is small: one row per request, decision, grant or contract, never per student.

`platform_release_evidence` is the platform's dated proof for restore, legal,
infrastructure, deployment, TLS and migration gates. It is kept until Semester
removes it under an approved evidence-retention decision; there is no automatic
sweep. It contains a named approver and a reference to evidence, never the
evidence file or a secret, and clearing the recorder on account deletion leaves
the institutional proof intact. The command center treats an expired row as a
blocker rather than deleting it, so the history remains reviewable.

`platform_incident` is the service-written incident timeline metadata: severity,
owner, affected workflows, customer impact, lifecycle dates and opaque release
or rollback references. Tenant incidents are kept with the school; platform
incidents are kept until Semester removes them under an approved
evidence-retention decision. There is no automatic sweep yet. Account deletion
clears the recorder reference and leaves the operational record; notice bodies and
recipients remain in `governance_incident_notices` under that table's policy.

**The outbox, receipts and invalidations: retention exists but is not scheduled.**
`domain_outbox_events`, `domain_event_receipts` and `projection_invalidation`
are service-role only. The feature-policy audit trigger now writes one bounded
`entitlement.changed` event in the same transaction as its source and audit;
the private tenant-entitlement apply function can settle that event into a private read
model, receipt, watermark and invalidation in one transaction. A bounded manual
worker endpoint now exists, but its dedicated secret is intentionally absent
and no schedule invokes it; no production operation is inferred.

Each event row declares a retention class so
`private.prune_projection_history()` can apply this file's policy without
reading its payload. Published payloads are scrubbed after 30 days. Published
terminal envelopes and their receipts expire after 90 days for operational
events, 400 days for student-record and commercial events, and three years for
audit events. Invalidations expire after 90 days. Pending and dead-lettered
events are never scrubbed or expired, and a tenant or platform legal hold keeps
the rows it covers. The function is service-role only and intentionally has no
scheduler entry; deployment, activation and a live retention run remain
unverified. `docs/API-PLATFORM.md` §4.4 and ADR 0008 remain the operating
boundary.

## Legal holds

A hold is the one instruction a clock has to obey. `supabase/migrations/20260930100000_legal_holds.sql`
adds `legal_holds`, and `supabase/legal-holds.check.sql` checks each rule below
on both sides of its line.

- **Placed** by someone holding `hold:place` over the school (a university administrator),
  with a reason and a matter reference, and only over an account whose profile
  belongs to that school. A **platform** hold is not self-serve: it is placed
  by an operator as the service role.
- **Released** by a different person holding `hold:release`, with a reason,
  once. The two-person rule is a CHECK on the row. A school with a single
  administrator cannot release its own hold; the way out is break-glass.
- **Never deleted, never edited** except to record the release.
- **What it stops.** The invite sweep and the audit sweep skip what a live hold
  covers (a platform hold pauses them; a school hold keeps that school's
  events); the abandoned-sign-up sweep skips held accounts; the erase-account function
  refuses a held account before it touches a single row, and says why
  (20260930140000_erase_respects_holds.sql; the student is told it is not a
  fault and given no reason); a `before delete` trigger on `auth.users` is the
  backstop behind it. Erasure runs as normal once the hold is released. A hold on
  a school covers every account in it.
- **What a platform hold also stops.** The AI-runtime and Community sweeps run
  through `private.run_sweep` (20260930130000_hold_gated_sweeps.sql), which
  skips them while a platform hold is live and says so in its result.
- **What a school or account hold also keeps.** Those two sweeps
  (20260930170000_hold_aware_sweeps.sql) skip a school's AI usage metadata under
  a school hold, and every Community row that belongs to a held account, or to
  an account in a held school: restrictions, safety entries, posts, reports,
  hosted sessions, volunteer tasks and uploaded images, and a case while its
  post's author or a reporter is held.
- **What projection retention keeps.** `private.prune_projection_history()`
  never touches pending or dead-lettered events. It preserves published event
  envelopes, receipts and invalidations for a held school, and a platform hold
  visibly skips the whole operation. The function is manual and service-role
  only; no retention schedule is activated by its migration.
- **What it also keeps, in the last three sweeps.**
  20261004150000_holds_reach_the_last_three_sweeps.sql added the clause to three
  functions that deleted without asking, found by reading every function that says
  `delete from` and is named like a sweep, a purge or an erasure:
  `sweep_tombstones()` keeps the deleted work of a held account, or of one in a held
  school (the deletion is not undone; the physical removal waits for the release);
  `purge_financial_records()` keeps everything of an individual subscriber while the
  account that owns it is held, and a billing account with no owner left (which an
  account hold cannot name) follows the platform hold only; and
  `gateway_purge_journal()` keeps a held school's review, audit, intelligence-audit
  and action rows, and a held account's when the actor is that account's id (the
  actor is text, so it is cast only when it reads as a UUID). The one-day
  `gateway_rate_limit` window is replay protection, not a record, and is
  unconditional. `supabase/hold-blind-sweeps.check.sql` runs each against a held
  and an unheld twin and checks that a release lets the next sweep remove what
  was kept; `retention.test.ts` holds each one's last definition to its clauses.
- **What it does not stop yet.** The escalation deliveries and the volunteer
  programme's events carry no account and follow the platform gate only; and
  on-device deletion is not hold-aware. The provider's backups are not reached
  by a hold either (see *Backups* below). The AI, restriction and safety-entry
  deletes, and the three above, are exercised against real rows; the rest carry
  the same clause and are held to it by a test, not exercised. Maturity rows
  RM-02, RM-04, RM-05 and RM-08 are partly answered, not closed, for that reason.

## Backups: the provider's copies, and how long a deleted row outlives its deletion

Everything above is about rows in the live database. Supabase also keeps
backups of the whole database, and nothing in this file reached them until
now — which [`docs/trust/DPA-CHECKLIST.md`](docs/trust/DPA-CHECKLIST.md)
recorded as "backup retention not recorded" and the evidence register counted
as the gap in its *Backups* class. This section is the lifecycle.

**What they are.** The provider's own backups of the database — the
physical, dashboard-side copies that [`RESTORE.md`](RESTORE.md) distinguishes
from the logical dump the CI rehearsal restores; this section is about the
provider's copies and not the rehearsal's — taken daily on its schedule,
encrypted at rest, in the project's own region (us-west-2; `DR-03` in the
maturity register says the same), and readable by nobody in the ordinary
running of the service: no code in this repository, no Edge Function and no
browser role can open one. A backup is used for exactly one thing, restoring
the database after the day the data is wrong, and `RESTORE.md` is the
procedure.

**How long they live.** Each daily backup expires **7 days** after it is
taken, on a rolling schedule the provider runs. **That number is the plan
tier's documentation, not yet read off the dashboard on any date.** The
tier itself was read on 29 September 2026 through the organization record:
Pro, for which Supabase's backups page gives seven days of daily backups; the
Backups page of the project has still not been read.
`RESTORE.md` says the tier, the schedule and the enabled features are
dashboard settings nothing in this repository can read, and its table is where
the verified figure goes with a date and an owner; BCDR-01 in
[`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](docs/market-readiness/HECVAT_DRAFT_RESPONSE.md)
repeats the same unverified figure and says so. `app/src/lib/retention.test.ts`
holds the two files to one number; it cannot verify the provider, and a
reader should not take the test for that. Point-in-time recovery, which would
keep a continuous log for 7, 14 or 28 days, is not confirmed to be on; if it
is switched on, its retention becomes the number here.

**What that means for a deletion.** When a student deletes a note or their
account, the live rows go at once, as the sections above say. The copy of
those rows in a backup taken before the deletion stays until that backup
expires, so **a deleted row outlives its deletion by at most the backup
retention — 7 days — and then by nothing, with one exception: a restore from a
backup taken before the deletion, below.** No process reads it in that
window, and nothing restores it on its own. This is the period
[`docs/legal/TERMS-OF-SERVICE-DRAFT.md`](docs/legal/TERMS-OF-SERVICE-DRAFT.md)
refers to as "backups kept for the period our Privacy Policy states", and the
privacy-policy draft now states it. It is not an archive: the app's privacy
text promises no archive kept after an account is deleted, and a backup that
nobody can read, that exists only to put the whole database back, and that
expires by itself is what keeps that sentence true.

**What a restore owes this file.** A restore to a moment before a deletion
brings the deleted rows back, because the backup predates the delete. A
restore is therefore not finished when the fingerprints match: the deletions
and the sweeps that ran between the backup time and the restore have to be run
again before the restored project is opened to anyone; a row that a restore
brought back would otherwise outlive its deletion by more than the backup
retention, reachable, for as long as the replay waited. `RESTORE.md` now carries that as
its own step, *Re-apply the deletions made after the backup point*, with what
it can use today — the sweeps, which re-run on their schedule, and whatever
was kept outside the database — and what it cannot: a student's own deletion of a note
or an account leaves a record with the date and the row counts and
deliberately no account, so a self-deletion inside that window cannot be
replayed from anything the tree holds, and the step says to tell every account
that existed in the window rather than pretend to know whose it was. A durable deletion record that a restore
cannot undo — a salted hash of the account, the table and the time, kept
outside the database being restored — was considered and not built (D-124,
29 September 2026): it would keep a trace of who deleted what, which this
file's design does not, and the founder chose the exception over the trace.
So the promise above carries this exception as its standing form, not as an
interim, and the privacy-policy draft says so in the same words. Counsel may
reopen the choice with the legal drafts.

**Not yet true.** No drill has restored production data, so the recovery point
and time in `RESTORE.md` are unmeasured; the 7 days is the tier's number, not
one read off the dashboard on a date; and a legal hold does not yet reach the
provider's backups. Legal holds exist for the live database (see *Legal holds*,
above), but nothing stops a backup expiring under one (`RM-02`, `RM-04`).

## Changing any of this

1. Decide it, and write the reason here — this file is the record.
2. If it touches what a student sees, `app/src/lib/privacy.ts` says it in the
   app, and that text is what people are actually told. It wins over this file;
   this file explains it.
3. Run `supabase/check.sh` — the policy suites run against a real Postgres with
   every migration applied, and a retention change that breaks a delete policy
   fails there rather than in production.
4. `npm test` from `app/` runs the tripwire.

### Decision productivity workspace

| Table | Kept for | Removal |
| --- | --- | --- |
| `productivity_workspace` | Until the student deletes the cloud copy or deletes their account; no automatic expiry | Owner-scoped delete; foreign-key cascade when the authentication account is deleted |

Cloud workspaces include private reflections and history. Sharing institution aggregate counts is opt-in, requires active membership, and is suppressed below ten consenting members. Administrators receive counts only. Device copies and exported files remain under the student's control. Source checks store no page bodies or URLs server-side.

Connection legal holds also prevent deletion of the connection, including cascaded deletion, until the hold is explicitly released. This keeps the connection hold attached to its surviving evidence.
