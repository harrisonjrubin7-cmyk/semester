/**
 * Ask a human: ten plain needs, each pointing at a person.
 *
 * `help-routes.ts` owns the routes (nine needs, the offices they go to, what
 * may be sent) and `nowrongdoor.ts` owns the doors (who owns it, what Semester
 * can do first, what to bring). Neither is a list a student reads top to bottom
 * and picks from in their own words: "Housing/dining" and "Technology" are not
 * on the route list at all, and "Tutoring" is folded into course material. So
 * this is a thin layer of the ten labels a student would use, each mapped onto
 * a route that already exists, and nothing else.
 *
 * ## Reused, not rebuilt
 *
 * - The route, the office kind, directory-only status and the "what Semester
 *   can do first" lines come from `needById` and `door` unchanged. A need
 *   that is directory-only there (accessibility, money, wellbeing) is
 *   directory-only here, because the mapping reads it rather than restating it.
 * - Housing/dining, Technology and Something else have no office of their
 *   own in the route table. They use the campus-office route (`community`),
 *   which is the one place a request can go to "an office that will point you
 *   on" and which never stores anything sensitive. No office kind was invented.
 *
 * ## What each need carries
 *
 * Why this person, who to contact, what to bring, where the official answer
 * lives, and how to prepare for the appointment. The documents and the official
 * source are the only new words, and both are about the office, never about the
 * student: nothing here reads grades, records or behaviour, and no need is
 * suggested; the student picks one.
 *
 * ## Not emergency support
 *
 * `URGENT_SAFETY_TEXT` goes with the list, and with Personal support in
 * particular. Semester is a planning tool and an office directory. A student in
 * immediate danger needs a person now, and the first thing this screen says is
 * that it is not one.
 */

import { KIND_TEXT, needById, type DestinationKind, type NeedId } from './help-routes';
import { door } from './nowrongdoor';

export const URGENT_SAFETY_TEXT =
  'Semester is not emergency support. If you are in immediate danger or need urgent help, contact local emergency services or your institution’s emergency resource.';

export const ASK_NEED_IDS = [
  'academic_planning',
  'course_content',
  'tutoring',
  'career',
  'financial_information',
  'housing_dining',
  'accessibility_accommodations',
  'personal_support',
  'technology',
  'something_else',
] as const;
export type AskNeedId = (typeof ASK_NEED_IDS)[number];

export interface AskNeed {
  id: AskNeedId;
  label: string;
  /** The existing help route this uses. Never a new one. */
  route: NeedId;
  /** The office kind to go to first, from the route. Null only for wellbeing, which has no request kind by design. */
  kind: DestinationKind | null;
  /** Why this is the right person, in a sentence. */
  why: string;
  /** Who to contact, in the words the route already uses. */
  contact: string;
  /** What to bring, or have ready. About the office's needs, not the student's records. */
  documents: string[];
  /** Where the official answer lives. */
  officialSource: string;
  /** How to prepare for the appointment. */
  appointmentPrep: string[];
  /** True when Semester only points and stores and sends nothing. From the route. */
  directoryOnly: boolean;
  /** Shown with this need. Set for Personal support. */
  urgentText: string | null;
}

interface Spec {
  id: AskNeedId;
  label: string;
  route: NeedId;
  /** Overrides the route's first kind when the label is narrower than the route (tutoring within course help). */
  kind?: DestinationKind;
  why: string;
  contact?: string;
  documents: string[];
  officialSource: string;
  prep: string[];
}

