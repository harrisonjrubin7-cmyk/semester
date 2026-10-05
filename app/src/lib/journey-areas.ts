import type { Screen } from './types';

/**
 * The twenty-six expansion areas, and where each one lives.
 *
 * The brief listed twenty-six things Semester could grow into. Twenty-six new
 * screens would have broken every shelf in `lib/nav.ts` — none holds more than
 * eight — and most of the areas share a shape with a neighbour. So they landed
 * in six homes: four student screens, one staff studio behind a flag, and the
 * Appearance page. This file is the map from the brief to the code, so that
 * "is area 17 done" has an answer that can be checked rather than remembered.
 *
 * ## `waits` is the honest column
 *
 * Several areas are only half the app's to build. Peer mentor matching works
 * on explicit interests, but there are no mentors until a school connects its
 * program. The notices hub labels official channels, but none is connected.
 * Room availability belongs to the library's booking system. `waits` names
 * each of those, and the screens say the same thing in their own words.
 */

export type Home =
  | { screen: Screen; tab?: string }
  | { staff: 'operations'; tab: string }
  | { settings: 'setLook' | 'profile' };

export interface Area {
  n: number;
  title: string;
  homes: readonly Home[];
  /** The library that holds its rules. */
  lib: string;
  /** What only a connected school can supply. Empty when nothing waits. */
  waits: readonly string[];
}

export const AREAS: readonly Area[] = [
  { n: 1, title: 'Admissions-to-enrollment transition', homes: [{ screen: 'launchpad', tab: 'steps' }, { staff: 'operations', tab: 'governance' }], lib: 'launchpad.ts', waits: ['School-verified account conversion at matriculation', 'Yield figures need an enrollment feed'] },
  { n: 2, title: 'Orientation and first-year Launchpad', homes: [{ screen: 'launchpad' }], lib: 'launchpad.ts', waits: ['Peer mentor roster'] },
  { n: 3, title: 'Housing, transit and campus navigation', homes: [{ screen: 'support', tab: 'campus' }, { screen: 'housing' }, { screen: 'maps' }], lib: 'support.ts', waits: ['Live shuttle and disruption feeds'] },
  { n: 4, title: 'Student employment and work-study', homes: [{ screen: 'opportunities', tab: 'list' }, { screen: 'opportunities', tab: 'time' }], lib: 'opportunities.ts', waits: ['Approved job directory feed'] },
  { n: 5, title: 'Research administration and undergraduate research', homes: [{ screen: 'opportunities', tab: 'list' }], lib: 'opportunities.ts', waits: ['Verified lab openings'] },
  { n: 6, title: 'Study abroad and global learning', homes: [{ screen: 'opportunities', tab: 'list' }], lib: 'opportunities.ts', waits: ['Program catalog and course-equivalency database'] },
  { n: 7, title: 'Microcredentials and continuing education', homes: [{ screen: 'opportunities', tab: 'resume' }], lib: 'opportunities.ts', waits: ['Verified employer-recognition data'] },
  { n: 8, title: 'Experiential learning', homes: [{ screen: 'opportunities', tab: 'list' }], lib: 'opportunities.ts', waits: [] },
  { n: 9, title: 'Institutional scholarships, grants and emergency funds', homes: [{ screen: 'opportunities', tab: 'list' }, { screen: 'support', tab: 'care' }], lib: 'opportunities.ts', waits: ['Verified scholarship directory'] },
  { n: 10, title: 'Wellbeing and care navigation', homes: [{ screen: 'support', tab: 'care' }, { screen: 'support', tab: 'now' }], lib: 'support.ts', waits: [] },
  { n: 11, title: 'Disability and accessibility services navigation', homes: [{ screen: 'support', tab: 'access' }], lib: 'support.ts', waits: [] },
  { n: 12, title: 'Campus safety and emergency preparedness', homes: [{ screen: 'support', tab: 'now' }], lib: 'support.ts', waits: ['Official emergency alert integration'] },
  { n: 13, title: 'Assessment and learning analytics for faculty', homes: [{ staff: 'operations', tab: 'governance' }], lib: 'institution-ops.ts', waits: ['Aggregate event pipeline'] },
  { n: 14, title: 'Curriculum and program management', homes: [{ staff: 'operations', tab: 'curriculum' }], lib: 'institution-ops.ts', waits: ['Catalog and demand snapshots'] },
  { n: 15, title: 'Institutional research and strategic planning', homes: [{ staff: 'operations', tab: 'governance' }], lib: 'institution-ops.ts', waits: [] },
  { n: 16, title: 'Accreditation and compliance operations', homes: [{ staff: 'operations', tab: 'evidence' }], lib: 'institution-ops.ts', waits: ['Server-side evidence repository and roles'] },
  { n: 17, title: 'Facilities, labs, equipment and booking', homes: [{ screen: 'support', tab: 'campus' }], lib: 'support.ts', waits: ['Official booking and availability systems'] },
  { n: 18, title: 'Communications hub', homes: [{ screen: 'hub' }], lib: 'comms.ts', waits: ['Official notice channels'] },
  { n: 19, title: 'API and developer platform', homes: [{ staff: 'operations', tab: 'platform' }], lib: 'institution-ops.ts', waits: ['Public API gateway, key issuance and sandbox tenant'] },
  { n: 20, title: 'Data warehouse and BI interoperability', homes: [{ staff: 'operations', tab: 'governance' }], lib: 'institution-ops.ts', waits: ['Scheduled warehouse connector'] },
  { n: 21, title: 'Environment and sustainability', homes: [{ screen: 'support', tab: 'involved' }], lib: 'support.ts', waits: [] },
  { n: 22, title: 'Student governance and civic participation', homes: [{ screen: 'support', tab: 'involved' }], lib: 'support.ts', waits: ['Official election information feed'] },
  { n: 23, title: 'Alumni and donor engagement', homes: [{ screen: 'opportunities', tab: 'list' }], lib: 'opportunities.ts', waits: ['Alumni mentoring program roster'] },
  { n: 24, title: 'Advanced accessibility and neurodiversity support', homes: [{ settings: 'setLook' }, { settings: 'profile' }], lib: 'accessmode.ts', waits: [] },
  { n: 25, title: 'Disaster recovery and institutional continuity', homes: [{ screen: 'support', tab: 'now' }, { staff: 'operations', tab: 'readiness' }], lib: 'support.ts', waits: [] },
  { n: 26, title: 'International expansion readiness', homes: [{ staff: 'operations', tab: 'readiness' }], lib: 'institution-ops.ts', waits: ['Regional data residency infrastructure'] },
];
