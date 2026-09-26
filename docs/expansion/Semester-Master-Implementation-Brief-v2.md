# Semester — Master Implementation Brief (v2)

> **v2, 26 September 2026:** adds the competitive-expansion features and the expanded stakeholder roles (sections 27–33), a ready-to-apply Supabase migration, and a policy test suite. Sections 1–26 are unchanged except for section 15 (roles) and section 23 (phases), which now point to the expansion.
>
> **Companion files (drop into the repo as-is):**
> - `supabase/migrations/20260926150000_expansion_roles_and_features.sql`
> - `supabase/expansion.check.sql`
> - edits to `supabase/grants.check.sql` (two allowlisted functions) and `supabase/capabilities.check.sql` (role and matrix counts)
>
> Validated locally: the migration applies after every existing migration, and `expansion` (64 checks), `capabilities`, `grants`, `indexes`, `deletion`, `tenancy` and `rolegrants` all pass. The run used Postgres 18 with `SEMESTER_CHECK_PG_ANY=1`. Re-run on Postgres 17 (what production uses) before merging. `organizations.check.sql` already fails on `main` before this change, at line 599, because `schools` deletion is blocked by a RESTRICT foreign key. Fix that separately.

**Purpose:** Hand this document to Claude Code, ChatGPT, an engineering team, or an AI coding agent to extend the existing live Semester product safely and systematically.

**Repository:** `https://github.com/harrisonjrubin7-cmyk/semester`

**Current live product:** `https://harrisonjrubin7-cmyk.github.io/semester/`

**Important:** This is an integration-and-extension project, **not** a ground-up rewrite. Preserve all working features, routes, design language, tests, and data behavior unless a migration is explicitly planned, tested, documented, and reversible.

---

## 1. Product mandate

Semester is both the company and the product. Build it as one unified ecosystem:

```text
Semester company and public website
        ↓
Product explanation, free tools, pricing, resources, careers, institution sales
        ↓
Account creation, sign-in, membership, privacy controls
        ↓
Semester application
        ↓
Today · My Path · Search · Plan · Study · Workspace · Career · Campus Hub
```

### Core promise

> **College is complicated. Your path shouldn’t be.**

Semester helps students understand their academic path, decide what to do next, plan registration, study course material, create work, access campus support, prepare for meetings, develop career evidence, and connect current choices to future goals.

### Positioning

> **Semester is the academic navigation and momentum platform.**

Semester should not initially claim to replace every university system. It is the connected experience and action layer across systems:

| System | Authoritative purpose | Semester purpose |
|---|---|---|
| Banner / Workday / SIS | Official records, catalog, enrollment, registration, holds | Explain, plan, route actions, show approved summary data |
| Canvas / Blackboard / Brightspace | Course delivery, submissions, grades, instructor workflows | Connect approved context/materials, study tools, deep links |
| Top Hat / Gradescope / Turnitin | Engagement, grading, assessment/originality workflows | Surface permitted context and official deep links |
| Housing / dining / student accounts | Contracts, balances, official transactions | Show verified status, deadlines, and safe handoffs |
| Google / Microsoft | Files, email, calendars, collaboration | Connect selected student-authorized materials and events |
| Zoom / Teams / Calendly | Meetings and recordings | Prepare agendas, meetings, follow-up tasks |
| Semester | Navigation, planning, study, creation, actions, goals | Daily student home and cross-system coordination layer |

---

## 2. Current repository reality

The repository already has substantial foundations. Do not duplicate them before auditing.

### Known repository structure

```text
semester/
├── app/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── screens.tsx
│   │   ├── screens/
│   │   ├── components/
│   │   ├── state/
│   │   ├── data/
│   │   ├── ai/
│   │   ├── intelligence/
│   │   ├── insights/
│   │   ├── a11y/
│   │   ├── lib/
│   │   └── styles/
│   ├── api/
│   ├── server/
│   ├── scripts/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── vercel.json
│   ├── .env.example
│   └── README.md
├── supabase/
├── docs/
├── packages/
├── project/
├── pipeline/
├── .claude/
├── .github/
├── ACTION-PLAN.md
├── APP-AUDIT.md
├── ENGINEERING-AUDIT.md
├── FEATURE-INVENTORY.md
├── IMPLEMENTATION-PLAN.md
├── PILOT.md
├── SECURITY.md
├── SECRETS.md
├── MONITORING.md
├── STAGING.md
├── ROLLBACK.md
├── REGRESSION-CHECKLIST.md
├── TOPHAT.md
├── GRADESCOPE-TURNITIN.md
├── SEMESTER_IMPLEMENTATION_PLAN.md
├── SEMESTER_IMPLEMENTATION_STATUS.md
├── SEMESTER_PRODUCT_COMPLETENESS_MATRIX.md
└── README.md
```

The app appears to be a Vite + TypeScript application with extensive state/data modules, tests, Supabase scaffolding, accessibility code, AI/intelligence modules, and Vercel configuration. The existing state model is substantial, including `app/src/state/shape.ts`, `store.tsx`, reducers, persistence modules, and test coverage. Existing data modules include campus, catalog, events, fellowships, onboarding, institutional preview, seed data, schools, courses, and transcript-related sources.

### First instruction to the implementing agent

Before changing code, conduct a **read-only repository audit** and create `docs/AUDIT.md`. Inspect:

1. `app/package.json` and build scripts.
2. `app/README.md`, `README.md`, `.env.example`, `vercel.json`, `vite.config.ts`.
3. Existing route/screen system in `App.tsx`, `main.tsx`, `screens.tsx`, and `screens/`.
4. Navigation registry and shortcuts.
5. Existing state store, reducers, shape definitions, persistence, and localStorage usage.
6. Supabase folders, migrations, client configuration, Auth status, RLS status, Storage status, and Edge Functions.
7. Existing AI and Intelligence modules.
8. Accessibility utilities and tests.
9. Existing data mocks, fixtures, seed data, and whether sample data is clearly labeled.
10. Existing tests, CI, deployment, Vercel setup, branches, and open pull requests.
11. Existing implementation-status, security, pilot, and feature documents.
12. Any secrets accidentally in tracked files. Do not print secrets in audit output.

The audit must state:

- Current framework and build command.
- Current deploy target and branch.
- Current routes/screens.
- Existing completed product capabilities.
- Existing mock/demo behavior versus production-backed behavior.
- LocalStorage/mock-to-Supabase migration plan.
- Auth and authorization status.
- Biggest security risks.
- Exact recommended file-level work for Sprint 1.
- Open questions requiring human decision.

---

## 3. Non-negotiable implementation rules

1. **Do not rewrite the application wholesale.** Extend and refactor in small vertical slices.
2. **Do not delete working routes or code** without a migration plan, tests, rollback note, and explicit approval.
3. **Never expose secrets in browser code.** All AI keys, Stripe keys, integration credentials, and service secrets remain server-side.
4. **Do not claim official data is verified** unless it came from an approved current source. Display source labels:
   - Institution verified
   - Imported
   - Student entered
   - Estimated
   - Needs review
5. **Use progressive disclosure.** Do not bury students in every capability at once.
6. **Keep top-level student navigation to five destinations:** Today, My Path, Search, Plan, Me.
7. **Every recommendation must be explainable:** why it appeared, source data used, expected impact, limitations, alternatives, and controls.
8. **All consequential writes require explicit confirmation:** send, share, export, schedule, create payment handoff, delete, register, add/drop, or modify a record.
9. **Use feature flags** by tenant, role, pilot cohort, and release stage.
10. **Build WCAG 2.2 AA toward the baseline.** Keyboard access, visible focus, screen-reader labels, text resizing, high contrast, captions/transcripts, reduced motion, accessible math/figures, and no drag-only essential controls.
11. **Build source-aware data models** with source system, record ID, last sync, confidence, access classification, owner, and retention policy.
12. **Integrate first; replace only when appropriate.** Do not recreate SIS, LMS, healthcare, payment, or official registration authority without institutional agreements and maturity.

---

## 4. Product information architecture

### Primary student destinations

```text
Today     My Path     Search     Plan     Me
```

| Destination | Student job | Contents |
|---|---|---|
| Today | Understand what matters now | Path Snapshot, Action Center, Next Best Step, urgent commitments, study prompt |
| My Path | Plan degree and registration | Requirements, degree map, term plan, scenarios, registration readiness, study abroad impact |
| Search | Ask, discover, and act | Courses, requirements, people, resources, jobs, events, departments, policies, opportunities |
| Plan | Organize time and commitments | Schedule, course drafts, study blocks, calendar, tasks, meetings, travel |
| Me | Manage personal work and controls | Profile, Study Library, Workspace, Career, Portfolio, membership, privacy, settings, connections |

