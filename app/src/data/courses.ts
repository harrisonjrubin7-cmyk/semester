import type { Course, CourseId } from '../lib/types';

/**
 * The four Fall 2026 courses, as read out of the syllabus PDFs.
 *
 * Two details were not in the source documents and were invented for the
 * prototype: BUS 1600's 11:00a meeting time (the syllabus says only T/R) and
 * the ECON 9:05 section. They are kept here so the app matches the design.
 */
export const COURSES: Course[] = [
  {
    id: 'econ',
    code: 'ECON 1020',
    name: 'Principles of Microeconomics',
    prof: 'Dr. John Stromme',
    email: 'john.stromme@vanderbilt.edu',
    meets: 'MWF · 9:05–9:55a',
    room: 'Section 9:05',
    credits: '3 credits',
    source: 'Econ1020_2026_Fall.pdf',
    grading: [
      { what: 'Problem sets (lowest dropped)', pct: '20%' },
      { what: 'Exams — best of three at 30%', pct: '80%' },
      { what: 'Top Hat participation', pct: '+3% EC' },
    ],
  },
  {
    id: 'psci',
    code: 'PSCI 1104',
    name: 'Understanding Political Controversy',
    prof: 'Prof. Jessica Trounstine',
    email: 'jessica.l.trounstine@vanderbilt.edu',
    meets: 'T/R · 2:45–4:00p',
    room: 'Garland 162',
    credits: '3 credits',
    source: 'PSCI1104_Trounstine_F26.pdf',
    grading: [
      { what: 'Six quizzes, 5% each', pct: '30%' },
      { what: 'Midterm — Oct 15, in class', pct: '30%' },
      { what: 'Final — Dec 17, 9–11a', pct: '35%' },
      { what: 'Attendance (Top Hat 782449)', pct: '5%' },
    ],
  },
  {
    id: 'core',
    code: 'CORE 2500',
    name: 'Sports, Culture, and Society',
    prof: 'Prof. Gabriel Torres Colón',
    email: 'g.torres@vanderbilt.edu',
    meets: 'T/R · 1:15–2:30p',
    room: 'Garland',
    credits: '3 credits',
    source: 'Sports_Fall26_Syllabus.pdf',
    grading: [
      { what: 'Eight quizzes, 10 pts each', pct: '80 pts' },
      { what: 'Thirteen reflections, 10 pts', pct: '130 pts' },
      { what: 'Final reflection', pct: '20 pts' },
      { what: 'Attendance — 2 free absences', pct: '—' },
    ],
  },
  {
    id: 'bus',
    code: 'BUS 1600',
    name: 'Marketing Management',
    prof: 'Dr. Eric Hogue',
    email: 'eric.d.hogue@vanderbilt.edu',
    meets: 'T/R · Alumni Hall 201',
    room: 'Alumni Hall 201',
    credits: '2 credits',
    source: 'Syllabus Draft 8262026.pdf',
    grading: [
      { what: 'Midterm case write-up', pct: '30%' },
      { what: 'Final exam', pct: '25%' },
      { what: 'Four group assignments', pct: '20%' },
      { what: 'Attendance', pct: '10%' },
      { what: 'Individual assignment', pct: '10%' },
      { what: 'SONA research participation', pct: '5%' },
    ],
  },
];

export const COURSE_BY_ID: Record<CourseId, Course> = COURSES.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<CourseId, Course>,
);

export function codeOf(id: CourseId): string {
  return COURSE_BY_ID[id].code;
}

/** The short code the feed and calendar filter chips use. */
export const COURSE_SHORT: Record<CourseId, string> = {
  econ: 'ECON',
  psci: 'PSCI',
  core: 'CORE',
  bus: 'BUS',
};
