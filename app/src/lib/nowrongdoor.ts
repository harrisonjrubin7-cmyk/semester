import { DIRECTORY_ONLY, KIND_TEXT, NEEDS, needById, type Need, type NeedId } from './help-routes';
import type { Screen } from './types';

/**
 * No wrong door: describe the problem in your own words, and be told who owns
 * it, what Semester can do first, and what to take to them.
 *
 * `help-routes.ts` is the route to a person once the student has picked a
 * need from a list of nine. The list is the problem: "I do not understand why
 * I cannot register" is not on it, and a student who does not know that a
 * registration hold is the registrar's, not the advisor's, cannot pick. So
 * this reads the sentence they would say to a friend and answers the four
 * things the brief asks for — what Semester can clarify, who the official or
 * support owner is, a concise summary to take with them, and the safe next
 * actions — and then hands over to the same route as before, or to the
 * directory for the needs that are directory-only.
 *
 * ## What it never does
 *
 * It never decides. `NEVER` is printed with every door, because a router that
 * sounds authoritative is the failure the brief names: it does not make
 * clinical, legal, aid, disciplinary or official academic decisions, and it
 * does not pretend to know the answer to "why can't I register" — it knows
 * whose question that is.
 *
 * It never reads anything but the sentence. No grades, no risk, no behaviour
 * goes into the match (`help-routes.ts` has the same rule for referrals), and
 * the summary is built from the sentence alone, so what leaves is what was
 * typed and nothing the app added about the student.
 *
 * ## Matching
 *
 * Phrases, in order, first match wins. Wellbeing is matched first: a sentence
 * that says "I can't cope with my schedule" is about coping before it is about
 * the schedule, and sending it to the registrar would be the wrong door with
 * the highest cost. Nothing matched is a door of its own — every need, listed
 * — rather than a guess.
 */

export const NEVER =
  'Semester never makes clinical, legal, financial-aid, disciplinary or official academic decisions. It gets you ready for the person who does.';

/** A safe next step: something in the app, or something to bring. */
export interface Step {
  label: string;
  /** The screen it opens, when it is one. */
  screen?: Screen;
}

export interface Door {
  need: Need;
  /** The person or office that owns it, in the words the help route uses. */
  owner: string;
  /** What Semester can do before the person is involved. */
  can: string[];
  /** Safe next actions, in the app or on paper. */
  next: Step[];
  /** `request` sends through the help route; `directory` only points. */
  handoff: 'request' | 'directory';
}

interface Rule {
  need: NeedId;
  patterns: RegExp[];
}

/*
 * The brief's own six sentences are the first test of these: cannot register,
 * help with a paper, worried about my schedule, an accommodation, paying for
 * school, study abroad. Wellbeing first, for the reason in the header.
 */
const RULES: Rule[] = [
  { need: 'wellbeing', patterns: [/\b(kill(ing)? myself|suicid|end (it all|my life|everything)|want to die|wish i (was|were) dead|don[’']?t want to (live|be here|be alive|wake up)|no reason to live|self.?harm|hurt(ing)? myself|cut(ting)? myself|overdose)/i, /\b(anxious|anxiety|depress|panic|overwhelm|can[’']?t cope|cannot cope|lonely|hopeless|crisis|counsel|therap|mental health|stress(ed)? out|burn(ed|t)? out)/i] },
  { need: 'accessibility', patterns: [/\b(accommodat|disabilit|accessib|screen reader|extended time|extra time|note.?taker|adhd|dyslex|captions?\b)/i] },
  { need: 'money', patterns: [/\b(pay(ing)? for|afford|tuition|financial aid|fafsa|scholarship|loan\b|loans\b|bursar|bill\b|bills\b|balance due|refund|work.?study|cost of)/i] },
  { need: 'registration', patterns: [/\b(regist(er|ration)|enrol+|hold on my|waitlist|add.?drop|withdraw|degree audit|requirement|prerequisite|prereq|credits? (count|transfer)|transfer|study abroad|abroad|change (my )?major|declare|minor\b|schedule|graduat)/i] },
  { need: 'writing', patterns: [/\b(paper\b|papers\b|essay|thesis|dissertation|draft|writing|write\b|citation|cite\b|bibliograph|proofread)/i] },
  { need: 'research', patterns: [/\b(source\b|sources\b|research|database|journal|article|library|librarian|peer.?review)/i] },
  { need: 'career', patterns: [/\b(internship|job\b|jobs\b|career|resume|résumé|cv\b|interview|cover letter|linkedin|employer|grad school|graduate school)/i] },
  { need: 'course', patterns: [/\b(homework|problem set|pset|assignment|lecture|exam\b|exams\b|midterm|final\b|finals\b|quiz|understand|confus|stuck|lab\b|labs\b|tutor|office hours|grade on|failing|behind in)/i] },
  { need: 'community', patterns: [/\b(club\b|clubs\b|group\b|groups\b|friends?\b|people\b|mentor|community|belong|event\b|events\b|organi[sz]ation|team\b|teams\b)/i] },
];

