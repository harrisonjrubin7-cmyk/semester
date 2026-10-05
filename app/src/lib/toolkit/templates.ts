import { obj, textValue } from '../device-library';

/**
 * Assignment workflow templates, and the workspace a student fills in with
 * one.
 *
 * The brief's line is that a workspace turns an assignment into transparent
 * stages "not generate a final answer without student participation". The
 * participation is enforced here rather than hoped for: a stage cannot be
 * marked done until the student has written their own note for it. Ticking a
 * box is not doing the stage; saying what you did is at least the start of
 * it, and it is what the provenance panel and the reflection later read from.
 *
 * Each stage has a prompt addressed to the student — a question to answer,
 * not an instruction to the AI. Nothing in this file generates content.
 */

export interface Stage {
  id: string;
  label: string;
  prompt: string;
}

export interface Template {
  id: TemplateId;
  name: string;
  stages: readonly Stage[];
}

const s = (id: string, label: string, prompt: string): Stage => ({ id, label, prompt });

export const TEMPLATES = {
  problem_set: {
    name: 'Problem set',
    stages: [
      s('concepts', 'Concepts', 'Which concepts does this problem use? Where are they in your notes?'),
      s('example', 'Similar example', 'Find a worked example from class or the reading that is like this one.'),
      s('first-step', 'First step', 'What is the first step, and why that one?'),
      s('solution', 'Your solution', 'Work it through yourself. Note where you got stuck.'),
      s('check', 'Reasoning check', 'Does the answer make sense? Check units, sign and size.'),
      s('errors', 'Error log', 'What went wrong on the way, and what would catch it next time?'),
    ],
  },
  essay: {
    name: 'Essay',
    stages: [
      s('prompt', 'Prompt', 'What exactly is the prompt asking? Underline the verbs.'),
      s('claim', 'Claim', 'State your claim in one sentence someone could disagree with.'),
      s('evidence', 'Evidence plan', 'Which sources support it, and which complicate it?'),
      s('outline', 'Outline', 'One line per paragraph: its point and its evidence.'),
      s('draft', 'Draft', 'Write the draft. Keep your sources beside you.'),
      s('revision', 'Revision', 'What did you change after rereading, and why?'),
      s('checks', 'Citation, structure and accessibility check', 'Every quotation cited, every heading in order, every figure described.'),
    ],
  },
  lab_report: {
    name: 'Lab report',
    stages: [
      s('objective', 'Objective', 'What is this experiment trying to find out?'),
      s('hypothesis', 'Hypothesis', 'What do you expect, and why?'),
      s('variables', 'Variables', 'Independent, dependent and controlled variables, with units.'),
      s('methods', 'Methods', 'What was done, in enough detail to repeat it.'),
      s('raw', 'Raw data', 'Where is the untouched data kept?'),
      s('analysis', 'Analysis', 'What calculation or test, and why that one?'),
      s('figure', 'Figure', 'Axes labelled with units, a caption, and a text description.'),
      s('discussion', 'Discussion', 'What do the results mean for the hypothesis?'),
      s('limitations', 'Limitations', 'What could have gone wrong, and what can you not conclude?'),
    ],
  },
  research_paper: {
    name: 'Research paper',
    stages: [
      s('question', 'Question', 'What is your research question, and how narrow is it?'),
      s('search', 'Search strategy', 'Which databases, search terms and date range?'),
      s('screening', 'Screening', 'Which sources did you keep or exclude, and why?'),
      s('matrix', 'Evidence matrix', 'Fill in the matrix from the original sources.'),
      s('bibliography', 'Annotated bibliography', 'One annotation per source in your own words.'),
      s('outline', 'Outline', 'Your argument, section by section, with sources placed.'),
      s('draft', 'Draft', 'Write the draft from the outline.'),
      s('audit', 'Citation audit', 'Every claim traced to a verified source and page.'),
    ],
  },
  coding_project: {
    name: 'Coding project',
    stages: [
      s('requirements', 'Requirements', 'What must the program do? What is out of scope?'),
      s('architecture', 'Architecture', 'The main parts and how they talk to each other.'),
      s('tasks', 'Steps', 'A list small enough that each takes one sitting.'),
      s('implementation', 'Implementation', 'Build it. Note decisions you made.'),
      s('tests', 'Tests', 'What cases prove it works? Which fail?'),
      s('debug', 'Debugging log', 'Each bug: symptom, cause, fix.'),
      s('docs', 'Documentation', 'How to run it and what it does.'),
      s('demo', 'Demo', 'What will you show, in what order?'),
    ],
  },
  design_project: {
    name: 'Design project',
    stages: [
      s('brief', 'Brief', 'What problem, for whom?'),
      s('users', 'Users and constraints', 'Who uses it and what limits apply?'),
      s('research', 'Research', 'What did you learn from precedents or users?'),
      s('ideas', 'Ideas', 'At least three directions before choosing one.'),
      s('prototype', 'Prototype', 'The roughest version that tests the idea.'),
      s('critique', 'Critique', 'What did others say? What do you agree with?'),
      s('iteration', 'Iteration', 'What changed from the critique?'),
      s('presentation', 'Presentation', 'How will you show the process as well as the result?'),
    ],
  },
  case_analysis: {
    name: 'Case analysis',
    stages: [
      s('facts', 'Facts', 'What happened, without interpretation?'),
      s('stakeholders', 'Stakeholders', 'Who is affected and what does each want?'),
      s('framework', 'Framework', 'Which course framework fits, and why?'),
      s('assumptions', 'Assumptions', 'What are you assuming that the case does not say?'),
      s('alternatives', 'Alternatives', 'At least three options, with their costs.'),
      s('recommendation', 'Recommendation', 'Which option, and why over the others?'),
      s('limits', 'Evidence and limitations', 'What evidence supports it, and what would change your mind?'),
    ],
  },
  presentation: {
    name: 'Presentation',
    stages: [
      s('audience', 'Audience', 'Who is listening and what do they already know?'),
      s('thesis', 'Thesis', 'The one thing they should remember.'),
      s('outline', 'Outline', 'The order of points, each supporting the thesis.'),
      s('slides', 'Slides', 'One idea per slide; every image described.'),
      s('notes', 'Speaker notes', 'What you will say, not what the slide says.'),
      s('rehearsal', 'Rehearsal', 'Run it aloud. What was hard to say?'),
      s('timing', 'Timing', 'How long did it take against the limit?'),
      s('accessibility', 'Accessibility', 'Contrast, font size, captions for any video, alt text.'),
    ],
  },
  group_project: {
    name: 'Group project',
    stages: [
      s('scope', 'Scope', 'What is the group delivering?'),
      s('roles', 'Roles', 'Who owns which part?'),
      s('milestones', 'Milestones', 'Dates for each part to land.'),
      s('agenda', 'Meeting agenda', 'What each meeting must decide.'),
      s('contributions', 'Contribution log', 'What you did, in your own words.'),
      s('review', 'Review', 'Each part read by someone who did not write it.'),
      s('integration', 'Integration', 'Does it read as one piece?'),
    ],
  },
  exam_preparation: {
    name: 'Exam preparation',
    stages: [
      s('diagnostic', 'Diagnostic', 'Try a short set cold. Which topics felt shaky?'),
      s('weak', 'Weak topics', 'List them, from your own diagnostic — not a guess.'),
      s('practice', 'Targeted practice', 'Practice on those topics, mixed together.'),
      s('spaced', 'Spaced plan', 'Short sessions spread across the days you have.'),
      s('mock', 'Mock exam', 'Sit a timed practice paper.'),
      s('errors', 'Error analysis', 'For each mistake: slip, gap, or misread?'),
    ],
  },
  policy_memo: {
    name: 'Policy memo',
    stages: [
      s('problem', 'Problem', 'What is the problem, for whom, and how big?'),
      s('options', 'Options', 'Three realistic options including the status quo.'),
      s('criteria', 'Criteria', 'Cost, effectiveness, equity, feasibility — which matter here?'),
      s('tradeoffs', 'Tradeoffs', 'How does each option score on each criterion?'),
      s('recommendation', 'Recommendation', 'Which option, and what would it take to implement?'),
      s('evidence', 'Evidence and limits', 'What evidence supports it, and what is uncertain?'),
    ],
  },
  annotated_bibliography: {
    name: 'Annotated bibliography',
    stages: [
      s('question', 'Question', 'What are the sources for?'),
      s('find', 'Find sources', 'Search, and record where you searched.'),
      s('read', 'Read originals', 'Open each original — not a summary of it.'),
      s('annotate', 'Annotate', 'Summary, evaluation and relevance, in your words.'),
      s('format', 'Format', 'Citation style checked against the style guide.'),
    ],
  },
  technical_report: {
    name: 'Technical report',
    stages: [
      s('purpose', 'Purpose', 'Who will act on this report, and what do they need?'),
      s('method', 'Method', 'How the work was done.'),
      s('results', 'Results', 'What was found, with figures and uncertainty.'),
      s('interpretation', 'Interpretation', 'What it means, bounded by the method.'),
      s('recommendations', 'Recommendations', 'What should happen next.'),
      s('review', 'Review', 'Units, figures and references checked.'),
    ],
  },
  office_hours: {
    name: 'Office-hours preparation',
    stages: [
      s('topic', 'Topic', 'Which lecture, reading or problem is this about?'),
      s('tried', 'What you tried', 'What did you already try, step by step?'),
      s('stuck', 'Where it breaks', 'The exact point where you get lost.'),
      s('questions', 'Your questions', 'Two or three specific questions to ask.'),
    ],
  },
} satisfies Record<string, Omit<Template, 'id'>>;

