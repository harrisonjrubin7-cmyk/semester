/**
 * Programmes worth knowing exist, months before they close.
 *
 * The Applications screen tracks what a student has already found. Finding
 * them is the harder half: almost every major fellowship is lost to not having
 * heard of it in time, and the ones with the longest lead — a recommendation
 * chain, a language requirement, a campus endorsement — are exactly the ones
 * nobody stumbles onto in October of their final year.
 *
 * ## What this list asserts, and what it refuses to
 *
 * It asserts that these programmes exist, roughly what they are for, roughly
 * who is eligible, and where the official page is. Those change slowly and a
 * wrong one is visible in a tap.
 *
 * It does **not** assert a deadline. Deadlines move every year, campus
 * endorsement deadlines are weeks earlier than national ones and differ by
 * university, and a confident wrong date is the one error here that costs
 * somebody a fellowship. So there is no date in this file — only the months
 * applications are usually open, marked as a rough guide, and the screen says
 * so. Tracking one creates an application with **no date**, and the first
 * thing it asks for is the real deadline off the official page.
 *
 * That is the whole design: this is a way to hear about something in time, not
 * a calendar. `lib/apply.ts` is the calendar, and it only ever holds dates the
 * student typed.
 *
 * ## Who it is weighted towards, and why that is stated
 *
 * National security, foreign affairs, economics and public policy — because
 * that is what the person this app was built for studies, and a list of
 * twenty generic scholarships would help nobody. The bias is written down
 * rather than hidden, and `fields` lets somebody filter it to their own.
 */

import type { ApplyKind } from '../lib/apply';

/** Which undergraduate years a programme is open to. */
export type Year = 'first' | 'second' | 'third' | 'fourth' | 'graduate';

export interface Programme {
  id: string;
  /** Who runs it. */
  org: string;
  /** What you would be applying for. */
  role: string;
  kind: ApplyKind;
  /** One line: what it is and what it is for. */
  what: string;
  /**
   * Months applications are usually open, zero-indexed.
   *
   * A rough guide and labelled as one everywhere it appears. Never turned
   * into a date, never put in a calendar.
   */
  months: number[];
  years: Year[];
  fields: string[];
  /** The official page. Never fetched by the app. */
  url: string;
}

export const YEARS: { id: Year; label: string }[] = [
  { id: 'first', label: 'First year' },
  { id: 'second', label: 'Second year' },
  { id: 'third', label: 'Third year' },
  { id: 'fourth', label: 'Final year' },
  { id: 'graduate', label: 'Graduate' },
];

/** The tags somebody filters by. Short, and none of them a whole discipline. */
export const FIELDS = [
  'national security',
  'foreign affairs',
  'economics',
  'public policy',
  'languages',
  'research',
  'study abroad',
  'government',
];

const AUTUMN = [8, 9, 10];
const WINTER = [0, 1];