### Contextual modules

Do not create permanent top-level destinations for every niche need. Open modules when context requires them:

- Study Studio / Course Companion.
- Semester Workspace.
- Math & Data Lab.
- Writing Studio.
- Career Hub.
- Campus Hub.
- Housing / Dining / Student Accounts cards.
- Athlete Plan.
- Study Abroad.
- Supporter View.
- Faculty Course Studio.
- Advisor Meeting Mode.

---

## 5. The canonical Action Center

Build a shared Action Center across every module. It is the primary coordination layer for Semester.

### Action model

```ts
type ActionStatus =
  | 'open'
  | 'in_progress'
  | 'blocked'
  | 'snoozed'
  | 'completed'
  | 'dismissed'
  | 'expired'
  | 'cancelled'

type ActionPriority = 'critical' | 'high' | 'normal' | 'low'

type ActionSourceKind =
  | 'institution_verified'
  | 'sis'
  | 'lms'
  | 'faculty'
  | 'advisor'
  | 'student'
  | 'integration'
  | 'ai_generated'
  | 'estimated'

interface SemesterAction {
  id: string
  tenantId: string
  studentId: string
  type: string
  title: string
  summary: string
  whyItMatters: string
  status: ActionStatus
  priority: ActionPriority
  dueAt: string | null
  recommendedStartAt: string | null
  expiresAt: string | null
  estimatedMinutes: number | null
  source: {
    kind: ActionSourceKind
    system: string
    recordId: string | null
    sourceUrl: string | null
    label: string
    verifiedAt: string | null
    syncedAt: string | null
    confidence: 'verified' | 'high' | 'medium' | 'low' | 'needs_review'
  }
  explanation: {
    trigger: string
    factors: string[]
    expectedImpact: string | null
    limitations: string[]
    sourceReferences: Array<{ label: string; url?: string; recordId?: string }>
  }
  primaryAction: {
    label: string
    kind: 'internal_route' | 'external_deep_link' | 'draft' | 'review' | 'request' | 'confirm'
    target: string
    requiresConfirmation: boolean
    requiresFreshAuth: boolean
    requiredPermissions: string[]
  }
  secondaryActions: Array<{ label: string; kind: string; target?: string }>
  links: Record<string, string | undefined>
  privacy: {
    visibility: 'private' | 'shared_with_advisor' | 'shared_with_supporter' | 'institution_managed'
    containsSensitiveData: boolean
    dataClassification: 'public' | 'internal' | 'student_private' | 'restricted'
  }
  delivery: {
    inApp: boolean
    pushAllowed: boolean
    emailAllowed: boolean
    notificationState: 'not_sent' | 'sent' | 'seen' | 'suppressed'
    fatigueScore: number
  }
  lifecycle: {
    createdAt: string
    updatedAt: string
    completedAt: string | null
    completedBy: 'student' | 'institution_sync' | 'advisor' | 'system' | null
    dismissedReason: string | null
    snoozedUntil: string | null
    version: number
  }
}
```

### Supporting persistence

```text
actions
action_sources
action_explanations
action_links
action_delivery
action_interactions
action_status_history
action_permissions
action_audit_events
action_feedback
action_rules
```

### Action Center UX rules

- Show one **Most Important** action.
- Show only three to five Next actions before `View all`.
- Group related work: “Registration readiness: two steps remaining.”
- Rank: urgency + goal/academic impact + actionability + source confidence − notification fatigue.
- Use three layers: Notice → Understand → Act.
- Show source and freshness.
- Let student snooze, dismiss, correct, share, or ask for help.
- Never describe students as “at risk,” “failing,” or “behind.”
- Update actions from verified external events without overwriting personal student notes or plans.

---

## 6. Sprint 1: Registration and Path Pilot

### Goal

Build the smallest real product that proves Semester’s core promise:

> A student can create an account, see a credible Path Snapshot, build a next-term plan, resolve basic schedule conflicts, save backup courses, prepare for an advising conversation, and know what to do next.

### Target users

Pick one initial cohort:

- First-year students before registration.
- Transfer students.
- Advising-center students.
- Student athletes.
- One department/program with complex prerequisites.

### Include

- Secure account creation and sign-in.
- Email verification and account recovery.
- Basic student profile: school, program, target graduation term, completed credits, goals.
- Today dashboard.
- Action Center.
- Path Snapshot.
- Student-entered or curated program/requirement data clearly labeled as estimate unless verified.
- Basic term planner.
- Course list/search for pilot cohort.
- Weekly schedule and conflict detection.
- Registration readiness checklist.
- Backup course shortlist.
- Advisor meeting agenda and view-only share/export.
- Feedback prompt: “Did this help you understand what to do next?”
- Support / report issue route.
- Source labels and data freshness.
- Mobile responsive and accessible states.
- Analytics for activation and meaningful task completion.

### Explicitly defer

- Production Banner/Workday write integrations.
- Official registration execution.
- Payment/billing checkout.
- Housing/dining/health integrations.
- Emergency Disclosure Console.
- Full parent/supporter experience.
- Broad social network.
- Full Career/Campus Hub.
- All Study Studio formats.
- Unrestricted AI agents.
- Deep gradebook integrations.
- Complex institution analytics.

### First success metrics

```text
Account creation rate
Onboarding completion rate
First Path Snapshot rate
Term-plan creation rate
Backup-course saved rate
Schedule-conflict resolution rate
Advisor-agenda creation rate
First meaningful action completion rate
“I understand what I need to do next” survey score
Advisor usefulness feedback
Support issue / failed-search themes
```

---

## 7. Today dashboard

### Mobile layout

```text
Good afternoon, Maya
Friday, September 25

YOUR PATH
On track for May 2028 based on your current plan
84 / 120 credits · 70% complete
2 choices need review
[View My Path]

NEXT BEST STEP
Choose a quantitative-reasoning course for Fall.
Because: one requirement remains open in your plan.
[Explore options] [Why am I seeing this?]

UPCOMING
Today — Statistics lecture, 11:00 AM
Today — Prepare advisor questions, 4:00 PM
In 3 days — Chemistry quiz
In 9 days — Registration opens

QUICK ACTIONS
Search · Build plan · Add course · Schedule · Prepare for advising
```

### Desktop layout

```text
Left rail: Today · My Path · Search · Plan · Me

Main workspace:
- Greeting
- Path Overview
- Next Best Step
- Plan Health
- Career/Growth card
- Recently viewed/saved

Right context pane:
- Upcoming calendar
- Deadlines
- Selected-item impact
- Data source/freshness
- Scenario state
- Advisor context
```

### Recommendation explanation sheet

```text
Why this recommendation?

We suggested adding a quantitative-reasoning course because:
• Your plan has one open requirement.
• Your Fall plan has room for three credits.
• Adding an eligible course supports your May 2028 target.

Data used:
• Your saved plan
• Planned Fall courses
• Your target graduation term

Limitations:
• Course availability and official eligibility must be confirmed by your institution.

[View requirement] [Show alternatives] [Not relevant right now]
```

---

## 8. My Path, registration, and planning

### Registration Center flow

```text
Official SIS/catalog data or curated pilot data
        ↓
Student enters goals and constraints
        ↓
Semester identifies eligible pathways
        ↓
Student compares courses and builds schedule
        ↓
Semester checks planning constraints
        ↓
Student saves primary and backup plan
        ↓
Student optionally shares advisor agenda
        ↓
Student deep-links to official registration system
```

### Checks

| Check | Authority | Semester behavior |
|---|---|---|
| Registration window | SIS | Display verified time when connected |
| Hold category | SIS | Display high-level category and official action route |
| Prerequisite | Catalog/SIS | Display source and planning interpretation |
| Seat availability | Official registration system | Show timestamped data only if approved; never guarantee seat |
| Degree requirement | Official audit/catalog | Label verified only when connected |
| Schedule conflict | Semester plan | Calculate and explain |
| Credit load | Semester plan | Calculate planned credits |
| Workload/time balance | Student-entered constraints | Optional guidance, not official restriction |

### Side-by-side desktop views

- Requirement detail + eligible course options.
- Weekly schedule + selected course impact.
- Current plan + proposed scenario.
- Shared plan + advisor meeting agenda.

Limit comparisons to three options. Show top three relevant options, then `Show all eligible options`.

---

## 9. Study Studio and Course Companion

### Core promise

