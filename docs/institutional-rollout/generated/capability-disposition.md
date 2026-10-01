# Semester capability disposition matrix

Commit: `1f8ff58565dfa4d941f525fb8613b3a719433b91`

The sixty approved product capabilities are mapped to the existing product rather than treated as sixty routes.

## Phase 0

### Extend

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-019 | How This Works | verified | help | Product education | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/screens/help.knownlimitations.test.tsx](../../../app/src/screens/help.knownlimitations.test.tsx)<br>[app/src/screens/help.statuslink.test.ts](../../../app/src/screens/help.statuslink.test.ts)<br>[app/src/lib/help-routes.test.ts](../../../app/src/lib/help-routes.test.ts) |

## Phase 1

### Preserve

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-017 | Settings | verified | settings | Core application | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |

### Extend

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-010 | Account | verified | account | Identity platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/profile.test.ts](../../../app/src/lib/profile.test.ts)<br>[app/src/components/AccountSecurity.test.tsx](../../../app/src/components/AccountSecurity.test.tsx)<br>[app/src/screens/Recovery.test.tsx](../../../app/src/screens/Recovery.test.tsx) |
| CAP-011 | Profile | verified | profile | Identity platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/profile.test.ts](../../../app/src/lib/profile.test.ts)<br>[app/src/data/onboarding.test.ts](../../../app/src/data/onboarding.test.ts) |
| CAP-014 | Your Data and How It Is Running | verified | data | Data platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/inventory.test.ts](../../../app/src/lib/inventory.test.ts)<br>[app/src/lib/statuspage.test.ts](../../../app/src/lib/statuspage.test.ts)<br>[app/src/screens/Data.tsx](../../../app/src/screens/Data.tsx) |
| CAP-015 | Privacy and Your Rights | verified | privacy | Trust and privacy | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/privacy.test.ts](../../../app/src/lib/privacy.test.ts)<br>[app/src/lib/deleteaccount.test.ts](../../../app/src/lib/deleteaccount.test.ts)<br>[app/src/lib/revoke.test.ts](../../../app/src/lib/revoke.test.ts) |
| CAP-016 | Take It With You | verified | export | Data platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/export.test.ts](../../../app/src/lib/export.test.ts)<br>[app/src/lib/workspace-backup.test.ts](../../../app/src/lib/workspace-backup.test.ts)<br>[app/src/lib/rehearsal.test.ts](../../../app/src/lib/rehearsal.test.ts) |

## Phase 2

### Preserve

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-001 | Today | verified | home | Academic experience | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-002 | Reports | verified | brief | Academic experience | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-004 | Exam Runway | verified | runway | Learning experience | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-005 | The Week Ahead | verified | home | Academic experience | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-006 | When You Are Behind | verified | behind | Academic experience | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-007 | Tonight | verified | home | Academic experience | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-008 | Timers and Alarms | verified | clocks | Productivity experience | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-009 | Progress | verified | me | Academic experience | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-020 | Courses | verified | courses | Academic platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-022 | Add a Course | verified | import | Academic ingestion | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-023 | Edit the Course | verified | edit | Academic ingestion | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-024 | A Change to a Date | verified | announce | Academic ingestion | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-026 | Where Courses Meet | verified | meet | Learning platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-028 | Add a Reading | verified | update | Academic ingestion | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-029 | Problem Practice | verified | solve | Learning platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-030 | Practice Exams | verified | exam | Learning platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-038 | Sources | verified | sources | Academic integrity | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |

### Extend

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-003 | Calendar | verified | calendar | Academic platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/screens/calendar-source.test.ts](../../../app/src/screens/calendar-source.test.ts)<br>[app/src/screens/calendar-targets.test.ts](../../../app/src/screens/calendar-targets.test.ts) |
| CAP-021 | Assignments | verified | work, item | Academic platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/assignment.test.ts](../../../app/src/lib/assignment.test.ts)<br>[app/src/lib/draft.test.ts](../../../app/src/lib/draft.test.ts)<br>[app/src/components/CourseDetailV2.test.tsx](../../../app/src/components/CourseDetailV2.test.tsx) |
| CAP-025 | Study | verified | study | Learning platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/studystudio.test.ts](../../../app/src/lib/studystudio.test.ts)<br>[app/src/lib/studysources.test.ts](../../../app/src/lib/studysources.test.ts)<br>[app/src/screens/studyhierarchy.test.tsx](../../../app/src/screens/studyhierarchy.test.tsx) |