export const PROGRAMMES: Programme[] = [
  {
    id: 'truman',
    org: 'Truman Scholarship Foundation',
    role: 'Truman Scholarship',
    kind: 'scholarship',
    what: 'Graduate funding for people going into public service. Needs a campus endorsement, so the university deadline is months before the national one.',
    months: AUTUMN,
    years: ['third'],
    fields: ['public policy', 'government'],
    url: 'https://www.truman.gov',
  },
  {
    id: 'boren',
    org: 'Institute of International Education',
    role: 'Boren Awards',
    kind: 'scholarship',
    what: 'Funds studying a less commonly taught language abroad, in return for a federal service commitment afterwards.',
    months: WINTER,
    years: ['first', 'second', 'third', 'fourth', 'graduate'],
    fields: ['languages', 'national security', 'study abroad'],
    url: 'https://www.borenawards.org',
  },
  {
    id: 'rhodes',
    org: 'Rhodes Trust',
    role: 'Rhodes Scholarship',
    kind: 'fellowship',
    what: 'Fully funded postgraduate study at Oxford. Campus endorsement required, and the reference chain is long.',
    months: AUTUMN,
    years: ['fourth', 'graduate'],
    fields: ['research', 'public policy'],
    url: 'https://www.rhodeshouse.ox.ac.uk',
  },
  {
    id: 'marshall',
    org: 'Marshall Aid Commemoration Commission',
    role: 'Marshall Scholarship',
    kind: 'fellowship',
    what: 'Postgraduate study anywhere in the UK. Endorsement required.',
    months: AUTUMN,
    years: ['fourth', 'graduate'],
    fields: ['research', 'public policy'],
    url: 'https://www.marshallscholarship.org',
  },
  {
    id: 'fulbright',
    org: 'US Department of State',
    role: 'Fulbright US Student Program',
    kind: 'fellowship',
    what: 'A year abroad on a research project or as an English teaching assistant. Campus deadlines run well ahead of the national one.',
    months: AUTUMN,
    years: ['fourth', 'graduate'],
    fields: ['research', 'foreign affairs', 'study abroad'],
    url: 'https://us.fulbrightonline.org',
  },
  {
    id: 'pickering',
    org: 'US Department of State',
    role: 'Pickering Fellowship',
    kind: 'fellowship',
    what: 'Funds a graduate degree and leads to a Foreign Service officer appointment, with a service commitment.',
    months: AUTUMN,
    years: ['third', 'fourth', 'graduate'],
    fields: ['foreign affairs', 'government', 'national security'],
    url: 'https://pickeringfellowship.org',
  },
  {
    id: 'rangel',
    org: 'Howard University and the US Department of State',
    role: 'Rangel International Affairs Fellowship',
    kind: 'fellowship',
    what: 'The other route into the Foreign Service: graduate funding plus internships, with a service commitment.',
    months: AUTUMN,
    years: ['third', 'fourth', 'graduate'],
    fields: ['foreign affairs', 'government'],
    url: 'https://rangelprogram.org',
  },
  {
    id: 'cls',
    org: 'US Department of State',
    role: 'Critical Language Scholarship',
    kind: 'program',
    what: 'A funded summer of intensive language study overseas, in languages the government is short of.',
    months: AUTUMN,
    years: ['first', 'second', 'third', 'fourth', 'graduate'],
    fields: ['languages', 'study abroad', 'national security'],
    url: 'https://clscholarship.org',
  },
  {
    id: 'gilman',
    org: 'US Department of State',
    role: 'Gilman Scholarship',
    kind: 'scholarship',
    what: 'Study abroad funding for Pell Grant recipients. Two cycles a year, so a missed one is not a missed year.',
    months: [2, 3, 8, 9],
    years: ['first', 'second', 'third', 'fourth'],
    fields: ['study abroad', 'languages'],
    url: 'https://www.gilmanscholarship.org',
  },
  {
    id: 'state-internship',
    org: 'US Department of State',
    role: 'Student Internship Program',
    kind: 'internship',
    what: 'Unpaid and paid placements in Washington and at posts abroad. Security clearance takes months, so the lead time is real.',
    months: AUTUMN,
    years: ['second', 'third', 'fourth', 'graduate'],
    fields: ['foreign affairs', 'government'],
    url: 'https://careers.state.gov/interns-fellows/',
  },
  {
    id: 'cia-internship',
    org: 'Central Intelligence Agency',
    role: 'Undergraduate internship',
    kind: 'internship',
    what: 'Applications open roughly a year ahead of the placement, because the clearance process is the slow part.',
    months: AUTUMN,
    years: ['first', 'second', 'third'],
    fields: ['national security', 'government'],
    url: 'https://www.cia.gov/careers/student-programs/',
  },
  {
    id: 'nsa-internship',
    org: 'National Security Agency',
    role: 'Student programmes',
    kind: 'internship',
    what: 'Summer placements across languages, analysis and mathematics. Same long clearance lead as the rest of the community.',
    months: AUTUMN,
    years: ['first', 'second', 'third', 'fourth'],
    fields: ['national security', 'languages', 'research'],
    url: 'https://www.nsa.gov/careers/students/',
  },
  {
    id: 'frb-ra',
    org: 'Federal Reserve Board',
    role: 'Research assistant',
    kind: 'job',
    what: 'Two years doing economics research before graduate school. The standard route for economics graduates who intend a PhD.',
    months: AUTUMN,
    years: ['fourth'],
    fields: ['economics', 'research'],
    url: 'https://www.federalreserve.gov/careers-research-assistants.htm',
  },
  {
    id: 'cbo',
    org: 'Congressional Budget Office',
    role: 'Internships and analyst posts',
    kind: 'internship',
    what: 'Non-partisan budget and economic analysis for Congress.',
    months: AUTUMN,
    years: ['third', 'fourth', 'graduate'],
    fields: ['economics', 'public policy', 'government'],
    url: 'https://www.cbo.gov/about/careers',
  },
  {
    id: 'nsf-grfp',
    org: 'National Science Foundation',
    role: 'Graduate Research Fellowship',
    kind: 'grad',
    what: 'Three years of funding for a research graduate degree, including in economics and the social sciences.',
    months: AUTUMN,
    years: ['fourth', 'graduate'],
    fields: ['research', 'economics'],
    url: 'https://www.nsfgrfp.org',
  },
  {
    id: 'pmf',
    org: 'US Office of Personnel Management',
    role: 'Presidential Management Fellows',
    kind: 'program',
    what: 'The main route into federal government for people finishing an advanced degree.',
    months: AUTUMN,
    years: ['graduate'],
    fields: ['government', 'public policy'],
    url: 'https://www.pmf.gov',
  },
  {
    id: 'schwarzman',
    org: 'Schwarzman Scholars',
    role: 'Schwarzman Scholars',
    kind: 'fellowship',
    what: 'A funded master’s year at Tsinghua in Beijing, aimed at people going into public affairs.',
    months: AUTUMN,
    years: ['fourth', 'graduate'],
    fields: ['foreign affairs', 'public policy', 'study abroad'],
    url: 'https://www.schwarzmanscholars.org',
  },
  {
    id: 'knight-hennessy',
    org: 'Stanford University',
    role: 'Knight-Hennessy Scholars',
    kind: 'grad',
    what: 'Funding for any graduate degree at Stanford, applied for alongside the degree itself.',
    months: AUTUMN,
    years: ['fourth', 'graduate'],
    fields: ['research', 'public policy'],
    url: 'https://knight-hennessy.stanford.edu',
  },
];