> Upload or connect a syllabus, notes, slides, documents, PDFs, audio, video, readings, and assignment instructions. Semester organizes approved materials, identifies what matters, creates source-linked study assets, and lets the student choose how to study.

### Material pipeline

```text
Select/upload/connect source
        ↓
File validation + malware scanning + format detection
        ↓
Text/OCR/table/figure/transcript extraction
        ↓
Preserve page, slide, timestamp, source file version, and access rights
        ↓
Extract headings, dates, objectives, assignments, key terms, citations
        ↓
Student/faculty review extraction
        ↓
Index authorized source material
        ↓
Generate source-grounded study assets
```

### Syllabus extraction

Extract for review, never auto-apply without student confirmation:

- Course name/section.
- Instructor and office hours.
- Class meetings.
- Grade breakdown.
- Assignments, exams, projects, and deadlines.
- Required materials.
- Attendance, late-work, and make-up policies.
- Accessibility/support statements.
- Learning outcomes.
- Weekly timeline.

### Fourteen study modes

1. Comprehensive Guide.
2. Quick Summary.
3. Bullet Notes.
4. Flashcards.
5. Practice Quiz.
6. Exam Simulator.
7. Study Plan.
8. Case Study.
9. Worked Examples.
10. Concept Map.
11. Visual Explainer.
12. Audio Study Guide.
13. Video Recap/Lesson.
14. Teach-Back Mode.

Do not claim students have fixed learning styles. Offer flexible modalities based on subject, goal, time, accessibility needs, explicit preference, and low-stakes practice feedback.

### Self-quizzing

Every question must show answer/rubric, explanation, source anchors, and user feedback controls.

```text
Question 4 of 10
Research Methods · Week 4

Which conclusion is supported by a positive correlation?

[Answer choices]

Correct: C
Why: Correlation identifies a relationship but does not establish causation.
Sources: Week 4 slides, slide 12; course review guide, section 2.

[Open source] [Try similar] [Add to review] [I guessed] [I do not understand]
```

### Academic integrity

- Respect faculty/course AI rules.
- Do not answer prohibited active graded assessments.
- Offer explanation, analogous practice, study planning, and source review instead.
- Never fabricate citations, research, data, quotes, lab results, or sources.
- Generated writing/slides are drafts and require student review.

---

## 10. Workspace, Docs, Slides, Data, and Meetings

### Semester Workspace

```text
My Files
Course Libraries
Notes
Docs
Slides
Tables
Study Studio
Calendar
Meetings
Email Drafts
Shared With Me
Connected Accounts
```

### Docs

Create editable, source-aware drafts for:

- Study guides.
- Essay outlines.
- Research plans.
- Lab reports.
- Literature reviews.
- Case studies.
- Project proposals.
- Advisor agendas.
- Resume bullets.
- Professional emails.
- Scholarship planners.

### Slides

- Import PDF/PPTX/selected Google Slides.
- Extract headings, notes, figures, charts, tables, and citations.
- Build editable outlines and drafts.
- Include speaker notes, citations, alt-text prompts, contrast checks, rehearsal timer, transcript/captions.
- Export to Google Slides, PowerPoint, PDF, or outline.

### Tables / Math & Data Lab

- Grade calculator, assignment tracker, lab-data organizer, budget, application tracker.
- CSV/Excel/Sheets import with student-selected data.
- Descriptive statistics, distributions, correlations, regression, confidence intervals, hypothesis-test visualizations, accessible charts.
- Require source dataset and expose assumptions/limitations.
- Never fabricate data, p-values, participants, results, charts, or research conclusions.

### Meetings

- Create agendas, selected plan links, questions, materials, and follow-up actions.
- Integrate selected Google/Outlook/Calendly/Zoom meetings through authorized connections.
- Do not automatically send messages, record meetings, import recordings, or summarize sensitive discussions without explicit authorization.

---

## 11. STEM, Writing, and Athlete support

### STEM

- Equation-aware notes.
- Worked solutions with reasoning and common mistakes.
- Adaptive practice problems.
- Formula/reference sheet builder.
- Function plots, scatterplots, histograms, box plots, regression, residuals, probability/distribution visualizers, confidence interval and hypothesis-test visualizers.
- Accessible charts: labels, units, alt text, source, export, method notes.
- Lab Companion: pre-lab checklist, approved safety sources, data capture, calculation, report structure, figure captions.
- Coding support: repository links, explanation, debugging, tests, architecture diagrams, but no prohibited complete graded-project delivery.

### Writing Studio

- Prompt/rubric parser.
- Research question and source plan.
- Evidence/quote/paraphrase organizer.
- Thesis and argument map.
- Outline, paragraph plan, counterargument builder.
- Citation support and “citation needed” prompts.
- Revision checklist tied to rubric.
- Instructor feedback interpreter.
- Read aloud, accessibility checks, presentation conversion.
- No hidden ghostwriting, plagiarism evasion, fabricated sources, or prohibited assessment completion.

### Athlete Plan

- Overlay practice, travel, competition, training, work, courses, deadlines, and study blocks.
- Travel-aware early-start recommendations.
- Downloadable offline study packs.
- Faculty communication drafts for student review.
- Tutoring around travel window.
- Student-controlled share with approved academic-support staff.
- Never expose health/injury/recovery data or use app activity as an eligibility/effort score.

---

## 12. Career, jobs, internships, applications, and portfolio

### Career Hub

```text
Career explorer
Course-to-career map
Skills inventory
Portfolio
Resume builder
Cover letter workspace
Internship and job tracker
Career fair planner
Mock interview studio
Networking notes
Mentor discovery
Graduate-school planner
Offer comparison
```

### Course-to-career map

```text
Course outcomes
        ↓
Projects, assignments, labs, presentations, research
        ↓
Demonstrated skills
        ↓
Portfolio evidence
        ↓
Internships, jobs, graduate paths, career opportunities
```

Students must accept/edit/reject suggested skill mappings. Do not guarantee a job or invent skills.

### Resume templates

- Classic student resume.
- Internship resume.
- Research CV.
- STEM/technical resume.
- Creative portfolio resume.
- Leadership resume.
- Federal/public service resume.
- Graduate-school CV.
- Academic CV.
- Career-change resume.
- International configurable resume.
- One-page career fair resume.

### Application tracker

```text
Saved → In progress → Interviewing → Completed
```

Track deadlines, required documents, selected resume version, cover letter, interview date, follow-up, and student-entered status. Do not apply automatically or invent claims.

### Mock interviews

- Behavioral/STAR practice.
- Role-specific and technical prompts.
- Case framework practice.
- Organization research checklist.
- Student-controlled voice/video practice.
- Pacing/filler-word feedback only if opted in.
- Thank-you draft after interview.
- No facial/emotion analysis, hiring prediction, or peer ranking.

---

## 13. Campus Hub

### Campus Hub categories

```text
Housing & Residence Life
Dining & Meal Plans
Tuition & Student Accounts
Financial Aid & Scholarships
Campus Services
Department Sites
Events & Clubs
Study Abroad
Jobs & Internships
Transportation & Parking
Safety & Support
Important Dates
```

Semester displays an action layer; official services retain authoritative transaction functions.

### Housing

Show approved summary data, deadlines, checklists, contacts, move-in/move-out tasks, and official portal links. Do not show roommate data, full location details, accommodations, contract/payment detail, or sensitive records without authority.

### Dining

Show plan name, optional balance summary, plan-change deadline, locations, hours, menus, dietary labels, official wait-time estimate with source/freshness, and official mobile ordering deep link. Do not store item-by-item dining history or payment data.

### Billing and financial aid

Show deadlines, high-level account action/hold category, official portal link, payment-plan deadline, scholarship/aid checklist, and neutral reminders. Do not process payments initially. Do not expose detailed balances, account ledgers, bank/payment data, or aid determinations in generic Semester UI.

### Department and university content

Build a Campus Graph for departments, programs, faculty, labs, advising, support offices, events, policies, resources, and opportunities. All content needs owner, source, last-reviewed date, and verified state.

### Clubs and events

Ingest only approved campus/department/organization feeds via API, iCal, RSS/JSON, or managed CMS. Normalize event fields, support search/filters, calendar save, RSVP/deep-link, accessibility information, student interest controls, and no public popularity rankings.

---

## 14. Study abroad

Study Abroad belongs inside My Path scenario planning.

### Rule

Never say a course will transfer without official approval. Labels must be:

- Pre-approved.
- Pending review.
- Estimated equivalent.
- Not evaluated.

### Workflow

