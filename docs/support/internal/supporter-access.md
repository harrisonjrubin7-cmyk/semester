# What a supporter may see

> **Type:** runbook · **Audience:** support, operators · **Owner:** `privacy` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page to know exactly what data a person answering a support request can reach and how a student opens a bounded view; stop reading if you are answering a how-to, because that needs no access to anything.

**Status:** IMPLEMENTED_NOT_RELEASED. The database boundary and the Privacy surface exist and are tested. The pilot criterion is unmet until real university role provisioning is connected and the flow is exercised with two real tenant accounts ([support playbook](../../market-readiness/SUPPORT_PLAYBOOK.md)).

## The default is no access

A person answering support cannot read a student's semester. There are three doors, and each is narrow.

| Door | Who | What they get | What they never get | Where it is enforced |
| --- | --- | --- | --- | --- |
| **Support ticket** (off by default) | A platform `support_agent` | The ticket subject, thread and any app details the student ticked | The student's name, email or account id | `supabase/migrations/20260928210000_support_tickets.sql` |
| **Help request to a campus office** | That office's staff | Words only after they open the request, which the student can see | Anything the student did not tick | `supabase/migrations/20260927230000_help_requests.sql` |
| **Support access window** | One verified supporter at the student's own university | Aggregate learning counts, for one to seven days | Notes, excerpts, mistake detail, captures, protected traits, inferred emotion | `supabase/migrations/20260925103000_support_access.sql`, `supabase/migrations/20260925160000_support_access_ui.sql` |

## Tickets: the six keys

When tickets are on, a student may attach app details. Each starts unticked and is shown with its value before sending. The database accepts exactly six keys, held by a test against the migration:

| Key | What it is |
| --- | --- |
| `app_version` | App version |
| `device_class` | Kind of device |
| `screen` | The screen, without anything after its name |
| `signed_in` | Whether the student is signed in |
| `sync_state` | Whether their work has synced |
| `offline` | Whether they are offline |

Never included, as the panel says: notes, files, grades, conversations with the assistant, or anything from the student record. The queue and thread functions return no account id, name or address. Only the student closes a ticket. Five tickets per account per day is the limit. First-response targets are computed from the category (see [severity and routing](severity-and-routing.md)); they are not commitments.

## The support access window, verified

Each statement below was checked against the migrations, not copied from the playbook.

- **The student creates it.** `create_support_access` runs as the signed-in student. It refuses a window outside one to seven days: "Support access must last between one and seven days."
- **The supporter must be a verified supporter at the same university.** The function requires the supporter's profile to be at the student's school and to hold the `support:read` capability at school scope. Otherwise: "That account is not a verified supporter for your university."
- **The table also enforces the limit.** A check constraint requires `expires_at` no more than `interval '7 days'` after creation. The only scope allowed is `learning-progress`.
- **Consent is a record.** Creating a window inserts a `consent_record` with policy version `support-access-v1` and the same expiry. Revoking the window revokes the consent. Revoking the consent ends the window.
- **One active window per pair.** A second is refused while one is active.
- **Only the student can revoke it.** "Only the student who created this access can revoke it." The Privacy screen offers **Revoke now**.
- **Every read is recorded.** `read_support_signals` records each read in `support_access_event`, which holds typed fields and one-way hashes, never a name, email, reason, note or excerpt, and ordinary accounts cannot change or delete it.
- **What a read returns.** For each course: an evidence count, an average score, a mistake count and the time of the last observation.

On the student's side, the Privacy screen shows **Academic support access**, **Grant support access**, **Active windows** and **View aggregate signals**.

## What this means in practice

- **Semester's own platform support agent is not the supporter in this flow.** The grant function names a supporter at the student's university with `support:read` at school scope. A platform `support_agent` reads tickets, not windows. The [reliability register](../../SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md) says a student-granted window is how an agent gets data. The migration is what runs, and it does not allow that route for someone outside the student's school.
- **No verified supporter exists yet.** Until a university provisions roles, there is nobody a student can grant a window to.
- **Never ask for a password, a session or a screenshot to "see what the student sees".** Ask for the facts in the macro's list.
- **Revoke at closure.** If a window was used to resolve a case, tell the student they can end it with **Revoke now**.

## What to do with anything else

Record the facts, not the content. Escalate through the [escalation map](escalation-map.md). Any request to see more than this table allows is a privacy question for the privacy seat, which counsel holds.