export type TemplateId = keyof typeof TEMPLATES;

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

export const template = (id: TemplateId): Template => ({ id, ...TEMPLATES[id] });

/** A student's own note must be at least this long before a stage can be marked done. */
export const MIN_NOTE = 12;

export interface Workspace {
  id: string;
  template: TemplateId;
  title: string;
  courseCode: string;
  goal: string;
  /** The instructions, pasted by the student. */
  prompt: string;
  notes: Record<string, string>;
  done: string[];
  reflection: string;
  /** Private until the student chooses otherwise; there is no sharing path in this slice. */
  visibility: 'private';
  created: string;
}

export function newWorkspace(id: string, templateId: TemplateId, title: string, courseCode: string, now: Date): Workspace {
  return {
    id,
    template: templateId,
    title: title.trim() || TEMPLATES[templateId].name,
    courseCode,
    goal: '',
    prompt: '',
    notes: {},
    done: [],
    reflection: '',
    visibility: 'private',
    created: now.toISOString(),
  };
}

export type StageResult = { ok: true; workspace: Workspace } | { ok: false; reason: string };

export function completeStage(ws: Workspace, stageId: string): StageResult {
  const stage = TEMPLATES[ws.template].stages.find((x) => x.id === stageId);
  if (!stage) return { ok: false, reason: 'That stage is not part of this workspace.' };
  if ((ws.notes[stageId] ?? '').trim().length < MIN_NOTE)
    return { ok: false, reason: 'Write a short note on what you did for this stage first — in your own words.' };
  if (ws.done.includes(stageId)) return { ok: true, workspace: ws };
  return { ok: true, workspace: { ...ws, done: [...ws.done, stageId] } };
}