### External gate

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-044 | Degree Planning | verified | degree | Academic records | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/degree.test.ts](../../../app/src/lib/degree.test.ts)<br>[app/src/components/GraduationSimulator.test.tsx](../../../app/src/components/GraduationSimulator.test.tsx) |
| CAP-045 | Term Deadlines | verified | registrar | Academic records | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/registrar.calendar.test.ts](../../../app/src/lib/registrar.calendar.test.ts)<br>[app/src/lib/registrar.test.ts](../../../app/src/lib/registrar.test.ts) |

## Phase 3

### Preserve

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-012 | Links | verified | links | Campus experience | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |

### Extend

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-018 | Alerts | verified | notifs | Communication platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/notify.test.ts](../../../app/src/lib/notify.test.ts)<br>[app/src/components/pushreach.test.tsx](../../../app/src/components/pushreach.test.tsx) |
| CAP-049 | Maps | verified | maps | Campus experience | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/maps.test.ts](../../../app/src/lib/maps.test.ts)<br>[app/src/lib/arrive.test.ts](../../../app/src/lib/arrive.test.ts)<br>[app/src/screens/mapsbuildings.test.ts](../../../app/src/screens/mapsbuildings.test.ts) |

### External gate

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-051 | Clubs and Activities | verified | activities | Campus graph | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/server/institution/clubs.test.ts](../../../app/server/institution/clubs.test.ts)<br>[app/src/lib/activities.test.ts](../../../app/src/lib/activities.test.ts) |
| CAP-058 | Group Work | verified | groupwork | Collaboration platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/groupwork.test.ts](../../../app/src/lib/groupwork.test.ts)<br>[app/src/lib/groupwork.ts](../../../app/src/lib/groupwork.ts) |
| CAP-059 | Email | verified | mail | Communication platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/connect.test.ts](../../../app/src/lib/connect.test.ts)<br>[app/src/lib/mail.test.ts](../../../app/src/lib/mail.test.ts)<br>[app/src/state/slices/mailbox.test.ts](../../../app/src/state/slices/mailbox.test.ts) |
| CAP-060 | Chat | verified | classmates | Communication platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/classmates.test.ts](../../../app/src/lib/classmates.test.ts)<br>[app/src/community/connect.test.ts](../../../app/src/community/connect.test.ts)<br>[app/src/community/integrations.test.ts](../../../app/src/community/integrations.test.ts) |

## Phase 4

### Extend

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-027 | Semester Tutor | verified | ask | Semester Intelligence | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/server/institution/intelligence.test.ts](../../../app/server/institution/intelligence.test.ts)<br>[app/server/institution/intelligence-runtime.test.ts](../../../app/server/institution/intelligence-runtime.test.ts)<br>[app/src/ai/usingline.test.tsx](../../../app/src/ai/usingline.test.tsx) |

## Phase 5

### Preserve

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-032 | Analyse Data | verified | analyse | Workspace platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-037 | Maths | verified | equations | Workspace platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-039 | Draft It | verified | essay | Workspace platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |
| CAP-056 | Check the Writing | verified | proof | Academic integrity | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md) |

### Extend

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-031 | Create | verified | create | Workspace platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/screens/create-routes.test.ts](../../../app/src/screens/create-routes.test.ts)<br>[app/src/lib/creations.test.ts](../../../app/src/lib/creations.test.ts) |
| CAP-033 | Graphs and Diagrams | verified | equations, draw | Workspace platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/figure.test.ts](../../../app/src/lib/figure.test.ts)<br>[app/src/components/drawnfigure.test.tsx](../../../app/src/components/drawnfigure.test.tsx) |
| CAP-034 | Presentations | verified | deck | Workspace platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/decks.test.ts](../../../app/src/lib/decks.test.ts)<br>[app/src/lib/pptx.test.ts](../../../app/src/lib/pptx.test.ts) |
| CAP-035 | Documents | verified | write | Workspace platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/docx.test.ts](../../../app/src/lib/docx.test.ts)<br>[app/src/lib/pdf.test.ts](../../../app/src/lib/pdf.test.ts)<br>[app/src/lib/history.test.ts](../../../app/src/lib/history.test.ts) |
| CAP-036 | Spreadsheets | verified | sheet | Workspace platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/sheet.test.ts](../../../app/src/lib/sheet.test.ts)<br>[app/src/lib/sheetedit.test.ts](../../../app/src/lib/sheetedit.test.ts)<br>[app/src/lib/xlsxin.test.ts](../../../app/src/lib/xlsxin.test.ts) |
| CAP-040 | Files and Notes | verified | mine | Workspace platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/files.test.ts](../../../app/src/lib/files.test.ts)<br>[app/src/state/slices/mine.test.ts](../../../app/src/state/slices/mine.test.ts)<br>[app/src/lib/workspace-backup.test.ts](../../../app/src/lib/workspace-backup.test.ts) |

