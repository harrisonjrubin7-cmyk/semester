# The school data pack

**What to send us, and what happens to it.**

This is the document to hand a university that has agreed to share its data
with Semester. It is a file format, not an integration: nothing in it requires
the university to run anything, expose an API, or grant an account. One file,
sent once a term, loaded on the student's own device.

It exists so that the engineering is finished before the partnership starts.
Every screen described below is already built and already reads this format —
what is missing is the data, and the data is the university's.

---

## 1. What this is not

Worth saying first, because the mistake is expensive in both directions.

A pack is **a snapshot somebody was handed**, exactly like a syllabus. It is
not a connection, not a login, and not read access to any system. It cannot
go stale politely: the dates in it were true when the file was written, and
the app has no way to notice when they stop being. That is why `importedAt`
matters and why the app shows it next to anything the pack supplied. A pack
without one still loads — refusing the whole file over a missing date would
be worse — but the student is told, in those words, that the app cannot say
how old these dates are.

The other thing — a live connection to a registrar, a bursar or an LMS —
exists in this repository as `app/server/institution/`, and its production
adapter registry is **empty and stays empty** until a university writes an
adapter and approves it for real student records. A pack is not a step
towards that and does not want to look like one. See
[UNIVERSITY_CONNECTIONS.md](UNIVERSITY_CONNECTIONS.md).

## 2. The format

One JSON file. UTF-8. Under 4 MB — a campus of two thousand buildings is
about two hundred kilobytes, so if a pack is near the limit something else is
in it.

```jsonc
{
  "semesterSchoolPack": 1,          // required, and must be 1
  "id": "vanderbilt",               // optional; derived from the name if absent
  "name": "Vanderbilt University",  // required
  "shortName": "Vanderbilt",
  "emailDomains": ["vanderbilt.edu"],
  "importedAt": "2026-08-01",       // the day this file was written; see §1
  "capabilities": { /* §3 */ },
  "data": { /* §4 */ }
}
```

**`id` matters more than it looks.** It is what the app matches a pack against
an existing profile by. A pack for a school the app already knows must carry
that school's id, or it lands beside the profile it was written to correct
instead of on it. If you are correcting a school Semester already ships,
export it first (§6) and keep the id it gives you.

The app will **never** accept `verified: true` from a file, whatever the file
says. That flag means "not editable by a stranger", and a file is from
outside by definition.

## 3. `capabilities` — what the university has

Each of these switches a screen on. A capability that is absent means the
screen is not offered at all: it does not appear in navigation and it does not
appear in search. **No screen renders an empty state apologising for somebody's
university.** So leaving a field out is a real answer and often the right one.

| Field | Type | What it decides |
| --- | --- | --- |
| `mealPlan` | `"swipes"` · `"dollars"` · `"both"` · `"none"` | Whether the Meals screen exists, and whether it counts meals, money or both |
| `cardName` | string | What the campus card's money is called — "Commodore Cash" |
| `swipeUnit` | string | What one meal is called — "meal swipes", "board meals" |
| `housing` | boolean | Whether the app manages a move-out date |
| `campusMap` | boolean | Whether there is a map |
| `registrarName` / `registrarUrl` | string / https | The registration system — "YES" |
| `orgPortalName` / `orgPortalUrl` | string / https | The student organisations portal — "AnchorLink" |
| `lmsName` / `lmsUrl` | string / https | The course site — "Brightspace" |
| `lmsIcsHelpUrl` | https | Where the university tells students to find their calendar feed |
| `athleticsName` | string | "Commodores" |
| `libraryUrl`, `healthUrl`, `advisingUrl` | https | The three addresses students look up most |

Every URL must begin with `https://`. One that does not is **left out and
reported by name**, rather than dropped silently — if somebody filled in a
field expecting it to appear on a screen, they find out.

## 4. `data` — the depth a yes/no cannot hold

Every branch is optional. A branch that is absent means the app asks the
student instead, which is a worse experience and an honest one.

### `academicCalendar`

The expensive dates. A syllabus carries the assignments; the registrar carries
the ones that cost money — add/drop closing, the withdrawal deadline, when
registration for next term opens.

```jsonc
"academicCalendar": [{
  "termName": "Fall 2026",
  "startsOn": "2026-08-26",
  "endsOn": "2026-12-11",
  "finalsFrom": "2026-12-05",
  "finalsTo": "2026-12-11",
  "deadlines": [
    { "label": "Last day to drop without a W", "on": "2026-09-04" },
    { "label": "Last day to withdraw from a course", "on": "2026-10-30" }
  ],
  "breaks": [{ "label": "Fall Break", "from": "2026-10-22", "to": "2026-10-23" }]
}]
```

- Dates are `YYYY-MM-DD` and must be real days. `2026-02-30` is refused, and
  so is a full timestamp — send `2026-08-26`, not `2026-08-26T00:00:00Z`. The
  app refuses the timestamp rather than trimming it, because a timestamp
  trimmed in a different timezone from the one it was written in moves the
  date by a day without saying so.
