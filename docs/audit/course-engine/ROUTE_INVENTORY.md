# Route inventory

## Course engine web

| Route | State | Purpose |
|---|---|---|
| `/` | tested | Sign in or create an account and first course. |
| `/courses/[courseId]/overview` | tested | Today-style priorities, source counts, calendar, and review action. |
| `/courses/[courseId]/uploads` | tested | Checksum-first uploads and processing status. |
| `/courses/[courseId]/review` | tested | Extraction/conflict review details. |
| `/courses/[courseId]/calendar` | tested | Confirmed and review-state course events. |
| `/courses/[courseId]/cards` | API-wired | Stored flashcard assets or an honest unavailable state. |
| `/courses/[courseId]/read` | API-wired | Guides, weekly summaries, and reading briefs. |
| `/courses/[courseId]/field-guide` | API-wired | Concept maps and glossary assets. |
| `/courses/[courseId]/slides` | API-wired | Lecture-outline assets. |
| `/courses/[courseId]/doc` | API-wired | Assignment planner and guide assets. |
| `/courses/[courseId]/quiz` | API-wired | Practice quiz and exam assets. |
| `/courses/[courseId]/cases` | API-wired | Applied reading/case assets. |
| `/courses/[courseId]/cram` | API-wired | Formula sheet and final-pack assets. |
| `/courses/[courseId]/listen` | API-wired | Narration-source records; generated audio is not live. |
| `/courses/[courseId]/progress` | tested | Recorded concept attempts and explicitly estimated mastery. |
| `/courses/[courseId]/benchmarks` | tested | Renderer measurements, or a truthful no-run state. |

All route modules compile in the production build. This inventory does not classify a route as deployed.

## Existing application

The original `app/src/screens/` tree contains 168 TSX screen modules. It remains the existing Semester product surface. A route-by-route consolidation against the course engine is still required before the vertical slice can replace or merge with an existing course workflow.