/** The need a sentence is about, or null when nothing in it says. */
export function match(problem: string): NeedId | null {
  const text = problem.trim();
  if (!text) return null;
  for (const rule of RULES) if (rule.patterns.some((re) => re.test(text))) return rule.need;
  return null;
}

/** What Semester can do first, per need. Things the app already does, never a promise. */
const CAN: Record<NeedId, string[]> = {
  course: ['Show the course’s own deadlines, weights and material in one place.', 'Build practice from the course’s material, with the source of each item.', 'Draft the question to bring, with what you already tried.'],
  writing: ['Hold the assignment’s brief and deadline beside your draft.', 'Keep your sources and citations with the piece.', 'Draft the question to bring to the writing center.'],
  research: ['Keep the sources you have found, labelled by where each came from.', 'Show which sources a study guide or answer rested on.', 'Draft the question to bring to a librarian.'],
  registration: ['Check your plan for time conflicts and pick backups.', 'Show the term’s official dates and how ready your plan is for them.', 'Show what your recorded requirements say is left — an estimate, never the audit.'],
  career: ['Keep applications and their deadlines next to your term.', 'Collect evidence of skills from coursework and projects.', 'Draft the question to bring to a career coach.'],
  community: ['Show campus events and groups your school publishes.', 'Keep the commitments you already have on the calendar.'],
  accessibility: ['Set text size, spacing, typeface, contrast and motion for yourself, on every screen.', 'Point you to your school’s accessibility office, without storing anything about why.'],
  money: ['Show your term’s costs and dates as you entered them.', 'Point you to the financial-aid office, without storing anything about why.'],
  wellbeing: ['Point you to your campus counseling service and the 988 line, and store nothing.'],
};

/** Safe next steps, per need. Every screen named here exists; the test holds it. */
const NEXT: Record<NeedId, Step[]> = {
  course: [{ label: 'Open the course', screen: 'courses' }, { label: 'Practise from the guide', screen: 'study' }, { label: 'Bring what you tried' }],
  writing: [{ label: 'Open your draft', screen: 'write' }, { label: 'Bring the assignment brief and your draft, at any stage' }],
  research: [{ label: 'Open your sources', screen: 'study' }, { label: 'Bring the assignment and the sources you have so far' }],
  registration: [{ label: 'Check the plan and the dates', screen: 'registrar' }, { label: 'See what is left on your path', screen: 'pathway' }, { label: 'Bring your plan and the exact message you saw' }],
  career: [{ label: 'Open career planning', screen: 'career' }, { label: 'Bring the posting and your draft application' }],
  community: [{ label: 'Open campus', screen: 'university' }, { label: 'Ask the student-life office what exists for you' }],
  accessibility: [{ label: 'Set how the app looks and moves', screen: 'setLook' }, { label: 'Contact the accessibility office directly' }],
  money: [{ label: 'See your term’s costs', screen: 'costs' }, { label: 'Contact the financial-aid office directly' }],
  wellbeing: [{ label: 'Contact campus counseling, or call or text 988' }],
};

/** The door for a need. */
export function door(need: NeedId): Door {
  const n = needById(need);
  const first = n.kinds[0];
  return {
    need: n,
    owner: first ? KIND_TEXT[first] : 'Campus counseling service',
    can: CAN[need],
    next: NEXT[need],
    handoff: n.directoryOnly || (first !== undefined && DIRECTORY_ONLY.has(first)) ? 'directory' : 'request',
  };
}

/** The door a sentence opens, or null when it should be shown every door. */
export function route(problem: string): Door | null {
  const need = match(problem);
  return need ? door(need) : null;
}

/** Every door, for the sentence nothing matched. */
export const allDoors = (): Door[] => NEEDS.map((n) => door(n.id));

/**
 * The summary the student takes to the person: their words, the owner, and
 * what to bring. Built from the sentence and the door only; nothing about the
 * student is added.
 */
export function summary(problem: string, d: Door): string {
  const lines = ['What I need help with', problem.trim() || '(not written yet)', '', `Who Semester thinks this belongs to: ${d.owner}`, '', 'What to bring'];
  lines.push(...d.next.filter((s) => !s.screen).map((s) => `- ${s.label}`));
  lines.push('', NEVER);
  return lines.join('\n');
}
