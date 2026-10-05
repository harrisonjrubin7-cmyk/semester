import { CAMPUS_LINKS } from '../data/campus';

/**
 * The offices a student is sent to, named once.
 *
 * Launchpad, Support, Opportunities and the notices hub all end the same way:
 * "this is the office that decides, and here is the door". Four screens each
 * carrying their own idea of what the registrar is called and where it lives is
 * how one of them ends up linking a page the university moved last spring.
 *
 * ## An office with no address says so
 *
 * `link` names a row in `data/campus.ts`, and only where one exists. Most
 * offices here have none: this app ships with the addresses a Vanderbilt
 * student gave it, and a study-abroad office URL typed from memory is exactly
 * the confident wrong link `data/campus.ts` refuses to carry. `officeUrl`
 * returns `''` for those and the screens say "find it on your school's site"
 * rather than guessing — and the student's own edit to a campus link, kept in
 * `linkUrls`, wins over the shipped default every time.
 */

export type OfficeId =
  | 'admissions'
  | 'registrar'
  | 'financialaid'
  | 'bursar'
  | 'housing'
  | 'dining'
  | 'orientation'
  | 'advising'
  | 'health'
  | 'counseling'
  | 'care'
  | 'access'
  | 'safety'
  | 'international'
  | 'abroad'
  | 'research'
  | 'irb'
  | 'career'
  | 'employment'
  | 'library'
  | 'it'
  | 'transit'
  | 'facilities'
  | 'recreation'
  | 'involvement'
  | 'government'
  | 'sustainability'
  | 'alumni'
  | 'continuing'
  | 'basicneeds'
  | 'deanofstudents';

export interface Office {
  id: OfficeId;
  name: string;
  /** What this office decides — the reason the student is sent there. */
  decides: string;
  /** A row in `CAMPUS_LINKS`, where the app already carries the address. */
  link?: string;
}

export const OFFICES: Record<OfficeId, Office> = {
  admissions: { id: 'admissions', name: 'Admissions', decides: 'Your offer, enrollment deposit and deadlines to confirm.' },
  registrar: { id: 'registrar', name: 'Registrar', decides: 'Enrollment, records, the academic calendar and registration holds.', link: 'registrar' },
  financialaid: { id: 'financialaid', name: 'Financial aid', decides: 'Aid offers, work-study eligibility, verification and institutional grants.', link: 'financialaid' },
  bursar: { id: 'bursar', name: 'Student accounts', decides: 'Your bill, payment plans and refunds.' },
  housing: { id: 'housing', name: 'Housing', decides: 'Room assignments, housing deadlines and move-in and move-out.', link: 'starrez' },
  dining: { id: 'dining', name: 'Dining', decides: 'Meal plans and dining hours.', link: 'dining' },
  orientation: { id: 'orientation', name: 'Orientation', decides: 'Orientation sessions and first-year programs.' },
  advising: { id: 'advising', name: 'Academic advising', decides: 'Your first-term schedule, placement and degree plan.' },
  health: { id: 'health', name: 'Student health', decides: 'Immunization requirements, insurance waivers and medical care.' },
  counseling: { id: 'counseling', name: 'Counseling', decides: 'Confidential counseling, and what confidential means there.' },
  care: { id: 'care', name: 'Student care network', decides: 'Where to start when you are not sure which office you need.', link: 'student-care' },
  access: { id: 'access', name: 'Student access services', decides: 'Accommodations, what documentation they need, and exam logistics.', link: 'access' },
  safety: { id: 'safety', name: 'Public safety', decides: 'Emergency response, campus alerts and safety escorts.', link: 'publicsafety' },
  international: { id: 'international', name: 'International student services', decides: 'Visa and immigration advising for your own situation.' },
  abroad: { id: 'abroad', name: 'Global education', decides: 'Study-abroad programs, approvals and credit transfer.' },
  research: { id: 'research', name: 'Undergraduate research', decides: 'Research programs, funding and lab placement.' },
  irb: { id: 'irb', name: 'Research compliance (IRB)', decides: 'Whether your study needs review, and what it must include.' },
  career: { id: 'career', name: 'Career center', decides: 'Internships, experiential credit and employer programs.', link: 'career' },
  employment: { id: 'employment', name: 'Student employment', decides: 'Hiring paperwork, payroll, tax forms and job training.' },
  library: { id: 'library', name: 'Library', decides: 'Study rooms, research help and equipment loans.', link: 'library' },
  it: { id: 'it', name: 'IT', decides: 'Accounts, sign-in, software and printing.', link: 'vuit' },
  transit: { id: 'transit', name: 'Parking and transportation', decides: 'Parking permits, shuttles and transit passes.' },
  facilities: { id: 'facilities', name: 'Facilities', decides: 'Building hours, access routes and room bookings.' },
  recreation: { id: 'recreation', name: 'Recreation', decides: 'Recreation hours, programs and equipment.' },
  involvement: { id: 'involvement', name: 'Student involvement', decides: 'Organizations, events and leadership programs.', link: 'anchorlink' },
  government: { id: 'government', name: 'Student government', decides: 'Elections, committees and student funding.' },
  sustainability: { id: 'sustainability', name: 'Sustainability office', decides: 'Sustainability programs, events and green grants.' },
  alumni: { id: 'alumni', name: 'Alumni relations', decides: 'Alumni networks, mentoring programs and events.' },
  continuing: { id: 'continuing', name: 'Continuing education', decides: 'Certificates, short courses and credit for prior learning.' },
  basicneeds: { id: 'basicneeds', name: 'Basic needs support', decides: 'Food pantry, emergency housing and emergency funds.' },
  deanofstudents: { id: 'deanofstudents', name: 'Dean of students', decides: 'Emergency grants, absences for emergencies and student advocacy.' },
};

/**
 * Where to send somebody for this office, or `''` if the app does not know.
 *
 * The student's own address first — see `linkUrls` in the store — then the
 * one the app shipped with, then nothing. Only `https:` survives: a stored
 * `javascript:` link opened from a button is the one mistake here that is not
 * merely a wrong page.
 */
export function officeUrl(id: OfficeId, linkUrls: Readonly<Record<string, string>> = {}): string {
  const office = OFFICES[id];
  if (!office?.link) return '';
  const url = linkUrls[office.link] || CAMPUS_LINKS.find((l) => l.id === office.link)?.url || '';
  return /^https:\/\//i.test(url) ? url : '';
}

/** "Registrar" — or the id itself, so a typo shows rather than blanks. */
export function officeName(id: OfficeId): string {
  return OFFICES[id]?.name ?? id;
}
