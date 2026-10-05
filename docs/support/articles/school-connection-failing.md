# My school's connection is failing

> **Type:** help · **Audience:** students, institution-admins · **Owner:** `data` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page when something that should arrive from your school (a course-site launch, a calendar, a record) does not, or when you run a connection for a school and it is stale or failing; stop reading if you are asking why your school is not connected at all, because the answer is in the first paragraph below.

**Status:** PARTIAL. No registrar, student-information or learning-system connection is live for any institution. The framework is built and tested with mock adapters, the adapter registry is deliberately empty, and the learning-system launch has only been tested against a test platform ([known limits](../../pilot/KNOWN-LIMITATIONS.md)). Single sign-on through a school is configured for no institution.

## Symptom

You say one of these (student view):

- "Semester is not showing my school's records."
- "I opened Semester from Brightspace and it made me a new account."
- "My calendar from school is stale."

Or one of these (administrator view):

- "A connection shows stale, error or a dead letter."
- "Launches from the course site fail."
- "A student asks what we share, or wants it stopped."

## Check

**Student view**

1. Today, what Semester shows about your school came from what you gave it: a syllabus, a pasted schedule, a calendar link or an .ics file. The official system is the one that counts. Register, drop, pay and submit in your university's own systems.
2. For a calendar from school, see [my calendar isn't updating](calendar-not-updating.md).
3. If you launched Semester from Brightspace and got a second account, open **Connect accounts**. If you already had an account, sign in to it first, then press **Connect my existing account**.
4. Open **Privacy and your rights** and find **What your school shares with Semester** to see what, if anything, is shared, with source, purpose and freshness.

**Administrator view**

1. Run `integration_health()` (service role) or open the University dashboard, **Connected systems**. Look for stale for more than one check, status error, or open dead letters for more than a day ([integration operator runbook](../../INTEGRATION-OPERATOR-RUNBOOK.md), section 3).
2. Check that the connection is approved, not paused, its connector flag is `production` for the school, and no kill switch is engaged. The worker refuses otherwise (runbook, section 4).
3. For launch failures, check issuer, client, deployment, key set and tenant membership ([incident playbook, identity failures](../../INCIDENT-RECOVERY-PLAYBOOK.md)).

## Fix

**Student**

1. Use the official source for anything that matters, and note the date Semester shows for it.
2. "Nothing is matched on your email address." is deliberate: connecting needs the launch and you being signed in to the account you want. If the new account already has work in it, the app refuses rather than merging them, and says "get in touch and we will do it by hand."
3. To stop your school's records being read, revoke on the same Privacy panel. Deleting and revoking are separate on purpose.

**Administrator**

1. Pause with `integration_set_paused`, fix the cause, then resume. Resume goes through `configuring`, never straight to `healthy`.
2. Replay a dead letter with `integration_request_replay`. The dashboard confirms: "Replay requested. A worker will run it and record the outcome." The next scheduled tick runs a fresh pull.
3. To stop everything, engage the narrowest kill switch that covers it (one connection, one school, then global). Release it when fixed.
4. Export a count-only summary with **Export health summary**. It holds counts and states only.

## Not your fault

- **Your school has no connection.** That is the state for every school today.
- **The school's own system is down or changed.** Only that school's connectors fail; the app and your own data keep working ([degraded modes](../../DEGRADED-MODE-MAP.md)).
- **A stale source is labelled stale.** The app shows when a source last updated, or says the update time was not recorded, instead of inventing an age.

## Contact

Students: contact your school's help desk first where it asks you to. Its agreement with Semester sets the support it receives ([support policy draft](../../legal/SUPPORT-POLICY-DRAFT.md)).

### What to send

- Which launch or calendar, and the word-for-word message.
- The time, and whether it is one person or many.
- For administrators: the connection's public id, status, last successful sync and open error counts. These are counts and states, not records.

### What not to send

- Student records, grades, rosters, accommodations or conduct details. The database refuses these scopes, and a message should not carry them either.
- Provider credentials, client secrets, tokens or key material. A credential reference is not the secret; send neither.

### Status and known limits

- [Status page source](../../../app/public/status.html) and [known limits](../../pilot/KNOWN-LIMITATIONS.md).
- No response time is committed. See [how support is staffed](../README.md#staffing-today).

<!-- labels: ["Connect accounts", "Connect my existing account", "Nothing is matched on your email address.", "get in touch and we will do it by hand.", "What your school shares with Semester", "Privacy and your rights", "Connected systems", "Export health summary", "Replay requested. A worker will run it and record the outcome."] -->
