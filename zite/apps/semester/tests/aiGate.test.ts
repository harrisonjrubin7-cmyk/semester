import { test, eq } from './harness';
import { gate, matchCourses, asksForGradedWork, classify, sendableToAI, promptRule, SectionRef } from '../src/lib/aiGate';

const S: SectionRef[] = [
  { id: 's1', code: 'HIST 214', title: 'Modern Europe', policy: 'Not Allowed' },
  { id: 's2', code: 'ENGL 101', title: 'Composition', policy: 'Outlining Only' },
  { id: 's3', code: 'CS 101', title: 'Intro to Programming', policy: 'Allowed' },
];

test('matches a course by code in any spacing', () => {
  eq(matchCourses('when is the hist214 paper due', S).map((s) => s.id), ['s1']);
  eq(matchCourses('HIST-214 reading list?', S).map((s) => s.id), ['s1']);
  eq(matchCourses('help with Modern Europe', S).map((s) => s.id), ['s1']);
});
test('does not match a title inside another word', () => {
  eq(matchCourses('compositional analysis', S).length, 0);
});
test('Not Allowed course blocks the answer', () => {
  const d = gate('Summarize the HIST 214 readings', S);
  eq(d.level, 'blocked'); eq(d.course, 'HIST 214');
});
test('strictest rule wins when two courses are named', () => {
  eq(gate('compare CS 101 and HIST 214 workload', S).level, 'blocked');
  eq(gate('compare CS 101 and ENGL 101 workload', S).level, 'outline');
});
test('Outlining Only limits to an outline', () => {
  const d = gate('Can you write my ENGL 101 essay', S);
  eq(d.level, 'outline'); eq(d.rule, 'Outlining Only');
  eq(promptRule(d).includes('Do NOT write'), true);
});
test('Allowed course still never writes graded work', () => {
  eq(gate('explain recursion for CS 101', S).level, 'allowed');
  eq(gate('write my CS 101 homework', S).level, 'outline');
});
test('graded work with no course named is limited, not answered in full', () => {
  eq(asksForGradedWork('please write the essay for me'), true);
  eq(gate('please write the essay for me', S).level, 'outline');
});
test('ordinary question with no course is allowed and has no extra rule', () => {
  const d = gate('what do I still need for my major', S);
  eq(d.level, 'allowed'); eq(promptRule(d), '');
});
test('restricted data classes are never sent to the AI provider', () => {
  for (const k of ['Case', 'Referral', 'Moderation Report', 'Accommodation']) eq(sendableToAI(classify(k)), false);
});
test('student records and the student’s own work are never sent to the AI provider', () => {
  for (const k of ['Course', 'Hold', 'Assignment', 'Approval Request', 'Grade', 'Enrollment', 'Note', 'Personal', 'Study Plan']) eq(sendableToAI(classify(k)), false);
});
test('only public catalog data may be sent', () => {
  for (const k of ['Catalog', 'Requirement', 'Event', 'Club']) eq(sendableToAI(classify(k)), true);
});