const SPECS: Spec[] = [
  {
    id: 'academic_planning',
    label: 'Academic planning',
    route: 'registration',
    why: 'Your advisor knows the degree, and the registrar owns holds and deadlines. Semester’s requirement checks are estimates.',
    documents: ['Your plan or the courses you are weighing', 'The exact message you saw, if there was one', 'Your degree audit, if your school gives one'],
    officialSource: 'Your degree audit and the registrar’s published calendar.',
    prep: ['Write down the one decision you need made.', 'List the two or three options you are choosing between.'],
  },
  {
    id: 'course_content',
    label: 'Course content',
    route: 'course',
    kind: 'instructor',
    why: 'Your instructor and TAs wrote the course and are the ones who can say what it expects.',
    documents: ['The assignment or problem', 'What you tried so far', 'The syllabus section it comes from'],
    officialSource: 'The course syllabus and the course’s own site.',
    prep: ['Pick the one question you most want answered.', 'Bring your attempt, not just the problem.'],
  },
  {
    id: 'tutoring',
    label: 'Tutoring',
    route: 'course',
    kind: 'tutoring',
    why: 'A tutor can watch you work a problem and see where it goes wrong, which reading cannot do.',
    documents: ['The material or problems you are stuck on', 'What you already tried', 'Your availability'],
    officialSource: 'Your school’s tutoring center page, for hours and booking.',
    prep: ['Choose the topic, not the whole course.', 'Bring something you can work on while you are there.'],
  },
  {
    id: 'career',
    label: 'Career',
    route: 'career',
    why: 'A career coach can review an application or talk through options with employers’ expectations in mind.',
    documents: ['Your résumé or draft application', 'The posting or program you are considering', 'Any deadline'],
    officialSource: 'The career center’s page and each employer’s own posting.',
    prep: ['Say what you want out of the next year.', 'Bring one specific posting to look at together.'],
  },
  {
    id: 'financial_information',
    label: 'Financial information',
    route: 'money',
    why: 'Aid, bills and payment plans are decided by the financial-aid and bursar offices, not by an app.',
    documents: ['The bill or award letter you have a question about', 'Any deadline on it'],
    officialSource: 'Your school’s financial-aid and bursar pages, and your own award letter.',
    prep: ['Write the exact figure or line you do not understand.', 'Ask what happens if a deadline is missed.'],
  },
  {
    id: 'housing_dining',
    label: 'Housing and dining',
    route: 'community',
    why: 'Housing and dining are run by campus offices Semester does not hold a route for; the campus office will point you to the right one.',
    documents: ['Your housing or meal-plan agreement, if you have one', 'The dates that matter'],
    officialSource: 'The housing and dining pages on your school’s site.',
    prep: ['Say what you need changed or explained.', 'Have your student ID ready.'],
  },
  {
    id: 'accessibility_accommodations',
    label: 'Accessibility accommodations',
    route: 'accessibility',
    why: 'The accessibility office decides accommodations. Contact them directly; Semester does not send or store anything about this.',
    documents: ['Whatever documentation the office asks for', 'The courses where you need support'],
    officialSource: 'Your school’s accessibility office page.',
    prep: ['Ask what the office needs from you and how long it takes.', 'Note the courses and deadlines that are soonest.'],
  },
  {
    id: 'personal_support',
    label: 'Personal support',
    route: 'wellbeing',
    why: 'Your campus counseling service is the place to start. Semester does not send or store anything about this.',
    contact: 'Campus counseling service',
    documents: [],
    officialSource: 'Your school’s counseling service page.',
    prep: ['You do not have to prepare anything. You can just say you would like to talk to someone.'],
  },
  {
    id: 'technology',
    label: 'Technology',
    route: 'community',
    why: 'IT help desks fix accounts, devices and access. A campus office can point you to yours.',
    documents: ['What you were trying to do', 'The exact error message or a screenshot', 'The device and software involved'],
    officialSource: 'Your school’s IT help-desk page.',
    prep: ['Write the steps that lead to the problem.', 'Note when it started.'],
  },
  {
    id: 'something_else',
    label: 'Something else',
    route: 'community',
    why: 'If it does not fit, a campus office can tell you who owns it, which is better than guessing.',
    documents: ['A sentence on what you need'],
    officialSource: 'Your school’s main directory.',
    prep: ['Write what you need in your own words.', 'Ask: who owns this?'],
  },
];

const build = (spec: Spec): AskNeed => {
  const route = needById(spec.route);
  const d = door(spec.route);
  const kind = spec.kind ?? route.kinds[0] ?? null;
  return {
    id: spec.id,
    label: spec.label,
    route: spec.route,
    kind,
    why: spec.why,
    contact: spec.contact ?? (kind ? KIND_TEXT[kind] : d.owner),
    documents: spec.documents,
    officialSource: spec.officialSource,
    // The route's own "what to bring" steps first, then this need's.
    appointmentPrep: [...d.next.filter((s) => !s.screen).map((s) => s.label), ...spec.prep],
    directoryOnly: d.handoff === 'directory',
    urgentText: spec.route === 'wellbeing' ? URGENT_SAFETY_TEXT : null,
  };
};

/** The ten needs, in the order a student reads them. The same list every time, whoever is asking. */
export const needs = (): AskNeed[] => SPECS.map(build);

export const askNeedById = (id: AskNeedId): AskNeed => {
  const found = needs().find((n) => n.id === id);
  if (!found) throw new Error(`unknown need ${id}`);
  return found;
};
