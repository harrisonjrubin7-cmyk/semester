/**
 * What a preparation draft starts as, for each of the thirty-seven areas.
 *
 * A draft is the thing this app can honestly offer for a university service
 * it cannot reach: the questions worth having written down before an advising
 * appointment, the checklist worth working through before a form is filed
 * somewhere else. So each template is a title, a body with the two headings
 * that matter, and the steps that make the difference between arriving
 * prepared and arriving.
 *
 * Every one of them is preparation. None is a submission, and the wording is
 * kept that way deliberately — "Review before official submission", not
 * "Submit". `screens/University.tsx` says so again on screen; this file must
 * not quietly contradict it.
 *
 * In the same order as `UNIVERSITY_AREAS` in `@semester/institution`, so the
 * two files read down together and a missing area is visible rather than
 * inferred. The `Record<UniversityArea, ...>` type is what actually enforces
 * that: an area added to the contract without a template here is a type
 * error, not a screen with a blank draft on it.
 */

import type { UniversityArea } from '@semester/institution';

export interface DraftTemplate {
  title: string;
  /** Two headings, blank line between. What to fill in before the meeting. */
  body: string;
  /** The readiness checklist. Preparation steps, never official completion. */
  steps: string[];
}

export const DRAFT_TEMPLATES: Record<UniversityArea, DraftTemplate> = {
  // Coursework, and what a school does with it.
  courses: {
    title: "Course preparation",
    body: "Course outcomes\n\nWeekly modules\n\nGrading and course policies",
    steps: [
      "Review syllabus",
      "Check class dates",
      "Prepare learning materials",
    ],
  },
  assignments: {
    title: "Assignment submission draft",
    body: "Assignment instructions\n\nMy response\n\nSources and supporting files",
    steps: [
      "Review instructions and rubric",
      "Complete work",
      "Check cited sources",
      "Review files before official submission",
    ],
  },
  assessments: {
    title: "Assessment preparation",
    body: "Instructions\n\nQuestion 1\n\nAnswer key and rubric (authoring only)",
    steps: [
      "Set assessment scope",
      "Review questions",
      "Check accommodations and course policy",
    ],
  },
  grades: {
    title: "Grade review",
    body: "Course and assessment\n\nRecorded score\n\nFeedback to review\n\nQuestions for the instructor",
    steps: [
      "Check original feedback",
      "Review grading criteria",
    ],
  },
  email: {
    title: "University email draft",
    body: "Recipient\n\nSubject\n\nMessage",
    steps: [
      "Check recipients",
      "Review content and attachments",
    ],
  },
  registration: {
    title: "Registration preparation",
    body: "Term\n\nPreferred classes\n\nAlternative sections",
    steps: [
      "Review degree requirements",
      "Check prerequisites and holds",
      "Check schedule conflicts",
      "Review registration window",
    ],
  },
  advising: {
    title: "Advising appointment plan",
    body: "Advisor\n\nPreferred dates and times\n\nQuestions\n\nDegree and course decisions",
    steps: [
      "Review degree progress",
      "Prepare questions",
      "Confirm availability through the advising system",
    ],
  },

  // Money.
  billing: {
    title: "University bill review",
    body: "Statement period\n\nCharges to clarify\n\nPayment plan questions",
    steps: [
      "Check official balance",
      "Review posted aid",
      "Confirm due dates",
    ],
  },
  aid: {
    title: "Financial aid checklist",
    body: "Award or application\n\nRequired documents\n\nQuestions for financial aid office",
    steps: [
      "Review award terms",
      "Check outstanding requirements",
      "Confirm submission deadline",
    ],
  },

  // Being on a campus.
  dining: {
    title: "Dining request",
    body: "Meal plan or dining location\n\nRequest details",
    steps: [
      "Compare meal plan options",
      "Check change deadline",
    ],
  },
  housing: {
    title: "Housing request",
    body: "Residence or application\n\nPreferences\n\nRequest details",
    steps: [
      "Review eligibility and costs",
      "Check application window",
    ],
  },
  mailroom: {
    title: "Campus mail request",
    body: "Mail center\n\nRequest details",
    steps: [
      "Check pickup location and hours",
      "Bring required identification",
    ],
  },
  transport: {
    title: "Transportation plan",
    body: "Destination\n\nDate and time\n\nTransport or parking request",
    steps: [
      "Review route",
      "Check official schedule",
    ],
  },
  library: {
    title: "Library request",
    body: "Resource, room or research topic\n\nRequest details",
    steps: [
      "Check catalog or room availability",
      "Review borrowing rules",
    ],
  },
  athletics: {
    title: "Athletics service request",
    body: "Team and event\n\nRequest details\n\nAcademic arrangements to discuss",
    steps: [
      "Check team schedule",
      "Confirm authorized staff contact",
      "Review official requirements",
    ],
  },
  recreation: {
    title: "Recreation request",
    body: "Activity or facility\n\nPreferred date and time",
    steps: [
      "Check facility availability",
      "Review participation requirements",
    ],
  },
  clubs: {
    title: "Club administration request",
    body: "Organization\n\nEvent, membership or funding request",
    steps: [
      "Confirm officer permissions",
      "Review institutional approval process",
    ],
  },

  // Before and after the degree.
  career: {
    title: "Career service request",
    body: "Appointment, employer or opportunity\n\nMaterials and questions",
    steps: [
      "Review official listing",
      "Prepare verified experience and materials",
    ],
  },
  alumni: {
    title: "Mentorship request",
    body: "Mentoring goal\n\nRequested availability\n\nQuestions",
    steps: [
      "Check opt-in availability",
      "Review communication preferences",
    ],
  },
  abroad: {
    title: "Study abroad request",
    body: "Program and term\n\nAcademic and preparation questions",
    steps: [
      "Confirm credit approval",
      "Review official program requirements",
    ],
  },
  forms: {
    title: "Form publication plan",
    body: "Purpose and questions\n\nIntended audience\n\nRetention and consent",
    steps: [
      "Review response permissions",
      "Check data minimization and retention",
      "Test before publishing",
    ],
  },
  records: {
    title: "Student records & transcripts preparation",
    body: "Record or verification requested\n\nQuestions and supporting information",
    steps: [
      "Confirm identity and recipient",
      "Review official record requirements",
      "Track institution-issued receipt",
    ],
  },
  admissions: {
    title: "Admissions preparation",
    body: "Institution, program and application\n\nQuestions and supporting information",
    steps: [
      "Review program requirements",
      "Prepare application materials",
      "Review before official submission",
    ],
  },
  orientation: {
    title: "Welcome & orientation preparation",
    body: "Enrollment and arrival arrangements\n\nQuestions and supporting information",
    steps: [
      "Review enrollment conditions",
      "Confirm required forms",
      "Prepare move-in and orientation",
    ],
  },
  graduate: {
    title: "Graduate & professional education preparation",
    body: "Program and milestone\n\nQuestions and supporting information",
    steps: [
      "Review degree milestones",
      "Confirm advisor or committee requirements",
      "Prepare supporting materials",
    ],
  },
  research: {
    title: "Research & ethics preparation",
    body: "Research project and requested review\n\nQuestions and supporting information",
    steps: [
      "Confirm authorized research owner",
      "Review data and ethics requirements",
      "Wait for official approval before restricted work",
    ],
  },
  international: {
    title: "International student services preparation",
    body: "Service and relevant deadline\n\nQuestions and supporting information",
    steps: [
      "Review official instructions",
      "Prepare advisor questions",
      "Use approved services for sensitive documents",
    ],
  },
  accessibility: {
    title: "Accessibility services preparation",
    body: "Administrative service requested\n\nQuestions and supporting information",
    steps: [
      "Find approved service contact",
      "Review required process",
      "Keep private records in the authorized service",
    ],
  },
  appeals: {
    title: "Feedback & appeals preparation",
    body: "Decision or issue to review\n\nQuestions and supporting information",
    steps: [
      "Gather original record and supporting facts",
      "Confirm appeal deadline",
      "Identify authorized review office",
    ],
  },
  directory: {
    title: "University directory preparation",
    body: "Office or service needed\n\nQuestions and supporting information",
    steps: [
      "Check institution and directory permissions",
      "Confirm official contact details",
    ],
  },
  graduation: {
    title: "Graduation & credentials preparation",
    body: "Degree, term and requested credential\n\nQuestions and supporting information",
    steps: [
      "Review degree and account clearance",
      "Confirm ceremony and diploma details",
      "Plan exports and alumni access",
    ],
  },
  family: {
    title: "Authorized family access preparation",
    body: "Family recipient and selected resources\n\nQuestions and supporting information",
    steps: [
      "Verify student authorization and recipient identity",
      "Confirm exact resource scope and expiry",
      "Test revocation and separate accounts",
    ],
  },
  support: {
    title: "Help & service status preparation",
    body: "Issue, impact and steps already tried\n\nQuestions and supporting information",
    steps: [
      "Record service and time of issue",
      "Avoid passwords and private content",
      "Review official support channel",
    ],
  },

  // The four a student hopes not to need.
  health: {
    title: "Health appointment plan",
    body: "Appointment type\n\nPreferred time\n\nContact information for the service",
    steps: [
      "Check appointment availability",
      "Review preparation instructions",
    ],
  },
  safety: {
    title: "Campus safety follow-up",
    body: "Office to contact\n\nFollow-up topic",
    steps: [
      "Find official campus contact",
      "Use immediate assistance for urgent situations",
    ],
  },
  identity: {
    title: "Student ID request",
    body: "ID service needed\n\nOffice or pickup location",
    steps: [
      "Check required identification",
      "Review replacement or activation process",
    ],
  },
  admin: {
    title: "Institution launch plan",
    body: "Institution and term\n\nApproved system owners\n\nCourse catalog source\n\nAccess roles\n\nPilot scope",
    steps: [
      "Obtain institutional approval",
      "Configure identity and access",
      "Connect approved systems",
      "Test record reconciliation",
      "Run an accessibility and security review",
    ],
  },
};
