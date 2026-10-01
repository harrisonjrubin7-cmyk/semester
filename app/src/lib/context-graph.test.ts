import { describe, expect, it } from 'vitest';
import { buildContextGraph, connectedTo } from './context-graph';

describe('Semester context graph', () => {
  it('uses one course object across its term, source, student, and actions', () => {
    const graph = buildContextGraph({
      studentId: 'student-1',
      institutionId: 'school-1',
      termId: '2027FA',
      courses: [{ id: 'econ', code: 'ECON 101', name: 'Economics', prof: '', email: '', meets: '', room: '', credits: '3', term: '2027FA', source: 'Syllabus.pdf', grading: [] }],
      items: [{ id: 'midterm', c: 'econ', title: 'Midterm', kind: 'Exam', month: 9, day: 12, dueTime: '', weight: '', where: '', detail: '', quote: '', source: 'Syllabus.pdf' }],
    });

    expect(graph.nodes.filter((node) => node.id === 'course:econ')).toHaveLength(1);
    expect(connectedTo(graph, 'course:econ').map((node) => node.id)).toEqual(
      expect.arrayContaining(['student:student-1', 'term:2027FA', 'source:course:econ', 'action:midterm']),
    );
    expect(graph.nodes.some((node) => /risk|motivation|ability/i.test(node.label))).toBe(false);
  });
});

