import { zite } from 'zitejs/db';

const SAMPLE = 'Northgate University';
const SRC = 'Sample';

const day = (offsetDays: number, hour: number, min = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};

/** Shared sample institution: catalog, requirements, groups, events, connectors (all off). */
export async function ensureSampleInstitution(): Promise<string> {
  const existing = await zite.institutions.findOne({ filters: { name: SAMPLE, isSample: true } });
  if (existing) return existing.id;

  const inst = await zite.institutions.create({
    record: {
      name: SAMPLE, tenantType: 'Institution Managed', isSample: true, retentionDays: 365,
      aiPolicy: 'Northgate AI use 1.0 — assistants may read only records the member can already see. Consequential decisions go to a person.',
    } as never,
  });
  const I = inst.id;

  const reqs = await zite.requirements.bulkCreate({
    records: [
      { name: 'Core math', institution: I, program: 'BS Computer Science', creditsRequired: 12 },
      { name: 'Major electives', institution: I, program: 'BS Computer Science', creditsRequired: 15 },
      { name: 'Writing & humanities', institution: I, program: 'BS Computer Science', creditsRequired: 9 },
      { name: 'Capstone', institution: I, program: 'BS Computer Science', creditsRequired: 3 },
    ] as never,
  });
  const [rMath, rElec, rHum, rCap] = reqs.records.map((r) => r.id);

  const c1 = await zite.courses.bulkCreate({
    records: [
      { code: 'MATH 140', title: 'Calculus I', institution: I, credits: 4, satisfies: [rMath] },
      { code: 'MATH 240', title: 'Linear Algebra', institution: I, credits: 4, satisfies: [rMath] },
      { code: 'CS 210', title: 'Data Structures', institution: I, credits: 3, satisfies: [rElec] },
      { code: 'ENG 201', title: 'Argument & Composition', institution: I, credits: 3, satisfies: [rHum] },
      { code: 'BIO 210', title: 'Cell Biology', institution: I, credits: 3 },
      { code: 'HIST 214', title: 'Modern World History', institution: I, credits: 3, satisfies: [rHum] },
    ] as never,
  });
  const byCode: Record<string, string> = {};
  c1.records.forEach((c) => { byCode[c.code!] = c.id; });
  const cs310 = await zite.courses.create({ record: { code: 'CS 310', title: 'Algorithms', institution: I, credits: 3, satisfies: [rElec], prerequisites: [byCode['CS 210']] } as never });
  byCode['CS 310'] = cs310.id;
  const cs410 = await zite.courses.create({ record: { code: 'CS 410', title: 'Distributed Systems', institution: I, credits: 3, satisfies: [rElec], prerequisites: [cs310.id] } as never });
  byCode['CS 410'] = cs410.id;
  const cap = await zite.courses.create({ record: { code: 'CS 499', title: 'Capstone Project', institution: I, credits: 3, satisfies: [rCap], prerequisites: [cs310.id] } as never });
  byCode['CS 499'] = cap.id;

  const sec = (code: string, n: string, term: string, times: string, policy = 'Allowed') =>
    ({ label: `${code} · ${n} · ${term}`, course: byCode[code], term, meetingTimes: times, courseAiPolicy: policy,
       syllabus: `## ${code} syllabus\n\nWeekly readings, problem sets and one major project. Office hours Tue 14:00.\n\n*Sample syllabus.*` });
  await zite.sections.bulkCreate({
    records: [
      sec('ENG 201', '03', 'Fall 2026', 'Tue/Thu 09:30-10:45', 'Outlining Only'),
      sec('BIO 210', '01', 'Fall 2026', 'Mon/Wed 13:00-14:15'),
      sec('MATH 140', '01', 'Spring 2026', 'Mon/Wed/Fri 09:00-09:50'),
      sec('CS 210', '02', 'Spring 2026', 'Tue/Thu 11:00-12:15'),
      sec('CS 310', '01', 'Spring 2027', 'Mon/Wed 10:00-11:15'),
      sec('MATH 240', '02', 'Spring 2027', 'Tue/Thu 13:00-14:15'),
      sec('HIST 214', '01', 'Spring 2027', 'Mon/Wed 10:30-11:45', 'Not Allowed'),
      sec('CS 410', '01', 'Spring 2027', 'Tue/Thu 15:00-16:15'),
      sec('CS 499', '01', 'Spring 2027', 'Fri 13:00-15:45'),
    ] as never,
  });

  const groups = await zite.groups.bulkCreate({
    records: [
      { name: 'Robotics Club', kind: 'Club', institution: I },
      { name: 'Debate Society', kind: 'Club', institution: I },
      { name: 'First-generation students', kind: 'Community', institution: I },
      { name: 'BIO 210 study group', kind: 'Study Group', institution: I },
    ] as never,
  });
  const g = groups.records.map((x) => x.id);
  await zite.events.bulkCreate({
    records: [
      { title: 'Build night', group: g[0], startsAt: day(2, 18), location: 'Engineering Lab 2' },
      { title: 'Career fair', group: g[2], startsAt: day(9, 10), location: 'Student Center' },
      { title: 'Open debate: AI in class', group: g[1], startsAt: day(5, 17, 30), location: 'Hall B' },
      { title: 'Study session · ch. 4', group: g[3], startsAt: day(0, 15), location: 'Library room 3' },
    ] as never,
  });
  await zite.opportunities.bulkCreate({
    records: [
      { title: 'Software engineering intern (Summer)', kind: 'Internship', employerName: 'Lakeshore Health' },
      { title: 'Undergraduate research assistant', kind: 'Research', employerName: 'Northgate Systems Lab' },
      { title: 'Part-time IT help desk', kind: 'Job', employerName: 'Northgate Library' },
      { title: 'Alumni mentor match', kind: 'Mentorship', employerName: 'Northgate Alumni Network' },
    ] as never,
  });
  const slots = [1, 1, 2, 3, 3, 4].map((d, i) => ({
    label: i < 4 ? 'Advising · Dr. Lin' : 'Tutoring · Writing Center', kind: i < 4 ? 'Advising' : 'Tutoring',
    startsAt: day(d, [10, 11, 14, 9, 13, 15][i]), status: 'Open Slot',
  }));
  await zite.appointments.bulkCreate({ records: slots as never });
  await zite.integrations.bulkCreate({
    records: (['SIS', 'LMS', 'SSO', 'Calendar'] as const).map((c) => ({
      name: `${c} connector`, institution: I, connector: c, enabled: false, authorizedByInstitution: false,
      syncStatus: 'Never Run', retryCount: 0,
    })) as never,
  });
  const fs = await zite.featureStatus.findAll({ limit: 1 });
  if (!fs.records.length) {
    const feat = (f: string, tested: boolean, cases: string) => ({ feature: f, designed: true, implemented: true, tested, deployed: false, institutionAuthorized: false, testCases: cases });
    await zite.featureStatus.bulkCreate({
      records: [
        feat('Onboarding & consent', true, 'PASS: one consent per step\nPASS: skip always available\nUNTESTED: decline flows on mobile'),
        feat('Today & Needs you', true, 'PASS: holds surface from every area\nPASS: source label on every row'),
        feat('Registration draft', true, 'PASS: missing prerequisite flagged\nPASS: time conflict flagged\nPASS: approver differs from requester'),
        feat('Course spaces & grading', false, 'PASS: drafts private until submit\nUNTESTED: grade release audit'),
        feat('Ask Semester', false, 'PASS: sources scoped to caller\nUNTESTED: answers (no AI provider connected)'),
        feat('Advising & support', true, 'PASS: booked slots disappear'),
        feat('Campus & moderation', true, 'PASS: reports become cases'),
        feat('SIS / LMS / SSO connectors', false, 'FAIL: no live connection configured\nPASS: sync blocked until authorized'),
      ] as never,
    });
  }
  return I;
}