export const reopenStage = (ws: Workspace, stageId: string): Workspace => ({ ...ws, done: ws.done.filter((d) => d !== stageId) });

export function progress(ws: Workspace) {
  const stages = TEMPLATES[ws.template].stages;
  const done = stages.filter((x) => ws.done.includes(x.id)).length;
  return { done, total: stages.length, next: stages.find((x) => !ws.done.includes(x.id)) };
}

/**
 * The checks before a student submits, derived from the policy and the
 * work — not a list of boxes that are always the same.
 */
export function submissionChecklist(opts: { disclosureNeeded: boolean; hasRubric: boolean; hasSources: boolean }): string[] {
  return [
    'Every stage above has your own note.',
    ...(opts.hasRubric ? ['You went through the rubric self-check.'] : ['You found and read the rubric, or asked for it.']),
    ...(opts.hasSources ? ['Every claim traces to a source you opened yourself.'] : []),
    ...(opts.disclosureNeeded ? ['You wrote the AI-use declaration this course requires.'] : []),
    'Headings in order, figures described, links named.',
    'You submit it yourself, through the course’s own system.',
  ];
}

export function readWorkspaces(value: unknown): Workspace[] {
  if (!Array.isArray(value)) throw new Error('Assignment workspaces are not a list.');
  return value.map((w) => {
    if (!obj(w) || !textValue(w.id, 80) || !textValue(w.title, 300) || typeof w.template !== 'string' || !(w.template in TEMPLATES))
      throw new Error('An assignment workspace is malformed.');
    const notes: Record<string, string> = {};
    if (obj(w.notes)) for (const [k, v] of Object.entries(w.notes)) if (textValue(v, 20_000)) notes[k] = v;
    return {
      id: w.id,
      template: w.template as TemplateId,
      title: w.title,
      courseCode: textValue(w.courseCode, 40) ? w.courseCode : '',
      goal: textValue(w.goal, 2000) ? w.goal : '',
      prompt: textValue(w.prompt, 20_000) ? w.prompt : '',
      notes,
      done: Array.isArray(w.done) ? w.done.filter((d): d is string => textValue(d, 80)) : [],
      reflection: textValue(w.reflection, 20_000) ? w.reflection : '',
      visibility: 'private',
      created: textValue(w.created, 40) ? w.created : '',
    };
  });
}
