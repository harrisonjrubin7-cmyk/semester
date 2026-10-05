import { SUBJECTS, subjectOf, type Subject } from './catalog';
import type { TemplateId } from './templates';

/**
 * Which workspaces to put in front of a student, and why — from what they
 * told us and nothing else.
 *
 * The brief draws the line in two lists. Allowed: the course, the assignment
 * type, the topic, the goal the student picked, the source type, a due date,
 * and their own preferences. Never: grades, GPA, risk scores, disability,
 * health, financial aid, private messages, GPS, popularity, inferred identity
 * or wellbeing, behavioural profiling.
 *
 * The type below enforces the first list at compile time. `explicitOnly`
 * enforces it again at run time, because the object that reaches this module
 * is often built from a store that holds grades too — and a spread of the
 * wrong object would compile. The test for this passes a GPA, a risk score
 * and a location through and checks the output is identical without them.
 *
 * The result is finite (four at most) and every item carries its reasons in
 * words, which is what "Why this workspace?" shows. There is no score to
 * show: the ordering is the goal's own list, in the order written below, with
 * the subject's tool slotted in second. A ranking you can read is one you can
 * argue with.
 */

export const GOALS = [
  ['exam', 'Study for an exam'],
  ['assignment', 'Complete an assignment'],
  ['data', 'Analyze data'],
  ['paper', 'Write a paper'],
  ['code', 'Build or code'],
  ['lab', 'Run a lab'],
  ['research', 'Do research'],
  ['present', 'Create a presentation'],
  ['office-hours', 'Prepare for office hours'],
] as const;

export type Goal = (typeof GOALS)[number][0];

export interface Context {
  goal: Goal;
  /** The selected course's code, e.g. "PSCI 1104"; empty for an independent project. */
  courseCode: string;
  /** A subject the student picked themselves, used when the code has none. */
  subjectId?: string;
  assignment?: TemplateId;
  /** Days until the selected piece of work is due, when there is one. */
  dueInDays?: number;
  /** Workspaces the student hid. */
  hidden: readonly string[];
  /** The student asked for fewer suggestions. */
  showLess: boolean;
}

const ALLOWED: readonly (keyof Context)[] = ['goal', 'courseCode', 'subjectId', 'assignment', 'dueInDays', 'hidden', 'showLess'];

/** Drop every key that is not one of the explicit inputs, whatever else was passed. */
export function explicitOnly(input: Context): Context {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED) if (key in input) out[key] = (input as unknown as Record<string, unknown>)[key];
  return out as unknown as Context;
}

export interface Workspace {
  id: string;
  name: string;
  opens: 'research' | 'data' | 'assignment' | 'policy' | 'disclosure' | 'rubric' | 'screen';
  screen?: string;
  template?: TemplateId;
}

const W = {
  research: { id: 'research', name: 'Research Evidence Matrix', opens: 'research' },
  data: { id: 'data', name: 'Data Studio', opens: 'data' },
  writing: { id: 'writing', name: 'Writing Studio', opens: 'screen', screen: 'write' },
  proof: { id: 'proof', name: 'Check the writing', opens: 'screen', screen: 'proof' },
  review: { id: 'review', name: 'Exam review — study guide', opens: 'screen', screen: 'study' },
  paper: { id: 'practice', name: 'Practice paper', opens: 'screen', screen: 'exam' },
  deck: { id: 'deck', name: 'Slide builder', opens: 'screen', screen: 'deck' },
  rubric: { id: 'rubric', name: 'Rubric self-check', opens: 'rubric' },
  policy: { id: 'policy', name: 'AI-use policy for this course', opens: 'policy' },
  draw: { id: 'draw', name: 'Diagram builder', opens: 'screen', screen: 'draw' },
} satisfies Record<string, Workspace>;

const plan = (template: TemplateId, name: string): Workspace => ({ id: `plan-${template}`, name, opens: 'assignment', template });

const BY_GOAL: Record<Goal, { list: Workspace[]; why: string }> = {
  exam: { list: [plan('exam_preparation', 'Exam preparation plan'), W.review, W.paper], why: 'you are studying for an exam' },
  assignment: { list: [W.rubric, W.policy], why: 'you are completing an assignment' },
  data: { list: [W.data, plan('lab_report', 'Lab report workspace'), W.writing], why: 'you are analyzing data' },
  paper: { list: [plan('research_paper', 'Research paper workspace'), W.research, W.proof], why: 'you are writing a paper' },
  code: { list: [plan('coding_project', 'Coding project workspace'), W.draw], why: 'you are building or coding' },
  lab: { list: [plan('lab_report', 'Lab report workspace'), W.data], why: 'you are running a lab' },
  research: { list: [W.research, plan('annotated_bibliography', 'Annotated bibliography'), W.writing], why: 'you are doing research' },
  present: { list: [plan('presentation', 'Presentation workspace'), W.deck], why: 'you are creating a presentation' },
  'office-hours': { list: [plan('office_hours', 'Office-hours question builder'), W.review], why: 'you are preparing for office hours' },
};

export interface Recommendation {
  workspace: Workspace;
  why: string[];
}

export function subjectFor(ctx: Pick<Context, 'courseCode' | 'subjectId'>): Subject | undefined {
  return subjectOf(ctx.courseCode) ?? SUBJECTS.find((s) => s.id === ctx.subjectId);
}

export function recommend(input: Context): Recommendation[] {
  const ctx = explicitOnly(input);
  const goal = BY_GOAL[ctx.goal];
  const subject = subjectFor(ctx);
  const out: Recommendation[] = [];
  const add = (workspace: Workspace, why: string[]) => {
    if (ctx.hidden.includes(workspace.id) || out.some((r) => r.workspace.id === workspace.id)) return;
    out.push({ workspace, why });
  };

  // The assignment the student chose outranks the goal's generic plan.
  if (ctx.assignment) add(plan(ctx.assignment, 'Workspace for this assignment'), ['You selected this assignment type.']);

  const [first, ...rest] = goal.list;
  add(first, [`You chose “${labelOf(ctx.goal)}”.`]);

  if (subject) {
    const native = subject.tools.find((tool) => tool.state === 'native' || tool.state === 'guided');
    if (native) {
      const from = subjectOf(ctx.courseCode) ? `${ctx.courseCode.trim()} is ${subject.name}` : `You picked ${subject.name}`;
      add(
        {
          id: `subject-${native.id}`,
          name: native.name,
          opens: native.screen ? 'screen' : (native.opens ?? 'assignment'),
          screen: native.screen,
        },
        [`${from}, which uses this tool.`],
      );
    }
  }
  for (const w of rest) add(w, [`Part of the usual workflow when ${goal.why}.`]);

  if (ctx.dueInDays !== undefined && ctx.dueInDays >= 0 && ctx.dueInDays <= 7 && out[0])
    out[0].why.push(`Due in ${ctx.dueInDays} day${ctx.dueInDays === 1 ? '' : 's'} — this breaks it into finite stages.`);

  return out.slice(0, ctx.showLess ? 2 : 4);
}

export const labelOf = (goal: Goal) => GOALS.find(([g]) => g === goal)?.[1] ?? goal;
