# Roster and data loading

> **Type:** explanation · **Audience:** implementers, institution-admins · **Owner:** `data` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This page says plainly which ways exist today to get people, school information and legacy data into Semester, and states that a roster import does not exist; stop reading if you expected a CSV upload of enrolments.

**Status:** `PLANNED` for roster loading. OneRoster staging and reconciliation has no adapter. What exists is partial: people and roles come through SCIM (`IMPLEMENTED_NOT_RELEASED`), school information comes through a file a student loads on their own device, and legacy exports are compared in the Migration Center (`IMPLEMENTED_NOT_RELEASED`, never used on a real migration).

<!-- status: OneRoster staging and reconciliation = PLANNED -->
<!-- status: SCIM 2.0 = IMPLEMENTED_NOT_RELEASED -->
<!-- status: Migration Center (dry run, parallel run, cutover, rollback, archive) = IMPLEMENTED_NOT_RELEASED -->
<!-- labels: app/src/components/SchoolPackDoor.tsx :: A file from your university, Before this is kept -->
<!-- labels: app/src/screens/University.tsx :: Migration -->
<!-- paths: docs/SCHOOL_DATA_PACK.md, app/src/lib/schoolpack.ts, app/src/lib/interop.ts, docs/institutional-readiness/ONEROSTER-READINESS.md, docs/UNIVERSITY_CONNECTIONS.md -->

## The four routes

| Route | What it loads | Who runs it | Status |
| --- | --- | --- | --- |
| SCIM | People (memberships) and their roles from approved group mappings | Your identity provider | `IMPLEMENTED_NOT_RELEASED`. See [SCIM provisioning](SCIM-PROVISIONING.md) |
| School data pack | Calendars, deadlines, buildings, dining tiers, campus addresses and capabilities for your school | A student, on their device | Built; a snapshot, not a connection |
| Migration Center | Comparison of an export from a retiring system against what Semester holds | Semester implementation staff with your data owner | `IMPLEMENTED_NOT_RELEASED` |
| OneRoster, LTI Names and Roles, SIS adapter | Rosters, sections, enrolments | Nobody | `PLANNED`, refused or absent |

## What does not exist

- **A roster import.** No screen, file format or endpoint accepts a list of enrolled students.
- **OneRoster.** [`app/src/lib/interop.ts`](../../../app/src/lib/interop.ts) holds a register of the standards Semester supports or intends to; there is no adapter.
- **LTI Names and Roles.** It is refused. See [LTI setup](LTI-SETUP.md).
- **A production SIS or LMS adapter.** The adapter registry is empty on purpose. The truth table records that every real service answers 503, and the gateway runs on a sandbox institution. The registry stays empty until a university writes an adapter and approves it for real student records.

Because of this, "Sections and enrollments reconciled" in the pilot phase plan cannot be performed on live data today. Plan the pilot cohort as people provisioned through SCIM, not as a roster read from your registrar.

## The school data pack

A pack is one JSON file, up to 4 MB, with a required `semesterSchoolPack` version of 1 and a `name`. It describes the institution: `capabilities` (which campus screens exist) and `data` (an academic calendar, meal plan tiers, housing dates, grading scale, buildings). It has no field for a person, a roster, a grade or an enrolment, and the format does not plan one.

What happens on load:

1. The student chooses a file under `A file from your university`. Choosing it does not import it.
2. The screen shows what the file contained and what could not be used, under `Before this is kept`, and asks.
3. The file is refused whole only when it is not valid JSON, has no version, has a newer version than the build reads, has no name or is over 4 MB. Otherwise everything usable loads and every part left out is listed by name.
4. Over-large sections are truncated and the app says how many were left out.
5. The app never accepts `verified: true` from a file.

A pack is a snapshot someone was handed, like a syllabus. It can go stale without the app noticing, which is why the app shows its `importedAt` date beside anything the pack supplied. It is loaded by each student on their own device; you cannot push one to a cohort.

Start from a blank template or from the school's current profile, both exported in the app, and send the list of problems back to whoever produced the file. The format reference is [`SCHOOL_DATA_PACK.md`](../../SCHOOL_DATA_PACK.md).

## Migration Center

The Migration Center under University, `Migration`, is for migrating from a system you are retiring. It reconciles exports you supply and does not read your systems. See [parallel-run evidence](PARALLEL-RUN-EVIDENCE.md) for its stages and what its counts are not.

## What to do instead, today

1. Agree the cohort by identity: who is provisioned through SCIM, with which group mappings.
2. Give students the dates that cost money (add and drop, withdrawal, registration opening) as a school data pack, or let them add the registrar's term calendar themselves on Term deadlines.
3. Keep your registration, payment and submission in your own systems. Semester shows what students put in or what a pack supplies, with its source and date.
4. Treat any roster-dependent acceptance check as not performable until an adapter exists and is approved.