```text
Choose program/term
        ↓
Review degree plan impact
        ↓
Identify requirements potentially completed abroad
        ↓
Match host courses to approved equivalencies when available
        ↓
Create primary/backup abroad schedules
        ↓
Prepare official course-approval packet
        ↓
Track decisions and update scenario
        ↓
After return, official transcript evaluation updates record
```

Track program application, academic approval, financial-aid discussion, passport/visa, housing, insurance, pre-departure orientation, return transcript, and career reflection.

---

## 15. Roles and permissions

| Role | Purpose | Boundary |
|---|---|---|
| Student | Plan, study, search, create, connect accounts, selectively share | Owns personal plan/drafts/study activity/sharing choices |
| Prospective student | Explore majors/careers/readiness | No official record assumed |
| Faculty | Materials, course guidance, AI policy, Course Studio | No duplicate LMS/gradebook; no private plans by default |
| Advisor | Shared plan, agenda, authorized follow-up | No health/billing/private study/supporter information by default |
| Tutor/support | Student-selected assistance | Only assigned/consented context |
| Parent/supporter | Student-consented milestone view | No default education-record access |
| Registrar/curriculum | Publish official catalog/requirements | Source-of-truth management |
| Institution admin | Tenant/configuration/aggregate data | No unrestricted record browsing |
| IT/security | Integrations, policies, audit | Least-privilege audited access |
| Semester support | Support and technical troubleshooting | No student data absent documented authorization |

Use RBAC + ABAC + object-level authorization. Recheck authorization for each sensitive request.

**v2:** The table above is the original high-level summary. It now has 27 more roles, and the full permission matrix (every role, scope, capability, what it can read, and what it can never read) is in **section 29**. It is implemented in the existing `app_roles` / `role_capabilities` / `role_grants` model — never as a second permission system.

---

## 16. Integrations

### Connection order

1. Semester account/authentication.
2. Google/Microsoft optional calendar/file connections.
3. Canvas LTI 1.3 launch and approved course context.
4. Institution SSO.
5. Read-only SIS/curriculum data.
6. Advising, event, resource, and calendar feeds.
7. Housing/dining/billing status/deep links.
8. Deeper enterprise integrations only after pilot maturity.

### Google and Microsoft

- Use OAuth 2.0 delegated scopes and incremental consent.
- Google Drive: use Picker and `drive.file` where possible; avoid broad Drive access.
- Microsoft: use delegated Graph permissions and request the smallest permission set.
- Calendar: read access first; request write only at the moment a student chooses to create/update an event.
- Gmail/Outlook: draft messages for student review; never automatically send.
- Display connected account, granted scopes, selected files, last sync, disconnect, and delete-imported-copies controls.

### Canvas/LMS

- Use LTI 1.3 / LTI Advantage.
- Start with secure launch, identity/course context, deep links back to official Canvas work.
- Import only approved metadata/files/materials.
- Do not ingest grades, attendance, activity, or submissions by default.
- Gradescope/Turnitin/Top Hat remain authoritative for their functions; Semester surfaces approved student-facing context and deep links.

### Banner/Workday

- Use institution-owned integration layer, API gateway, Ellucian Ethos, Workday APIs, RaaS, or approved middleware.
- Do not connect directly to production SIS databases.
- Minimal initial fields: active status, program, term, enrollment, catalog/course data, registration window, hold category, advisor assignment if authorized.
- Label source/freshness and provide official fallbacks.

### System-to-system security

```text
Semester service ↔ institution API gateway
mTLS + OAuth client credentials or signed JWT + short-lived token + scopes + tenant isolation
```

Use webhooks with signature verification, timestamp checks, replay protection, durable inbox, idempotency key, version ordering, audit history, and scheduled reconciliation.

---

## 17. Security, privacy, reliability, and emergency boundaries

### Zero trust requirements

- SAML/OIDC for users.
- MFA for admin and high-risk actions.
- OAuth 2.0 delegated scopes for connected student accounts.
- mTLS + short-lived workload identity for sensitive service-to-service APIs.
- Least privilege and object-level authorization.
- Tenant isolation.
- Encryption in transit and at rest.
- Secrets manager, rotation, no secrets in code.
- Signed webhooks, schema validation, WAF/rate limits, replay prevention.
- Audit logs for sensitive access/write/share/export actions.
- Backups, restore tests, monitoring, error alerting, incident response, staging/production separation.

### Privacy commitments

- Do not sell student data.
- Do not use student data for advertising.
- Do not train public models on student data without explicit documented authorization.
- Support export, deletion, disconnect, source visibility, permission revocation, and sharing controls.
- Do not treat clicks, time in app, LMS activity, or study time as proof of ability, motivation, wellbeing, or risk.

### Emergency Disclosure Console

Do not build this in the student MVP. It is enterprise-only, institution-governed, separately authenticated, field-limited, just-in-time, fully audited, and only for legally authorized emergency responders. It must not appear in Supporter View or normal admin tools.

---

## 18. Semester Intelligence

### Four modes

| Mode | Purpose |
|---|---|
| Analyze | Extract, summarize, identify patterns in selected authorized materials |
| Explain | Teach source-grounded concepts in requested format |
| Generate | Build editable study assets, drafts, plans, slides, notes |
| Execute | Prepare safe product actions after explicit preview and confirmation |

### Model architecture

```text
Semester application
        ↓
Semester Intelligence orchestration layer
        ├── Claude adapter
        ├── OpenAI-compatible adapter
        ├── Retrieval/source grounding
        ├── Policy and permissions engine
        ├── Tool/action registry
        ├── Academic integrity layer
        ├── Safety/moderation
        └── Audit/evaluation/feedback
```

Never hard-code the product to a single provider. Select provider/model based on capabilities, approved institutional policy, data sensitivity, cost, latency, and user settings.

### Required AI controls

- Source citations/page/slide/timestamp anchors.
- Source access checks.
- Confidence/missing-source warnings.
- Model/provider policy transparency where required.
- Course/assignment AI rules.
- Human confirmation for writes/sends/shares/exports/schedules.
- Output history/delete controls.
- Prompt-injection defenses for uploaded content.
- AI feedback/report issue path.
- No official degree certification or registration decisions by AI.

---

## 19. Public website, company, careers, and membership

### Public route set

```text
/
/product
/students
/institutions
/solutions
/pricing
/tools
/resources
/stories
/about
/careers
/contact
/security
/privacy
/accessibility
/help
/status
/changelog
/login
/signup
/account
/membership
/app/*
```

### Homepage promise

**Headline:** College is complicated. Your path shouldn’t be.

**Copy:** Semester brings degree requirements, course options, schedule, goals, and next steps into one intelligent home—so students can make every semester count.

**Primary CTA:** Start planning free.

**Secondary CTA:** See how it works.

**Institution CTA:** Explore Semester for institutions.

### Careers

**Headline:** Help make college easier to navigate.

Include opportunities for front-end, full-stack, back-end, mobile, product design, accessibility, academic advising, student success, campus ambassadors, content creators, partnerships, and advisors.

Initial contact email:

`harrisonjrubin7@gmail.com`

Future aliases:

```text
hello@semester.com
support@semester.com
careers@semester.com
partners@semester.com
security@semester.com
press@semester.com
```

### Membership

| Plan | Suggested price | Package |
|---|---:|---|
| Free | $0 | Profile, one plan, basic schedule, directory, saved goals/reminders |
| Plus | $7.99/month or $59/year | Unlimited plans, comparisons, scenarios, calendar sync, sharing/export |
| Pro | $14.99/month or $99/year | What-if scenarios, major/minor comparison, portfolio, advanced career/advisor tools |
| Semester Access | Institution sponsored | SSO, verified data, campus directory, configured premium features |

Users must be able to upgrade, downgrade, cancel, export data, request deletion, manage payment method, view invoices, and check institutional eligibility. Never hide cancellation or paywall personal data export/deletion.

---

## 20. Institution deployment and pilot model

### First institutional offer

# Semester Registration and Path Pilot

```text
Length: 2–6 weeks
Cohort: 25–100 students
Use case: registration readiness and academic planning

Semester provides:
• student onboarding
• Path Snapshot
• term/course planning
• schedule/conflict view
• registration action checklist
• advisor agenda
• student clarity survey
• advisor feedback collection
• outcomes report

Institution provides:
• pilot sponsor
• cohort invitation
• basic program/course/deadline information
• staff champion
• feedback participation
```

### Institutional rollout stages

