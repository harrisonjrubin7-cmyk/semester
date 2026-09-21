Semester should extend beyond discovery and academics into a connected student productivity environment. This document continues the master specification at item **129** and **preserves every previous requirement**; nothing here replaces or retires anything in [`PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md), [`PRODUCTIVITY_REQUIREMENTS.md`](PRODUCTIVITY_REQUIREMENTS.md), [`STUDY_REQUIREMENTS.md`](STUDY_REQUIREMENTS.md), [`STUDY_EXPANDED_REQUIREMENTS.md`](STUDY_EXPANDED_REQUIREMENTS.md), [`ATHLETICS_REQUIREMENTS.md`](ATHLETICS_REQUIREMENTS.md), [`CAREER_REQUIREMENTS.md`](CAREER_REQUIREMENTS.md), [`FAMILY_REQUIREMENTS.md`](FAMILY_REQUIREMENTS.md), [`LIFECYCLE_REQUIREMENTS.md`](LIFECYCLE_REQUIREMENTS.md), [`INSTITUTIONAL_REQUIREMENTS.md`](INSTITUTIONAL_REQUIREMENTS.md) or [`UNIVERSITY_CONNECTIONS.md`](UNIVERSITY_CONNECTIONS.md).

`PRODUCTIVITY_REQUIREMENTS.md` describes the **tools** — Documents, Mail, Meetings, Presentations, Sheets, Forms, Design, Video, Math, Files. This document describes the **layer beneath them**: the file model they all share, the relationships that connect them to a course and an assignment and a study group, and the provider abstractions that let an external tool sit in the same structure as a native one. Where the two documents describe the same surface, this one is the newer statement of the connective requirements and the older one remains the statement of what each tool must do.

---

# 129. Semester Workspace — productivity OS

Create a new underlying concept: **Semester Workspace**.

Semester Workspace connects:

```
DOCUMENTS
SLIDES
SPREADSHEETS
DRIVE / FILES
WHITEBOARDS
DRAWING
PDF
NOTES
VIDEO MEETINGS
SCREEN SHARING
RECORDINGS
CALENDAR
TASKS
PROJECTS
AI
```

**The differentiator is CONTEXT.** A normal document application understands a document. Semester should understand:

```
Student
   ↓
Course
   ↓
Assignment
   ↓
Study Group
   ↓
Document
   ↓
Slides
   ↓
Spreadsheet
   ↓
Meeting
   ↓
Deadline
```

Everything should connect.

The point is not to build shallow clones of Google Docs, Slides, Sheets, Drive, Zoom, Canva and whiteboard software. Each of those is better than a shallow clone of itself. What none of them has is the student's course, the assignment it is for, the group doing it and the deadline it is due against. That relationship is the product.

# 130. Universal create button

Create one global **+ CREATE**, available throughout Semester.

Options:

```
Document
Presentation
Spreadsheet
Note
Whiteboard
Drawing
Study Guide
Flashcards
Practice Test
Project
Study Group
Meeting
Folder
Upload File
```

Context should intelligently prefill metadata. Pressing Create while inside ECON 301:

```
Create Document

Course:
ECON 301 ✓

Suggested title:
ECON 301 — September 22 Notes
```

A prefilled field is a suggestion and must remain editable. Nothing is filed against a course the student did not choose.

# 131. Semester Drive

Build a unified file workspace: **Semester Drive**.

Navigation:

```
MY FILES

COURSES

SHARED WITH ME

ORGANIZATIONS

PROJECTS

STUDY GROUPS

RECENT

STARRED

TRASH
```

Files should support documents, presentations, spreadsheets, PDFs, images, notes, whiteboards, uploaded files and external linked files.

# 132. Drive folder structure

Automatically create useful organization:

```
SEMESTER DRIVE

Fall 2026
│
├── ECON 301
│   ├── Notes
│   ├── Assignments
│   ├── Readings
│   ├── Study Guides
│   └── Exam Prep
│
├── PSCI 240
│
├── STAT 210
│
└── Film Studies
```

Do not require students to manually create basic course organization. Allow customization: a student who renames, merges or deletes a generated folder keeps that decision, and the generator does not put it back.

# 133. File entity model

Create a unified file abstraction. Every file should track:

```
id
owner
type
title
course
assignment
organization
project
folder
created_at
updated_at
visibility
sharing_permissions
version
source
```

Types:

```
DOCUMENT
PRESENTATION
SPREADSHEET
WHITEBOARD
NOTE
PDF
IMAGE
VIDEO
AUDIO
FILE
```

One abstraction is what allows universal search and lets Semester AI work across files rather than inside one of them. `source` is what tells a Semester file from a linked external one, and it is never inferred — see items 175 to 181.

# 134. Recent files

Create an intelligent recent-files experience showing:

- Recently opened
- Recently edited
- Shared recently
- Relevant to an upcoming assignment

```
RECENT

ECON Midterm Study Guide
Edited 8 minutes ago

Political Science Essay
Due Thursday

Statistics Problem Set
Edited yesterday
```

"Relevant to an upcoming assignment" is a relationship the app already holds, not a guess: the file is filed against the assignment, or against the course the assignment belongs to.

# 135. Starred / favorites

Users can star files, folders, courses, notes and study guides. Starred content should be quickly accessible.

# 136. File sharing

Support:

```
PRIVATE

SPECIFIC PEOPLE

STUDY GROUP

COURSE GROUP

ORGANIZATION

ANYONE WITH LINK
```

Permissions:

```
VIEWER
COMMENTER
EDITOR
OWNER
```

**Permission enforcement must occur server-side.** A client that hides an editing control is a courtesy, not a permission. Every read and every write is checked where the data lives, and a link that has been revoked stops working for the person holding it.

# 137. Semester Documents

Create a collaborative document editor supporting rich text, headings, lists, checklists, tables, links, images, quotes, code blocks, equations, footnotes, citations, comments, suggestions and version history.

Autosave.

# 138. Document academic templates

Provide student-specific templates:

```
Lecture Notes

Research Paper

Essay

Lab Report

Study Guide

Reading Notes

Research Notes

Meeting Notes

Project Proposal

Resume

Cover Letter

Organization Constitution
```

Templates should be optional. A blank document stays one press away.

# 139. Research paper mode

Create a specialized academic writing workspace.

Sidebar:

```
OUTLINE

SOURCES

NOTES

CITATIONS

COMMENTS

ASSIGNMENT

AI
```

Allow students to move from:

```
Research
   ↓
Sources
   ↓
Notes
   ↓
Outline
   ↓
Draft
   ↓
Revision
   ↓
Submission
```

without leaving Semester.

# 140. Citation manager

Students can add a website, book, journal article, PDF, DOI or manual citation.

Support APA, MLA, Chicago and Harvard.

**Store source metadata separately from the rendered citation**, so a change of style re-renders rather than re-types, and so a wrong field is corrected in one place. Allow bibliography generation.

**Users must review automatically generated citations.** A citation is a claim about where something came from, and a wrong one is an academic-integrity problem with the student's name on it.

# 141. Research library

Create a personal source library:

```
RESEARCH LIBRARY

Monetary Policy Paper
Federal Reserve Report
Chapter 7 Reading
Journal Article — Inflation
```

Sources can be linked to a course, an assignment, a document or a project.

# 142. Document comments

Support comments anchored to content, with comment, reply, resolve, reopen and mention.

> @Alex can you verify this statistic?

Notifications should be generated appropriately — a mention reaches the person mentioned, and a resolved thread stops asking.

# 143. Suggestion mode

Collaborative documents should support:

```
EDIT

SUGGEST

VIEW
```

Suggested changes can be accepted, rejected or left for review.

# 144. Document version history

Store meaningful versions:

```
VERSION HISTORY

Today 4:32 PM — Harrison
Today 3:18 PM — Maya
Yesterday 9:42 PM — Harrison
```

Allow restoring earlier versions where technically practical.

**Do not create a database snapshot for every keystroke.** Use efficient versioning — a version is a point somebody would want to come back to, not a frame of an animation.

# 145. Semester Presentations

Create a presentation workspace supporting slides, layouts, text, images, shapes, charts, tables, video, speaker notes, themes, comments and collaboration.

Structure:

```
LEFT
Slide navigator

CENTER
Canvas

RIGHT
Properties / AI

BOTTOM
Speaker notes
```

# 146. Presentation templates

Provide templates designed for university use:

```
Class Presentation

Research Presentation

Group Project

Case Study

Pitch Deck

Data Presentation

Club Presentation

Organization Recruitment

Event Proposal
```

Keep templates polished and modern.

# 147. AI presentation builder

Allow: *Create a 10-slide presentation from my research paper.*

AI should generate a draft structure:

```
1 Title
2 Research Question
3 Background
4 Literature
5 Method
6 Data
7 Findings
8 Analysis
9 Limitations
10 Conclusion
```

**User reviews before slides are created.**

# 148. Document → presentation

Allow conversion:

```
DOCUMENT
     ↓
SEMESTER AI
     ↓
PRESENTATION OUTLINE
     ↓
USER REVIEW
     ↓
SLIDES
```

**Do not simply dump paragraphs onto slides.** Extract the key argument, the evidence, the visual opportunities and the main conclusions.

# 149. Presentation coach

An optional AI presentation assistant analyzing slide density, readability, structure, repetition and timing.

> Slide 6 contains approximately twice as much text as the rest of the presentation.

That sentence is a count and can be defended. **Avoid claiming subjective presentation quality as objective fact** — the app can say a slide is denser than its neighbours and cannot say a talk is good.

# 150. Speaker notes

Each slide supports private speaker notes. Semester AI can help convert slide content into suggested talking points.

**Do not expose speaker notes during presentation mode.** The failure is not cosmetic: a projector showing the notes is showing the room what the speaker meant to say.

# 151. Presentation mode

Full-screen presentation mode supporting next, previous, keyboard navigation, presenter view, a timer, speaker notes and a slide preview.

# 152. Group presentations

Integrate group project membership:

```
ECON FINAL PRESENTATION

Slide 1–3     Harrison
Slide 4–6     Maya
Slide 7–8     Alex
Slide 9–10    Jordan
```

Allow assignment of slide responsibility.

# 153. Semester Spreadsheets

Create spreadsheet functionality: cells, rows, columns, multiple sheets, basic formatting, formulas, sorting, filtering, tables, charts, and import/export.

**Do NOT attempt to replicate every advanced Excel feature immediately.**

# 154. Spreadsheet formulas

Support foundational formulas:

```
SUM
AVERAGE
MEDIAN
MIN
MAX
COUNT
COUNTA
IF
AND
OR
ROUND
ABS
```

Then expand based on actual student usage. Prioritize academic and basic business and statistics functions.

# 155. Statistics spreadsheet functions

Because Semester serves students, include useful statistics functions:

```
MEAN
MEDIAN
MODE
STDEV
VARIANCE
CORRELATION
PERCENTILE
QUARTILE
```

Where appropriate, support regression, confidence intervals and descriptive statistics.

**Clearly distinguish calculations from AI explanations.** A number the sheet computed and a sentence a model wrote about it are different kinds of thing and must not be drawn as one.

# 156. Data analysis mode

Allow users to select data and request: *Analyze this dataset.*

Semester can provide summary statistics, missing-data observations, distribution descriptions, correlations and potential charts.

**AI must not fabricate data.** A described value that is not in the selection is the one failure this feature cannot survive.

# 157. Chart builder

Support bar, line, scatter, pie, histogram and area charts, with titles, axis labels, legends and data ranges.

Charts should update when the underlying data changes.

# 158. Spreadsheet AI

Examples:

- *Explain this formula.*
- *Create a formula that calculates weighted grade.*
- *Find possible duplicate rows.*
- *Summarize this dataset.*
- *Create a chart showing sales by month.*

**AI-generated formulas should be previewed before insertion**, because a formula that lands silently is a wrong number somebody will read as a right one.

# 159. Grade calculator workbook

Create a native grade tracker:

```
ECON 301

Homework       20%
Midterm        30%
Final          40%
Participation  10%
```

Students enter grades and weights. Calculate the current grade **based only on provided data**.

Support scenarios: *What happens mathematically if I receive 85 on the final?*

**Label projections as scenarios, not predictions.** The arithmetic is certain; the 85 is not.

# 160. Semester Whiteboard

Create collaborative whiteboards supporting an infinite canvas, text, sticky notes, shapes, arrows, freehand drawing, images, links and comments.

Use cases:

```
Brainstorming
Concept Maps
Study Sessions
Project Planning
Research Mapping
Organization Planning
```

# 161. Drawing tools

```
Select
Pen
Highlighter
Eraser
Text
Rectangle
Circle
Arrow
Line
Sticky Note
Image
```

Support undo and redo.

# 162. Concept maps

Create academic concept-map templates:

```
             MONETARY POLICY
                    │
        ┌───────────┴───────────┐
        ↓                       ↓
 Interest Rates             Money Supply
        ↓                       ↓
 Investment                 Inflation
```

Allow AI to suggest draft relationships from authorized notes, **but the user controls the final map**.

# 163. Whiteboard + study group

Study groups should be able to open a shared whiteboard:

```
ECON 301 STUDY GROUP

[Video]
[Chat]

SHARED WHITEBOARD

Practice problem
Graph
Notes
Questions
```

# 164. Semester Meetings

Create an integrated online meeting architecture. This can eventually use appropriate third-party video infrastructure rather than implementing low-level video transport from scratch.

Support video, audio, mute, camera, screen share, participants, chat, raise hand and reactions where appropriate.

# 165. Meeting creation

Users can create:

```
Study Meeting

Group Project Meeting

Organization Meeting

Office Hours

Tutoring Session
```

Fields: title, date, start, duration, participants, related course, related project, description.

# 166. Meeting links

Each meeting receives a persistent meeting record and join mechanism:

```
STAT 210 STUDY SESSION

Tuesday
7:00 PM

5 participants

[ JOIN MEETING ]
```

**Access permissions must be enforced** — a meeting record is not an open door because somebody has the address.

# 167. Screen sharing

Support screen sharing through appropriate browser or native APIs, or an integrated video provider. Users should be able to share an entire screen, an application window, or a browser tab where supported.

**Never start screen sharing without explicit user action.**

# 168. Meeting chat

Support messages, links, shared files and reactions where appropriate. Optionally persist chat after the meeting, depending on meeting settings.

# 169. Meeting whiteboard

Allow a meeting to open a collaborative whiteboard. **This should use the same Semester Whiteboard system** rather than a second whiteboard implementation that will diverge from the first.

# 170. Meeting documents

Allow participants to attach workspace items — document, presentation, spreadsheet, whiteboard, PDF:

```
ECON GROUP MEETING

Shared:
Final Presentation
Research Notes
Data.xlsx
```

# 171. Meeting recordings

If recording infrastructure is implemented, recording **must require clear user awareness and comply with applicable consent requirements**.

Show obvious recording state. **Do not silently record.** Recordings can be stored in Semester Drive where permitted.

# 172. Meeting transcripts

Where recording or transcription is enabled with appropriate notice, generate a transcript, a meeting summary, decisions, tasks and important topics:

```
MEETING SUMMARY

Decisions
• Use Federal Reserve dataset
• Maya handles slides 3–5

Tasks
• Harrison — finish analysis by Thursday
• Alex — add citations

Next meeting
Sunday 7 PM
```

**Users should be able to correct AI-generated summaries.** A summary that attributes a commitment to the wrong person is a sentence about a real person that they did not say.

# 173. Meeting → tasks

Allow approved meeting summaries to create project tasks:

```
MEETING
   ↓
TRANSCRIPT
   ↓
AI SUGGESTED TASKS
   ↓
USER REVIEW
   ↓
PROJECT TASKS
```

**Never create consequential assignments invisibly.**

# 174. Zoom integration

**Do not unnecessarily attempt to replace Zoom immediately.** Build integration architecture.

Potential functionality: connect a Zoom account, import upcoming meetings, display Zoom meetings in Semester, join from Semester, link a Zoom meeting to a course or project, store authorized metadata, and import recordings and transcripts where API permissions allow.

Semester should act as **the contextual layer around meetings**.

# 175. Google Drive integration

Allow an optional Google Drive connection. Where authorized: browse files, search files, link a file to a course, link a file to an assignment, open an external file, and import or copy where supported.

Clearly distinguish a **Semester file** from a **Google Drive file**.

**Do not duplicate external files without user intent.** Two copies drifting apart is worse than one copy somewhere else.

# 176. Google Docs integration

Allow Google Docs to be linked to Semester entities:

```
Political Science Essay

Assignment
Due Thursday

Working Document:
Google Docs — Final Essay Draft
```

Semester can provide context around the document **without pretending it owns external content**.

# 177. Google Slides integration

Allow Slides presentations to connect to an assignment, course, project, organization or event:

```
ECON GROUP PROJECT

Presentation:
Google Slides

Meeting:
Tonight 7 PM

Deadline:
Friday
```

# 178. Google Sheets integration

Allow external Sheets to be linked to a research project, lab, group project, organization or budget, with contextual access from Semester.

# 179. Microsoft 365 integration

Design adapters for OneDrive, Word, Excel, PowerPoint, Outlook Calendar and Teams where appropriate.

**Do not hardcode productivity architecture around Google.** Create provider abstractions.

# 180. Productivity provider architecture

```
StorageProvider

├── SemesterDrive
├── GoogleDrive
├── OneDrive
└── FutureProvider


DocumentProvider

├── SemesterDocuments
├── GoogleDocs
└── MicrosoftWord


PresentationProvider

├── SemesterPresentations
├── GoogleSlides
└── PowerPoint


SpreadsheetProvider

├── SemesterSheets
├── GoogleSheets
└── Excel


MeetingProvider

├── SemesterMeetings
├── Zoom
├── GoogleMeet
└── Teams
```

The UI should consume normalized interfaces where practical.

The normalization has a limit worth stating: a provider that cannot do something must say so rather than have the interface pretend. A read-only external file draws no editing controls, and an interface that hides the difference produces a button that fails after the press.

# 181. External resource linking

Any external resource should be linkable to Semester entities:

```
Google Doc
      ↓
Assignment
      ↓
Course
      ↓
Study Group
```

or:

```
Zoom Meeting
      ↓
Organization
      ↓
Event
```

**This contextual relationship layer is a major competitive opportunity.** It is also the one part of this document that no incumbent can copy without becoming Semester: Google can build a better editor than Semester will, and it cannot put the student's assignment, group and deadline around it.

# 182. Semester Projects

Create collaborative projects. Projects can belong to a course, an organization, a study group or a user.

Include:

```
OVERVIEW

TASKS

FILES

DOCUMENTS

MEETINGS

MEMBERS

ACTIVITY
```

# 183. Project task board

Support:

```
TO DO

IN PROGRESS

DONE
```

Tasks carry a title, assignee, due date, priority, related file and comments.

**Keep this simple initially.**

---

# What already exists, measured

Read against the app on `main`, because a requirement already met is worth knowing about before it is built a second time — and because several items above describe *extending* something rather than starting it.

| Item | Already in the app | Where |
|---|---|---|
| 130 Universal create | A Create screen and a registry entry for it | `screens/Create.tsx` |
| 131–132 Drive, folders | Folders in the store, files in IndexedDB, a shelf that groups by day | `lib/folders.ts`, `lib/files.ts`, `lib/shelf.ts` |
| 135 Starred | Bookmarks across screens, shared by four surfaces | `lib/bookmarks.ts`, `lib/bookmarks.hook.ts` |
| 137 Documents | The document editor, blocks, autosave | `screens/Write.tsx`, `lib/document.ts`, `lib/draft.ts` |
| 138 Templates | Document, sheet and design templates | `lib/doctemplates.ts`, `lib/sheettemplates.ts`, `lib/designtemplates.ts` |
| 140–141 Citations, sources | Quote checking against the source it claims | `lib/cite.ts`, `lib/quotes.ts`, `lib/sources.ts` |
| 142–143 Comments, collaboration | Two people on one canvas; notes anchored in a document | `lib/coedit.ts`, `lib/cocanvas.ts`, `Note` in `lib/document.ts` |
| 144 Version history | Earlier drafts and the way back to one | `lib/docversions.ts` |
| 145–152 Presentations | The deck editor, its themes and layouts, slide fitting | `screens/Deck.tsx`, `lib/deck.ts`, `THEMES` and `LAYOUTS` in `lib/decks.ts`, `video/src/fit.ts` |
| 153–155 Spreadsheets | Grid, formulas, named functions, conditional formatting | `screens/Sheet.tsx`, `lib/sheet.ts`, `lib/functions.ts`, `lib/condfmt.ts` |
| 157 Charts | Chart building from the grid, and a chart layer | `lib/chart.ts`, `lib/chartlayer.ts`, `lib/xlsxchart.ts` |
| 159 Grade calculator | A course's own calculator, a GPA planner, and scenarios | `lib/gradesheet.ts`, `lib/gpasheet.ts`, `lib/whatif.ts` |
| 160–161 Whiteboard, drawing | The drawing surface and its tools | `screens/Draw.tsx`, `lib/drag.ts`, `lib/erase.ts` |
| 164–168 Meetings | Cameras, peer connections, room chat, join codes | `screens/call/Index.tsx`, `lib/rtc.ts`, `lib/call.ts`, `lib/roomchat.ts` |
| 182–183 Projects, tasks | Group work with a shared checklist; personal tasks with steps | `screens/Groupwork.tsx`, `lib/groupwork.ts`, `PersonalTask` in `lib/types.ts` |

What is **not** built, and is the substance of this document:

- **The file entity model (133).** Files, notes, documents, sheets and decks are each stored their own way. There is no single abstraction carrying `course`, `assignment`, `organization`, `project` and `source` across all of them, which is what items 134, 136 and 181 all rest on.
- **Server-side permission enforcement (136).** Sharing today is local and by export. Nothing checks a viewer against an ACL where the data lives.
- **The provider abstractions (175–180).** There are no adapters, and nothing external is linkable to a Semester entity.
- **Research paper mode (139) and the research library (141)** as a workspace, rather than the pieces that exist separately.
- **Meeting recordings, transcripts and meeting → tasks (171–173).**
- **The relationship layer itself (181),** which is the competitive claim and the reason the rest is worth building.

## Sequencing note

Items 133 and 136 come first, before any new surface. Every other item in this document either reads the file entity model or writes to it, and a Drive, a share sheet and a provider adapter built on five different storage shapes is five migrations later rather than one. The permission model is in the same position for the same reason: retrofitting server-side authorization onto features that shipped without it means auditing every one of them.