/** Personal sample records for one member. */
export async function seedForUser(userId: string, institutionId: string) {
  const { records: sections } = await zite.sections.findAll({ limit: 200 });
  const s = (code: string, term: string) => sections.find((x) => x.label?.startsWith(code + ' ') && x.term === term)?.id;
  const eng = s('ENG 201', 'Fall 2026');
  const bio = s('BIO 210', 'Fall 2026');
  const enr = (section: string | undefined, status: string, grade = '', released = false) =>
    ({ label: 'Sample enrollment', student: userId, section, status, source: SRC, finalGrade: grade, gradeReleased: released });
  await zite.enrollments.bulkCreate({
    records: [
      enr(s('MATH 140', 'Spring 2026'), 'Completed', 'A', true),
      enr(s('CS 210', 'Spring 2026'), 'Completed', 'B+', true),
      enr(eng, 'Enrolled'),
      enr(bio, 'Enrolled'),
    ].filter((e) => e.section) as never,
  });
  await zite.tasks.bulkCreate({
    records: [
      { title: 'Argumentative essay', owner: userId, type: 'Assignment', source: SRC, section: eng, dueAt: day(2, 17), points: 100, status: 'Open',
        rubric: 'Thesis (25)\nEvidence (25)\nOrganization (25)\nStyle & citations (25)' },
      { title: 'Problem set 5', owner: userId, type: 'Assignment', source: SRC, section: bio, dueAt: day(4, 23, 59), points: 20, status: 'Open', rubric: 'Accuracy (15)\nShown work (5)' },
      { title: 'Read ch. 4', owner: userId, type: 'Personal', source: 'Yours', section: bio, dueAt: day(1, 20), status: 'Open' },
      { title: 'Advising hold blocks registration', owner: userId, type: 'Hold', source: SRC, status: 'Open', owningOffice: 'Academic Advising · In-app message · Mon–Fri 8–5' },
    ] as never,
  });
  await zite.achievements.bulkCreate({
    records: [
      { title: "Dean's List · Spring 2026", owner: userId, verification: 'Institution Verified', verifiedOn: '2026-06-01' },
      { title: 'Hackathon winner', owner: userId, verification: 'Student Entered' },
    ] as never,
  });
  await zite.resources.bulkCreate({
    records: [
      { title: 'Cell biology flashcards', kind: 'Flashcard Deck', owner: userId, section: bio, visibility: 'Only Me', source: SRC,
        body: 'Mitochondria :: Produces ATP through cellular respiration\nRibosome :: Synthesizes proteins\nGolgi apparatus :: Packages and ships proteins' },
      { title: 'Essay outline', kind: 'Note', owner: userId, section: eng, visibility: 'Only Me', source: 'Yours', body: '1. Claim\n2. Three reasons\n3. Counterargument\n4. Conclusion' },
    ] as never,
  });
  await zite.cases.create({ record: { title: 'Advising hold review', student: userId, category: 'Academic', status: 'Sent', reference: 'ADV-' + Math.floor(1000 + Math.random() * 9000), notes: 'Sample case.' } as never });
  void institutionId;
}