1. Discover: goals, cohort, stakeholders, data scope, risks, success metrics.
2. Configure: branding, roles, content, SSO, minimal approved data.
3. Validate: data quality, security, accessibility, workflows, support.
4. Launch: train staff/students and run campaign.
5. Measure: adoption, planning, clarity, advisor usefulness, support outcomes.
6. Expand: add cohorts, modules, and integrations after evidence.

---

## 21. Metrics and research

### North-star metric

**Weekly Path Progressed Students:** a student who completes at least one meaningful planning, studying, support, career, or advising action in a week.

### Measure separately

| Layer | Examples |
|---|---|
| Engagement | Logins, searches, page opens, time in app |
| Meaningful use | Plan saved, backup course, conflict resolved, agenda created, quiz completed |
| Student experience | Clarity, confidence, agency, support discovery, trust |
| Operations | Support tickets, resolution time, self-service success |
| Outcomes | Registration timing, credit pace, persistence, completion—only with approved careful evaluation |

### Core student question

> “I understand what I need to do next.”

Do not claim Semester causes retention, grades, persistence, or graduation without rigorous privacy-governed research design.

---

## 22. Feature governance

Create a Feature Governance Board: product, design, engineering, accessibility, privacy/data, security, student research, institutional success, and relevant domain owner.

Every feature requires:

```text
Feature name
Target user
Job to be done
Trigger/moment
Current workaround
Smallest solution
Data required
Authoritative source
Permissions
Accessibility acceptance criteria
Privacy/security risk
Success metric
Operational owner
Failure/fallback behavior
What it replaces or merges
Out of scope
Sunset condition
```

Rules:

- Five primary student destinations only.
- One Action Center, one Search, one Workspace, one Intelligence layer.
- Contextual modules appear only when relevant.
- Quarterly feature review: invest, simplify, merge/hide, defer, retire.
- No named owner, metric, support plan, or accessibility plan = do not launch.

---

## 23. Implementation sequence

### Phase 0: Foundation

- Repository audit.
- Production data model.
- Authentication/persistence.
- Tenant model.
- Privacy controls.
- Monitoring/errors/backups.
- Responsive and accessibility baseline.
- Feature flags.
- Staging/production separation.

### Phase 1: Student daily value

- Today + Action Center.
- My Path + Registration readiness.
- Search + Ask + Act.
- Basic Plan/Schedule.
- Calendar connection/export.
- Advisor Meeting Mode.
- Basic Study Studio.
- Public web, signup, membership, help/feedback.

### Phase 2: Educator/advisor value

- Faculty Course Studio.
- Canvas LTI launch.
- Faculty-approved study packs.
- Course AI rules.
- Advisor shared planning.
- Campus directory/content governance.
- Career Hub.

### Phase 3: Institution confidence

- SSO, SCIM, institution administration.
- Minimal Banner/Workday feed.
- Aggregate pilot analytics.
- Security/trust/procurement package.
- Institution sandbox and implementation center.

### Phase 4: Contextual expansion

- Campus Hub.
- Housing/dining/billing status/deep links.
- Study Abroad.
- Athlete Plan.
- Portfolio/credentials.
- Advanced workspace integrations.

### Phase 4b: Competitive expansion (v2)

See section 32 for the order. In short: Registration Day Mode and Graduation Simulator, then admitted/transfer onboarding and peer mentors, then office actions and demand forecasting, then accommodations passport, skills record, talent pool and opportunities.

### Phase 5: Enterprise maturity

- Deep SIS/integration gateway.
- Multi-campus support.
- Advanced audit/permissions.
- Formal compliance program.
- Digital credentials and lifelong-learning record.

---

## 24. Exact AI coding-agent workflow

### Required first response from Claude Code / ChatGPT

Do not modify production code immediately. First:

1. Inspect the repository.
2. Create `docs/AUDIT.md`.
3. Create `docs/SPRINT-1-REGISTRATION-PATH.md`.
4. Create `docs/DATA-MIGRATION-PLAN.md`.
5. Create `docs/SECURITY-GAP-ANALYSIS.md`.
6. Create `docs/ROUTE-AND-FEATURE-CROSSWALK.md`.
7. Report exact files that would be changed before implementation.
8. Wait for confirmation before destructive refactors or production deployment.

### Branching

```text
main                         stable production
semester-unified-platform    integration branch
feature/action-center
feature/auth-supabase
feature/today-dashboard
feature/path-registration
feature/marketing-site
feature/study-studio
feature/institution-pilot
```

### Vertical slice workflow

```text
Create feature branch
        ↓
Build one complete vertical slice
        ↓
Add persistence, permission checks, tests, a11y states, loading/error states
        ↓
Deploy preview only
        ↓
Manual QA on mobile/desktop/keyboard/slow network
        ↓
Pull request and review
        ↓
Merge to integration branch
        ↓
Production release only with explicit approval
```

### Required test coverage

- Authentication and protected route behavior.
- Tenant isolation and object-level authorization.
- Action lifecycle and source precedence.
- Data source/freshness behavior.
- Schedule conflict calculations.
- Search-to-action flows.
- Accessibility: keyboard, focus, labels, dialogs, color contrast.
- Mobile/responsive behavior.
- External API/webhook failure behavior.
- Webhook idempotency/out-of-order event behavior.
- No secrets exposed in client bundle.
- Regression coverage for existing routes.

---

## 25. Exact first implementation prompt

Copy this into Claude Code after it audits the repository:

```text
You are extending the existing Semester repository at:
https://github.com/harrisonjrubin7-cmyk/semester

This is not a rewrite. Preserve working routes, existing visual language,
existing tests, and existing state behavior unless a migration is planned,
tested, documented, and reversible.

First read:
- app/package.json
- app/README.md
- app/.env.example
- app/vercel.json
- app/vite.config.ts
- app/src/App.tsx
- app/src/main.tsx
- app/src/screens.tsx
- app/src/state/
- app/src/data/
- app/src/ai/
- app/src/intelligence/
- app/src/a11y/
- supabase/
- SEMESTER_IMPLEMENTATION_STATUS.md
- SEMESTER_PRODUCT_COMPLETENESS_MATRIX.md
- SECURITY.md
- PILOT.md

Create these documents before changing product behavior:
- docs/AUDIT.md
- docs/SPRINT-1-REGISTRATION-PATH.md
- docs/DATA-MIGRATION-PLAN.md
- docs/SECURITY-GAP-ANALYSIS.md
- docs/ROUTE-AND-FEATURE-CROSSWALK.md

Then create branch feature/registration-path-pilot.

Implement only this first vertical slice:
- Supabase authentication and protected application routes if not already complete
- persistent profile and student profile data
- canonical Action model and action history
- Today dashboard with Path Snapshot, Next Best Step, and Immediate Commitments
- basic student-entered path / degree-plan persistence
- basic term planning and schedule conflict detection
- registration readiness checklist
- advisor meeting agenda with a safe view-only share/export option
- feedback capture and support route
- source labels: Institution verified, Imported, Student entered, Estimated, Needs review
- mobile responsive and accessibility-complete states
- analytics events for activation, plan creation, action completion, and clarity survey

Do not implement in this sprint:
- official registration execution
- deep SIS/LMS integrations
- payment, housing, dining, health, emergency, or parent portals
- full Study Studio
- unrestricted AI agents
- broad institutional analytics
- social/community feed

Use feature flags. Keep all AI and provider keys server-side. Do not expose secrets. Do not deploy production without preview validation and explicit approval.

For every database table, add RLS policies. Students may only access their own records unless they create an explicit, time-bound share with an authorized advisor. Include migrations, tests, seed/demo data that is visibly marked as demo, migration notes, and rollback notes.
```

---

## 26. Definition of done

Semester is ready for an initial real pilot when:

- A student can securely create an account.
- A student can enter basic planning context.
- A student can see a transparent Path Snapshot.
- A student can build a term plan and identify a conflict.
- A student can save a backup course/option.
- A student can create an advisor meeting agenda.
- A student sees one clear next action and can understand why.
- A student can submit feedback or request help.
- The product works on mobile, keyboard, and screen reader basics.
- Data is persistent, tenant-aware, access-controlled, exportable/deletable.
- Demo versus verified data is clearly labeled.
- The team can measure activation, meaningful action completion, student clarity, advisor feedback, and support friction.
- The deployment has monitoring, backups, rollback plan, error logging, and support contact.

## Final principle

The strongest version of Semester is not the one with the most tabs or integrations. It is the one that consistently turns confusing academic and campus information into **one clear, explainable, safe next step**.

---

# Part II — Competitive expansion (v2)

## 27. Why these additions

