# AI Toolkit dashboard

**Where:** Study → *Open AI Toolkit* (only when `VITE_AI_TOOLKIT` names a state).
**Code:** `app/src/components/toolkit/Toolkit.tsx`, `app/src/lib/toolkit/recommend.ts`.

## Entry

The dashboard opens on *What are you working on?* and the nine goals from the brief:
Study for an exam · Complete an assignment · Analyze data · Write a paper · Build or
code · Run a lab · Do research · Create a presentation · Prepare for office hours.

Under the goal, the student sets explicit context:

| Field | Source | Required |
| --- | --- | --- |
| Course or project | The student's imported courses, or *Independent project* | yes |
| Subject | From the course-code prefix (`PSCI 1104` → Political science); chosen by the student when the prefix is unknown | no |
| Assignment type | One of the 13 templates + office hours | no |
| Due date | Typed by the student | no |
| Topic | Typed by the student; only used to show a boundary notice | no |

## Recommendations

`recommend()` returns **at most four** workspaces (two with *Show fewer*), each with
the reasons it was chosen, in words. There is no score: the order is the goal's list
as written in the file, the chosen assignment first, the subject's tool second.

**Inputs allowed:** goal, course code, chosen subject, assignment type, days until
due, hidden list, show-fewer. Nothing else.

**Inputs refused** (brief § Recommendation rules): grades, GPA, risk scores,
disability, health, financial aid, private messages, GPS, popularity, inferred
identity or wellbeing, behavioural profiling. The `Context` type does not have
fields for them, and `explicitOnly()` strips any extra key at run time — the test
`ignores grades, risk, health, location…` passes a GPA, a risk score and GPS
coordinates and checks the output is identical without them.

Controls: *Why this workspace?* (per item), *Hide* (persisted), *Show fewer
suggestions*, *Show hidden (n)*, *Browse all tools* (the unranked catalog).

A recommendation that points at a section whose flag is off is dropped rather than
shown as a dead link.

## Sections

| Brief section | In this slice |
| --- | --- |
| Today's Work | Built — next stage of each workspace, unverified sources, unfinished data interpretations (max 5) |
| Course Workbenches | Built — *All tools* with a subject picker, behind `VITE_TOOLKIT_WORKBENCHES` |
| Assignment Workspaces | Built |
| Research Studio | Built, behind `VITE_TOOLKIT_RESEARCH` |
| Data & Code Studio | Data built behind `VITE_TOOLKIT_DATA`; code not built |
| Create & Present | Existing screens (Write, Deck, Check the writing) |
| Practice & Exam Prep | Existing screens (Study guide, Practice paper, review) |
| Accessibility & Focus | Links to existing settings, *When you are behind*, office-hours template |
| Connect for Help | Links to the school's help links screen; no new integrations |
