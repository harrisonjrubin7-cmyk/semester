import type { Screen } from './types';

export interface StudentWorkflow {
  id: string;
  name: string;
  outcome: string;
  steps: readonly { label: string; screen: Screen }[];
}

export const STUDENT_WORKFLOWS: readonly StudentWorkflow[] = [
  { id: 'registration-readiness', name: 'Registration Readiness', outcome: 'A checked plan, ranked backups, advisor questions, and an official handoff.', steps: [{ label: 'Review requirements', screen: 'degree' }, { label: 'Find courses', screen: 'search' }, { label: 'Check the schedule', screen: 'calendar' }, { label: 'Prepare registration', screen: 'yes' }] },
  { id: 'course-success', name: 'Course Success', outcome: 'Source-backed deadlines, a study plan, practice, reflection, and support.', steps: [{ label: 'Open the course', screen: 'courses' }, { label: 'Review sources', screen: 'sources' }, { label: 'Study', screen: 'study' }, { label: 'Get support', screen: 'support' }] },
  { id: 'advising-preparation', name: 'Advising Preparation', outcome: 'An agenda the student reviews, shares deliberately, and follows up.', steps: [{ label: 'Review the path', screen: 'degree' }, { label: 'Prepare questions', screen: 'meet' }, { label: 'Choose sharing', screen: 'privacy' }, { label: 'Track follow-up', screen: 'home' }] },
  { id: 'career-evidence', name: 'Career Evidence', outcome: 'A sourced artifact, student-confirmed skill claim, and chosen opportunity.', steps: [{ label: 'Choose work', screen: 'mine' }, { label: 'Confirm evidence', screen: 'proof' }, { label: 'Review career story', screen: 'career' }, { label: 'Find opportunities', screen: 'opportunities' }] },
  { id: 'support-routing', name: 'Support Routing', outcome: 'The right office, a safe handoff, and a visible follow-up.', steps: [{ label: 'Describe the need', screen: 'support' }, { label: 'Find the right office', screen: 'university' }, { label: 'Plan the appointment', screen: 'calendar' }, { label: 'Track follow-up', screen: 'home' }] },
  { id: 'term-transition', name: 'Term Transition', outcome: 'Work archived, the path updated, and the next term ready to plan.', steps: [{ label: 'Review the term', screen: 'brief' }, { label: 'Keep important work', screen: 'mine' }, { label: 'Update the path', screen: 'degree' }, { label: 'Plan the next term', screen: 'calendar' }] },
];

export function workflowForScreen(screen: Screen): StudentWorkflow | null {
  return STUDENT_WORKFLOWS.find((workflow) => workflow.steps.some((step) => step.screen === screen)) ?? null;
}