- **A date you have not published yet: leave it out or send `""`.** That is a
  supported answer and a better one than a guess. The app reads a blank date
  as "not published" and shows nothing, which is what the bundled Vanderbilt
  profile does today for the last day of classes.
- A term needs a name. Everything else about it is optional.
- **Deadlines outside the term are expected and are kept.** Registration for
  next term opens inside this one; final grades are due after the last class
  day. The app does not range-check them against the term.
- Labels are matched against the deadlines Semester knows about, so a student
  sees "Last day to drop without a W" with the consequence written under it.
  An unrecognised label is kept in the university's own words.

### `buildings`

```jsonc
"buildings": [{ "name": "Featheringill Hall", "abbr": "FGH", "lat": 36.1447, "lng": -86.8027 }]
```

`lat` and `lng` are **numbers, not strings**. A row whose coordinates are
exactly `0, 0` is refused and reported: that is the Gulf of Guinea, and it is
what an unfilled spreadsheet column becomes when a coordinate field is
exported as a number. A pin in the ocean is the one failure a student cannot
read as missing data.

### `mealPlanTiers`

```jsonc
"mealPlanTiers": [{ "name": "First-Year Plan", "swipes": 335, "dollars": 225, "period": "term" }]
```

`period` is `"week"` or `"term"`. A tier missing either number is refused
rather than priced at zero — the Meals screen does arithmetic with these, and
a plan the app believes is free is a worse answer than a plan it does not
have. A genuinely free plan sends `0`.

### `housing`

```jsonc
"housing": { "moveOutRule": "hours_after_last_exam", "hoursAfterLastExam": 24 }
```

Two rules: `"fixed_date"` with a `fixedDate`, or `"hours_after_last_exam"`
with an optional `hoursAfterLastExam` (1–720, default 24). The second is a
rule rather than a Vanderbilt fact, and any university that counts move-out
from a student's last exam uses it.

### `gradeSystem` and `gradingNotes`

Most universities publish what an A− is worth towards a GPA and leave the
percentage that earns one to the instructor. If that is true of yours, send
nothing here: the app uses a common table and tells the student it is an
assumption, which is more honest than a number nobody wrote.

If your university does publish a scale:

```jsonc
"gradeSystem": { "kind": "letter", "gpaMax": 4, "scale": [{ "label": "A", "min": 93, "gpa": 4.0 }] }
```

This is the one branch that is not inert — it decides what the app tells a
student they need on the final — so a scale that cannot be read is reported
rather than dropped quietly.

### `athleticsFeedUrl`

An `https` address for a fixtures feed, if one is published.

## 5. What happens when something is wrong

**The file is refused whole** for only a few things, each of which means it is
not a pack at all: it is not valid JSON, it has no `semesterSchoolPack`
version, the version is newer than this build reads, it has no `name`, or it
is over 4 MB.

**Everything else loads, and every part that could not be used is listed by
name.** A first export is never clean, and the realistic failure is not a
broken file — it is fourteen of two hundred buildings missing coordinates
because one column was never filled in. The student sees:

> **Featheringill Hall** — This building was left out: lat must be a number
> between −90 and 90, and lng between −180 and 180.

That list is the deliverable of a first import. It is meant to be sent back to
whoever produced the file.

Over-large sections are **truncated, not refused**: 12 terms, 100 deadlines
per term, 40 breaks per term, 2,000 buildings, 40 meal plans, 20 email
domains. The app says how many were left out.

## 6. Getting started without writing one from scratch

Two exports, in the app, under **where do you study**:

1. **Download a blank template** — every field, with obviously-placeholder
   values.
2. **Save this school as a pack** — the profile the app currently holds for
   that university, in the same format. This is the better starting point for
   a school Semester already ships: the task becomes correcting a file rather
   than authoring one, and the `id` is already right.

Load a pack through the same screen. Choosing a file does not import it — the
app shows what the file turned out to contain, and what it could not use,
before anything is kept. Removing it puts everything back.

## 7. What the university is agreeing to

Nothing beyond sending a file. Specifically:

- **No student data.** A pack describes an institution — calendars,
  buildings, dining tiers, addresses. There is no field for a person, a
  roster, a grade or an enrolment, and there will not be one in this format.
- **No account, credential or endpoint.**
- **No processing agreement**, because nothing is transmitted to us. The file
  is read on the student's own device, and stays there.

## 8. For maintainers

- The format, the reader and the writer: `app/src/lib/schoolpack.ts`
- Its tests, including the round-trip that keeps the writer and reader in
  step: `app/src/lib/schoolpack.test.ts`
- The door: `app/src/components/SchoolPackDoor.tsx`
- Resolution order, and why a loaded pack beats the bundled copy:
  `app/src/data/schools/index.ts`
- What the profile means to each screen: `app/src/lib/school.ts`

Adding a field is a version bump only if an older build reading the new pack
would be wrong. A field an older build ignores is not a bump; a field that
changes the meaning of one already there is.
