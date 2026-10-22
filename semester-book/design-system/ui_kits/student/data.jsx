// Sample data for the student kit. Illustrative — not live.
const studentData = {
  name: 'Maya Lindqvist', school: 'Northfield University', term: 'Fall 2026 · Week 6',
  classes: [
    { time: '09:00', title: 'BIO 210 · Cell Biology', where: 'Hensel Hall 204', src: 'official' },
    { time: '11:30', title: 'Study block — Lab report 3', where: 'Your plan', src: 'personal' },
    { time: '13:00', title: 'ECON 1020 · Microeconomics', where: 'Laird 110 · Recitation', src: 'official' },
    { time: '16:00', title: 'Rowing practice', where: 'Boathouse · from TeamApp', src: 'connected' },
  ],
  assignments: [
    { id: 'a1', title: 'Lab report 3: Enzyme kinetics', course: 'BIO 210', due: 'Thu 9 Oct · 23:59', weight: '12%', status: 'draft', src: 'official' },
    { id: 'a2', title: 'Problem set 5', course: 'ECON 1020', due: 'Fri 10 Oct · 17:00', weight: '4%', status: 'synced', src: 'connected' },
    { id: 'a3', title: 'Reading response: Ch. 7', course: 'BIO 210', due: 'Mon 13 Oct · 09:00', weight: '2%', status: 'queued', src: 'official' },
    { id: 'a4', title: 'Midterm', course: 'BIO 210', due: 'Wed 22 Oct · 09:00', weight: '25%', status: 'updated-today', src: 'official' },
  ],
};
Object.assign(window, { studentData });
