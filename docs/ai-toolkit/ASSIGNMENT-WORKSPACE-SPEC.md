# Assignment workspace

**Code:** `app/src/lib/toolkit/templates.ts`, `app/src/components/toolkit/AssignmentPanel.tsx`.

## Templates

Thirteen from the brief, plus office-hours preparation:

problem_set · essay · lab_report · research_paper · coding_project · design_project ·
case_analysis · presentation · group_project · exam_preparation · policy_memo ·
annotated_bibliography · technical_report · office_hours.

Stages follow the brief's order exactly (the test pins the research paper's:
question → search → screening → matrix → bibliography → outline → draft → audit).
Each stage carries a **question addressed to the student**, not an instruction to a
model.

## Participation is enforced

`completeStage()` refuses until the student's note for that stage is at least
`MIN_NOTE` (12) characters. The button stays available and says why when it
refuses, rather than being disabled without explanation. A reviewer might call 12
characters arbitrary; it is — the point is that *something* in the student's words
exists for every stage, which the provenance panel and reflection then read from.

## A workspace contains

Title, course, pasted instructions, learning goal, a note per stage, done stages,
reflection, `visibility: 'private'`, created date.

## Submission checklist

Derived, not fixed (`submissionChecklist()`):

- always: every stage has a note; headings, figures and links checked; *you submit
  it yourself, through the course's own system* (Semester is not the system of record);
- rubric found and self-checked;
- every claim traced to a source you opened (research paper, annotated bibliography);
- **the AI-use declaration**, only when the resolved policy has a use that requires
  disclosure.

## Not in this slice

Milestone dependencies and dates, rubric attached to a workspace, sharing to a group.