Some current ideas are now basic features that other apps already have. Students already have LMS-synced planners that read syllabi, and AI tutors that turn photos and PDFs into step-by-step explanations and quizzes. Universities already buy advising, early-alert and retention CRMs. Semester wins in the gap between them: the path to graduation, time, money and campus life together, from the student's side, plus anonymized data universities can't get anywhere else.

Every addition below follows the rules in sections 3 and 22. It needs an owner, a metric, an accessibility plan and a sunset condition, and it lives in one of the five destinations or in a contextual module, never as a new top-level tab.

| Status | Features |
|---|---|
| Basic features (have them, don't lead with them) | Syllabus parsing, LMS sync, AI tutoring, flashcards/quizzes, calendar |
| Differentiators (lead with these) | Registration Day Mode, graduation-and-cost simulator, transfer credit tool, course demand forecasting, accommodations passport, verified skills record |
| Habit and growth | Widgets, SMS reminders, weekly check-ins, Semester Wrapped, study-group matching |

## 28. Expansion features

Each feature lists: where it lives, what it does, tables it uses (section 30), guardrails, and its success metric.

### 28.1 Registration Day Mode
- **Lives in:** My Path → Registration Center. Takes over Today for the 72 hours around the student's registration time.
- **Does:** Countdown to the student's time ticket. Checklist (holds cleared, advisor PIN, CRNs copied). Primary plan with ranked backups per course ("if CS 101-02 is full, try 101-04, then MATH 150"). Open-seat watches. One screen with the official registration deep link and a copy-all-CRNs button.
- **Tables:** `registration_windows`, `registration_time_tickets`, `term_plan_courses` (status `backup`, `backup_rank`, `backup_for`), `catalog_sections`, `seat_watches`.
- **Guardrails:** Semester never registers for the student. Seat counts show `synced_at` and source. It never promises a seat. Alerts respect `contact_channels.quiet_hours`.
- **Metric:** % of pilot students with at least one ranked backup per planned course before their window opens. On-time registration rate.

### 28.2 Graduation simulator and cost of delay
- **Lives in:** My Path → Scenarios.
- **Does:** "What if I drop this class, add a minor, switch majors, take summer courses, or go part-time?" Shows the projected graduation term and an estimated total cost. Puts the cost of delay in plain words: "One more semester is about $X."
- **Tables:** `graduation_scenarios` (always labeled `estimated`), `cost_plans`.
- **Guardrails:** Always labeled an estimate. Cost inputs are entered by the student or come from published tuition rates. Never uses aid determinations. Never says "you will graduate."
- **Metric:** Scenarios created per active student. % who share a scenario with an advisor.

### 28.3 Money planner
- **Lives in:** Plan → Money (contextual).
- **Does:** Cost of attendance per term, textbook savings, scholarship deadlines, and work hours compared with credit load ("15 credits + 25 work hours is a heavy week; here's the load").
- **Tables:** `cost_plans`, `opportunities` (kind `scholarship`).
- **Guardrails:** Student-only. Never shared through `family_grants` unless the student adds a `finances` grant. Payments stay with the bursar.

### 28.4 Transfer credit tool
- **Lives in:** My Path → Transfer (shown when a transfer, dual-enrollment or admitted segment is present).
- **Does:** The student uploads or enters prior courses. Semester matches them against approved articulation rules, shows where each credit lands in the degree map, and builds an official evaluation request packet.
- **Tables:** `articulation_rules` (the partner proposes, the registrar approves), `transfer_evaluations` (students can only set `estimated` or `submitted`).
- **Guardrails:** Uses the section 14 labels: pre-approved / pending review / estimated equivalent / not evaluated. Only the institution can set `institution_verified`.

### 28.5 Course details from other students
- **Lives in:** Search → Course detail.
- **Does:** Real weekly workload hours, difficulty and usefulness from verified students at the same school. Links to public grade distributions where the institution publishes them. A syllabus library.
- **Tables:** `course_reviews` (authorship stored separately in `course_review_authors`, submitted through `submit_course_review`).
- **Guardrails:** Reviews are moderated before publishing. No instructor ratings in v1. Reviews are aggregated and never show the author. Only verified students at that school can submit.

### 28.6 Crunch-week forecast and energy-aware scheduling
- **Lives in:** Plan → Schedule and Today.
- **Does:** Uses the syllabus deadlines the student has confirmed to find weeks where exams and deadlines pile up. Warns 2–3 weeks ahead and proposes an earlier study plan. Places study blocks around work, practice, commute and the student's stated sleep window.
- **Tables:** None new. Derived on the client from confirmed syllabus items and schedule blocks.
- **Guardrails:** Never labels the student. Wording: "Week 9 has 4 deadlines. Want to start two of them earlier?"

### 28.7 Accommodations passport
- **Lives in:** Me → Accommodations (shown only when a passport exists).
- **Does:** Disability services issues a functional summary (e.g., "extended time 1.5x"). The student shares it with a specific instructor, for a specific course, until a date. The student sees every time it was read.
- **Tables:** `accommodation_passports`, `accommodation_shares`, `accommodation_access_events`, function `read_shared_accommodation(share)`.
- **Guardrails:** Never a diagnosis. Instructors cannot read the passport table directly. Shares are time-limited to the term (at most 200 days), and the student can revoke them instantly.

### 28.8 Smarter Semester Intelligence
- **Memory across semesters.** Stored in `ai_memories`. The student adds or confirms each memory, can view and delete it, and it is never readable by staff.
- **Photo-to-plan.** Snap a degree audit, flyer or hold notice, and extracted actions go to the Action Center for review (labeled `needs_review`).
- **Weekly check-ins.** Stored in `weekly_checkins`: three actions, one risk, one opportunity. Delivered by push or SMS.
- **Voice mode.** Uses the same guardrails as text. No always-listening.
- **Guardrails:** Everything in section 18. Memories are loaded into prompts only for the owner.

### 28.9 Everyday use and habit
- iOS/Android home widgets and lock-screen updates showing the next class, next deadline, and the registration countdown.
- SMS reminders through `contact_channels` (the server sets `verified_at` after a code round-trip, and quiet hours apply).
- Offline mode for Today, schedule and study packs.
- Semester Wrapped: an end-of-term recap rendered as a shareable image on the client. No public data endpoint.
- Study-group matching through `study_match_optins`. Students only see others who also opted in for the same course and section.

### 28.10 Career: verified skills record, talent pool, alumni mentors
- **Skills record** (`skill_records`): The student adds a skill and asks a course instructor or career office to verify it. Exports to résumé/LinkedIn.
- **Talent pool** (`talent_profiles`, `talent_profile_views`): The student opts in. Consent expires after 180 days by default (at most 1 year). Employers see only opted-in, unexpired profiles, and the student sees every view.
- **Opportunities** (`opportunities`): Jobs, internships, scholarships, deals and programs. Publishers draft, and a moderator publishes.
- **Alumni mentors** (`alumni_mentor_offers`): Only verified alumni (a `role_grants` alumni row for the school) can offer.

### 28.11 For universities (what makes them pay)
- **Course demand forecasting** (`course_demand_snapshots`): Anonymized counts of planned and backup students per course and term, with n ≥ 10 enforced by a check constraint. Only students who opted in (`term_plan_courses.contributes_to_demand`) are counted. Refreshed by a scheduled job with the service role (`private.refresh_course_demand`).
- **Bottleneck reports:** Derived from demand compared with `catalog_sections.capacity` and waitlist counts.
- **Which advice works** (`outcome_aggregates`): Cohort-level metrics with n ≥ 10 and a method note.
- **Office actions** (`institution_actions`): The official feed from registrar, financial aid, the bursar, international, veterans, residence life and athletics compliance into each student's Action Center.

## 29. Stakeholder roles and permission matrix

### 29.1 Principles
1. **Segments are not roles.** International, veteran, first-generation, adult learner, part-time, caregiver, working, athlete and online are private facts in `student_context`. They turn modules on and are never readable by staff. Institution-asserted segments go in `verified_segments`, and only the service role can write them.
2. **Roles are authority over a scope.** Stored in `role_grants(subject, role, scope_kind, scope_id, provenance, expires_at)`. Scope kinds: `platform, school, organization, course, department, office, residence, business, employer, cohort, partner`. Every non-platform scope id starts with the tenant id (`exp-u`, `exp-u/financial-aid`, `exp-u/first-year`, `exp-u/nashville-cc`).
3. **Policies ask for capabilities, never role names.** `private.has_capability(cap, scope_kind, scope_id)`.
4. **Access to a student's own data always needs that student's consent, and it expires.** Existing: `family_grants` (parents/guardians, per-resource, can expire, pay ≠ read) and `support_access_grant` (staff, 7 days max). New: `accommodation_shares`, `peer_mentor_assignments`, `talent_profiles.opted_in`.
5. **Aggregates only, n ≥ 10.** Enforced by check constraints, not the UI.
6. **Semester staff see nothing by default.** Support needs a student-created `support_access_grant`.

### 29.2 Student-side roles

| Role / segment | How it is established | Unlocks | Never |
|---|---|---|---|
| `prospective_student` (existing) | Self | Explore majors, cost simulator, public tools | Institution data |
| `admitted_student` (new role) | Institution grant, cohort scope | Pre-orientation checklist, first-term plan, peer mentor, admitted-cohort actions | Current-student course reviews until enrolled |
| `transfer_student` (existing) | Institution grant or segment | Transfer credit tool, articulation rules | Setting `institution_verified` |
| `dual_enrollment_student` (new role) | Institution grant, partner scope | College credit planning. Minors: `student_context.is_minor` + `guardian_consent_at` | Talent pool, study matching and reviews while a minor without guardian consent (enforce in app and API) |
| `graduate_student` (existing) | Institution grant | Thesis milestones, funding, TA/RA schedules | — |
| `alumni` (existing) | Institution grant, school scope | Alumni mode, mentor offers, loan planning | Current-student data |
| International / veteran / first-gen / adult / part-time / caregiver / working / athlete / online | `student_context` segment | Matching modules (compliance reminders, GI Bill checklist, plain-language glossary, part-time planner, athlete plan) | Visible to any staff role |

### 29.3 Campus staff roles

| Role | Scope | Capabilities | Can read | Never reads |
|---|---|---|---|---|
| `registrar` | school | `institution_action:publish`, `registration_window:publish`, `catalog:sync`, `articulation:approve`, `demand:read` | Demand snapshots, all articulation rules, the windows it publishes | Any student's plan, segments, AI memory |
| `financial_aid_officer` | office (`<school>/financial-aid`) | `institution_action:publish` | Actions it published | Cost plans, scenarios |
| `student_accounts_officer` | office | `institution_action:publish` | Actions it published | Cost plans |
| `disability_services_officer` | school | `accommodation:verify` | Passports at its school | Diagnoses (never stored) |
| `international_student_advisor` | office | `institution_action:publish` (compliance) | Actions it published | Segments (it gets international status from the SIS, not from Semester) |
| `veterans_certifying_official` | office | `institution_action:publish` (certification) | Actions it published | Segments |
| `residence_life_staff` | office or residence | `institution_action:publish` | Actions it published | Roommate or location data |
| `resident_assistant` | residence | `resource:publish` (resource/event types only) | Actions it published | Anything about residents |
| `learning_center_staff` | office | `resource:publish`, `tutoring:manage` | Its tutoring sessions | Grades, study data |
| `peer_mentor`, `orientation_leader` | cohort | `mentee:read` | Onboarding checklist progress of students who accepted them | Plans, reviews, segments, anything else |
| `counseling_liaison` | office | `resource:publish` | Actions it published | Any student data, ever |
| `career_coach` | office | `skill:verify`, `opportunity:publish` | Skill requests sent to its office | Talent pool (employers only) |
| `faculty` (existing) | course | `skill:verify` (+ existing) | Accommodation shares addressed to it, through the audited function. Skill requests for its course | Passports directly, plans |
| `teaching_assistant`, `tutor`, `academic_advisor` (existing) | course / office | Existing | Existing consented shares | — |
| `department_chair` | department (`<school>/<SUBJ>`) | `demand:read` | Demand for its subject prefix | Individuals |
| `dean` | school | `demand:read`, `outcomes:read` | Aggregates | Individuals |
| `institutional_researcher` | school | `demand:read`, `outcomes:read` | Aggregates (n ≥ 10) | Individuals |
| `athletics_compliance_officer` | office | `institution_action:publish` | Actions it published | Health, injury, app activity |
| `university_admin`, `university_staff`, `department_admin` (existing) | school | Existing (`tenant:configure`, `ai:configure`, `source:approve`, `audit:read`, `support:read`) | Existing | Unrestricted record browsing |

### 29.4 External stakeholders

| Stakeholder | Role / mechanism | Capabilities | Sees | How Semester earns |
|---|---|---|---|---|
| Parent / guardian | Existing `profiles.account_role = 'parent'` + `family_grants` | — | Only named resources the student granted, until expiry. `payment` ≠ read | Family plan |
| Employer / recruiter | `employer` (existing), employer scope | `talent:search`, `opportunity:publish` | Opted-in, unexpired talent profiles. Each view is logged for the student | Recruiting subscription |
| Community college / transfer partner | `transfer_partner_admin`, partner scope | `articulation:propose` | Its own proposed rules | Institutional license |
| High school counselor | `high_school_counselor`, partner scope | None by default | Only what a dual-enrollment student (and guardian, for minors) shares through a consented share | Partnerships |
| Scholarship provider / donor | `scholarship_provider`, business scope | `opportunity:publish` | Its own listings | Listing/sponsorship fees |
| Bookstore / local business / off-campus housing | `marketplace_partner`, business scope | `opportunity:publish` (kind `deal`/`housing`) | Its own listings | Affiliate/marketplace fees |
| Foundation / research partner | `research_partner`, school scope | `outcomes:read` | n ≥ 10 cohort aggregates only | Grants (non-dilutive) |
| Alumni mentor | `alumni` + `alumni_mentor_offers` | — | Nothing about students until a student reaches out | Alumni-relations license |

### 29.5 Semester internal roles

| Role | Scope | Capabilities | Rule |
|---|---|---|---|
| `support_agent` | platform | `support:ticket` | No student data without a live `support_access_grant` created by the student |
| `moderator` (existing) | platform | + `review:moderate`, `opportunity:moderate` | Sees review authorship only for moderation, and reading it is audited |
| `implementation_manager` | school | `tenant:implement` | Sandbox tenant configuration only. MFA required |
| `data_steward` | platform | `data_request:handle` | Works export/delete/correct/restrict requests. Cannot read AI memory or plans |
| `platform_admin` (existing) | platform | Existing 3 | Does not implicitly hold every capability |

## 30. Database schema reference

All of this is in `supabase/migrations/20260926150000_expansion_roles_and_features.sql`. Every table has RLS enabled, `anon` has no access, and every foreign key has a covering index (`indexes.check.sql`). Only two new functions are callable from the browser (`grants.check.sql`).

| Table | Owner / writer | Readers | Key constraints |
|---|---|---|---|
| `student_context` | Student (`verified_segments` = service role only) | Student only | Segment allowlist. Guardian consent only if minor |
| `term_plan_courses` | Student | Student only (aggregates via demand job) | `backup_rank` required when status = backup. `contributes_to_demand` defaults to false |
| `registration_windows` | `registration_window:publish` @school | Students at that school | `closes_at > opens_at` |
| `registration_time_tickets` | Student | Student | Source label |
| `catalog_sections` | `catalog:sync` @school | Students at that school | Non-negative counts, `synced_at` |
| `seat_watches` | Student | Student | Channel allowlist |
| `graduation_scenarios` | Student | Student | Label is always `estimated` or `needs_review` |
| `cost_plans` | Student | Student | One per term |
| `articulation_rules` | Partner proposes; registrar approves | Approved → students at the school; partner and registrar see their own | Partner scope inside tenant. Approval shape |
| `transfer_evaluations` | Student (`estimated`/`submitted` only) | Student | Only the institution can set verified/denied |
| `accommodation_passports` | `accommodation:verify` @school | Student, DS office | Expires within 400 days. No self-issue |
| `accommodation_shares` | Student | Student, addressed instructor (metadata) | Expires within 200 days. Two different people |
| `accommodation_access_events` | `read_shared_accommodation()` only | Student | Append-only from the client's view |
| `course_reviews` | `submit_course_review()`; status by `review:moderate` | Published → that school; author; moderators | Bounded ratings. No author column |
| `course_review_authors` | `submit_course_review()` | Author, moderators | One per review |
| `study_match_optins` | Student | Other opted-in students in the same course/section | Expires after 120 days by default |
| `ai_memories` | Student | Student only | Kind allowlist |
| `weekly_checkins` | Student | Student | One per week |
| `contact_channels` | Student (`verified_at` = server) | Student | Unique per address |
| `skill_records` | Student; verifier decides | Student; `skill:verify` in requested scope | Students can't set verified. Verified shape |
| `talent_profiles` | Student | Student; any live `talent:search` holder if opted in and not expired | Expires within a year |
| `talent_profile_views` | Employer (self, own employer scope) | Student, viewer | — |
| `opportunities` | `opportunity:publish` (draft/pending); `opportunity:moderate` publishes | Published → tenant or all | Kind allowlist |
| `peer_mentor_assignments` | Student accepts a mentor who holds `mentee:read` in a cohort the student is in | Both ends | At most 200 days. Cohort inside tenant |
| `onboarding_progress` | Student | Student; accepted, live mentor | Step key format |
| `institution_actions` | `institution_action:publish` or `resource:publish` (resource/event only) in scope | Targeted student or cohort members; publisher scope | Exactly one target. Scope and cohort inside tenant |
| `course_demand_snapshots` | Service role (`private.refresh_course_demand`) | `demand:read` @school or @department | planned ≥ 10; backup is null or ≥ 10 |
| `outcome_aggregates` | Service role | `outcomes:read` @school | n ≥ 10. Metric allowlist |
| `data_requests` | Student files; steward updates | Student; `data_request:handle` | Status flow |
| `alumni_mentor_offers` | Verified alumni | Students at that school | Capacity 0–20 |

**New helpers (private, not callable over the API):** `scope_in_tenant`, `has_capability_anywhere`, `in_cohort`, `opted_into_match`, `mentors`, `refresh_course_demand` (service role only).

**New public functions (allowlisted):** `read_shared_accommodation(want_share uuid)`, `submit_course_review(...)`.

## 31. Rules for the coding agent on this schema

1. **Apply order:** The migration runs after `20260925160000_support_access_ui.sql`. Run `supabase/check.sh` on Postgres 17. All suites must pass except the existing `organizations` failure, which should be fixed in its own PR.
2. **Deletion:** Every student-owned table the client writes must be added to `OWNED_TABLES` in `app/src/lib/cloud.ts` in the same PR, or `app/src/lib/privacy.test.ts` must fail. Tables: `student_context`, `term_plan_courses`, `registration_time_tickets`, `seat_watches`, `graduation_scenarios`, `cost_plans`, `transfer_evaluations`, `accommodation_shares`, `course_review_authors` (the author withdraws; the anonymous review stays and is marked KEPT, with the reason printed on the privacy page), `study_match_optins`, `ai_memories`, `weekly_checkins`, `contact_channels`, `skill_records`, `talent_profiles`, `peer_mentor_assignments`, `onboarding_progress`, `alumni_mentor_offers`.
3. **Service-role writes stay on the server:** `verified_segments`, `contact_channels.verified_at`, `transfer_evaluations` institution decisions, `course_demand_snapshots`, `outcome_aggregates`. Use `app/server` or Edge Functions only, never the browser.
4. **Minors:** Before enabling talent pool, study matching, reviews or messaging, check `student_context.is_minor` and `guardian_consent_at` in both the UI and the API.
5. **Feature flags:** Each feature is gated per tenant through `tenant_feature_policy` (existing): `registration_day_mode`, `graduation_simulator`, `transfer_tool`, `course_reviews`, `accommodation_passport`, `talent_pool`, `demand_forecast`, `peer_mentors`, `sms_reminders`.
6. **Action Center integration:** `institution_actions` rows become `SemesterAction` items with `source.kind = 'institution_verified'`, source system = office, and `lifecycle.completedBy = 'student'` stored in the student's own action history. The publisher never sees individual completion, only future n ≥ 10 aggregates.
7. **Copy rules:** Never say "at risk," "behind" or "failing." Label estimates everywhere. Wording for demand pages: "Planned by N students who chose to share anonymized planning data."
8. **Audit:** Role grants are already audited (`role_grant_audit`). Accommodation reads are audited by the function. Employer profile views are logged by the employer's insert (also enforce this in the API). Moderator reads of authorship should be written to `moderation_audit` in the moderation screen.

## 32. Build order for the expansion

| Sprint | Slice | Roles activated | Tables | Definition of done |
|---|---|---|---|---|
| E1 | Registration Day Mode + ranked backups + seat watch | `registrar` | `registration_windows`, `registration_time_tickets`, `term_plan_courses`, `catalog_sections`, `seat_watches` | A student in the pilot cohort sees a countdown, ranked backups and a copy-CRNs screen. The registrar publishes a window |
| E2 | Graduation simulator + money planner | — | `graduation_scenarios`, `cost_plans` | 3 scenario types. Cost of delay shown. Always labeled estimated |
| E3 | Admitted & transfer onboarding + peer mentors | `admitted_student`, `transfer_partner_admin`, `peer_mentor`, `orientation_leader` | `student_context`, `onboarding_progress`, `peer_mentor_assignments`, `articulation_rules`, `transfer_evaluations` | An admitted student finishes the checklist with a mentor. A partner proposes and the registrar approves |
| E4 | Office action feed | `financial_aid_officer`, `student_accounts_officer`, `international_student_advisor`, `veterans_certifying_official`, `residence_life_staff`, `resident_assistant`, `counseling_liaison`, `athletics_compliance_officer` | `institution_actions` | An office sends a cohort action that shows up in Today with its source |
| E5 | Demand forecasting + outcomes (institution value) | `department_chair`, `dean`, `institutional_researcher`, `research_partner` | `course_demand_snapshots`, `outcome_aggregates` | Registrar dashboard with n ≥ 10. Scheduled refresh. Opt-in consent UI |
| E6 | Habit: widgets, SMS, weekly check-ins, AI memory, Wrapped | — | `contact_channels`, `weekly_checkins`, `ai_memories` | SMS verified by the server. Quiet hours. Memory screen with delete |
| E7 | Course reviews + study matching | `moderator` (+ caps) | `course_reviews`, `course_review_authors`, `study_match_optins` | Moderation queue. Author never shown |
| E8 | Accommodations passport | `disability_services_officer` | `accommodation_*` | DS office issues, student shares, instructor reads through the function, student sees each read |
| E9 | Career network: skills, talent pool, opportunities, alumni | `career_coach`, `employer`, `scholarship_provider`, `marketplace_partner` | `skill_records`, `talent_profiles`, `talent_profile_views`, `opportunities`, `alumni_mentor_offers` | Verified skill exported. Opt-in expires. Moderated listings |
| E10 | Internal ops | `support_agent`, `data_steward`, `implementation_manager` | `data_requests` | Request queue with SLA. Sandbox tenant setup checklist |

Ship E1 and E2 into the current Registration & Path Pilot first. They strengthen the pilot directly. Everything from E3 on waits for pilot evidence (section 21).

## 33. Exact expansion prompt for Claude Code

```text
You are extending the existing Semester repository (not rewriting it).
Read sections 27–32 of the Master Implementation Brief v2 first.

1. Add these files exactly as provided:
   - supabase/migrations/20260926150000_expansion_roles_and_features.sql
   - supabase/expansion.check.sql
   and apply the two small edits to supabase/grants.check.sql (allowlist
   read_shared_accommodation and submit_course_review; count becomes thirty)
   and supabase/capabilities.check.sql (47 roles, 57 matrix rows).
2. Run supabase/check.sh on Postgres 17. Report every suite. The only
   accepted failure is the existing organizations.check.sql RESTRICT issue;
   open a separate issue for it.
3. Create branch feature/expansion-e1-registration-day and implement ONLY
   sprint E1 from section 32:
   - Registration Day Mode in My Path → Registration Center
   - ranked backups using term_plan_courses (status 'backup', backup_rank,
     backup_for)
   - seat watches with in-app + push delivery through the existing push_queue
   - registrar screen to publish registration_windows (capability
     registration_window:publish, school scope)
   - feature flag registration_day_mode via tenant_feature_policy
   - add every new student-owned table the client writes to OWNED_TABLES in
     app/src/lib/cloud.ts, and keep app/src/lib/privacy.test.ts green
   - source labels + synced_at on every seat count; never promise a seat;
     deep link to the official registration system; never register for the
     student
   - keyboard, screen reader, reduced motion, mobile states; loading/empty/
     error states; tests for the countdown, backup ranking and permission
     refusals
4. Do not build E2–E10 in this branch. Do not write service-role-only
   columns from the browser. Do not deploy to production. Open a PR with a
   preview deployment, a migration note, and a rollback note, then stop for
   review.
```

## Final principle (v2)

Each new feature and each new role has to earn its place by making one next step clearer for a student, or one decision easier for an institution, without anyone seeing more than they need.