### External gate

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-057 | Video Call | verified | call | Communication platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/call.test.ts](../../../app/src/lib/call.test.ts)<br>[app/src/screens/call/consent.ui.test.tsx](../../../app/src/screens/call/consent.ui.test.tsx)<br>[app/src/screens/call/leaving.test.tsx](../../../app/src/screens/call/leaving.test.tsx) |

## Phase 6

### Extend

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-042 | Athletics | verified | athletics | Campus experience | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/athletics-career.test.ts](../../../app/src/lib/athletics-career.test.ts)<br>[app/src/lib/workspace-backup.test.ts](../../../app/src/lib/workspace-backup.test.ts) |

### External gate

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-013 | Connect Accounts | verified | connect | Integration platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/connect.test.ts](../../../app/src/lib/connect.test.ts)<br>[app/src/lib/connect.scopes.test.ts](../../../app/src/lib/connect.scopes.test.ts)<br>[app/src/lib/integration/quality.test.ts](../../../app/src/lib/integration/quality.test.ts) |
| CAP-041 | Family | verified | family | Institutional services | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/server/institution/family.test.ts](../../../app/server/institution/family.test.ts)<br>[app/src/lib/familyshare.test.ts](../../../app/src/lib/familyshare.test.ts)<br>[app/src/lib/familyinvites.test.ts](../../../app/src/lib/familyinvites.test.ts) |
| CAP-043 | Campus Services | verified | university | Institutional services | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/server/institution/gateway.test.ts](../../../app/server/institution/gateway.test.ts)<br>[app/src/lib/integration/mock-campus.test.ts](../../../app/src/lib/integration/mock-campus.test.ts)<br>[app/src/components/institutional/IntegrationDashboard.test.tsx](../../../app/src/components/institutional/IntegrationDashboard.test.tsx) |
| CAP-046 | Money | verified | costs | Institutional finance | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/server/institution/money.test.ts](../../../app/server/institution/money.test.ts)<br>[app/src/lib/cost.test.ts](../../../app/src/lib/cost.test.ts)<br>[app/src/lib/cost-plan.test.ts](../../../app/src/lib/cost-plan.test.ts) |
| CAP-047 | Meal Plan | verified | meals | Campus services | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/meals.test.ts](../../../app/src/lib/meals.test.ts)<br>[app/server/institution/housing.test.ts](../../../app/server/institution/housing.test.ts) |
| CAP-048 | Housing | verified | housing | Campus services | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/server/institution/housing.test.ts](../../../app/server/institution/housing.test.ts)<br>[app/src/lib/housing.test.ts](../../../app/src/lib/housing.test.ts) |
| CAP-050 | Registration | verified | yes | Academic records | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/server/institution/registration.test.ts](../../../app/server/institution/registration.test.ts)<br>[app/src/lib/registration-actions.test.ts](../../../app/src/lib/registration-actions.test.ts)<br>[app/src/lib/registration.test.ts](../../../app/src/lib/registration.test.ts) |

## Phase 7

### Extend

| ID | Capability | Current state | Destinations | Owner | Sources |
| --- | --- | --- | --- | --- | --- |
| CAP-052 | People and Letters | verified | people | Career platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/letters.test.ts](../../../app/src/lib/letters.test.ts)<br>[app/src/screens/People.tsx](../../../app/src/screens/People.tsx) |
| CAP-053 | Pathway | verified | pathway | Lifecycle platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/pathway.test.ts](../../../app/src/lib/pathway.test.ts)<br>[app/src/screens/pathway.test.tsx](../../../app/src/screens/pathway.test.tsx) |
| CAP-054 | Career | verified | career | Career platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/career.test.ts](../../../app/src/lib/career.test.ts)<br>[app/src/lib/career-evidence.test.ts](../../../app/src/lib/career-evidence.test.ts)<br>[app/src/screens/career.test.tsx](../../../app/src/screens/career.test.tsx) |
| CAP-055 | Applications | verified | applying | Career platform | `attachment:Pasted text.txt#L194-L985`<br>[docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md](../../../docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md)<br>[app/src/lib/apply.test.ts](../../../app/src/lib/apply.test.ts)<br>[app/src/components/applyingquiet.test.tsx](../../../app/src/components/applyingquiet.test.tsx) |
