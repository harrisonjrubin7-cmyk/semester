import type { Course, Item } from './types';

export const CONTEXT_KINDS = [
  'student',
  'institution',
  'term',
  'course',
  'requirement',
  'plan',
  'action',
  'event',
  'source',
  'workspace-item',
  'study-asset',
  'person',
  'service',
  'career-evidence',
  'opportunity',
  'preference',
  'share',
  'history-event',
] as const;

export type ContextKind = (typeof CONTEXT_KINDS)[number];

export interface ContextNode {
  id: string;
  kind: ContextKind;
  label: string;
  source: 'institution-verified' | 'imported' | 'student-entered' | 'estimated' | 'ai-derived' | 'needs-review';
}

export interface ContextEdge {
  from: string;
  to: string;
  relation: string;
}

export interface ContextGraph {
  nodes: ContextNode[];
  edges: ContextEdge[];
}

export interface ContextGraphInput {
  studentId: string;
  institutionId: string;
  termId: string;
  courses: readonly Course[];
  items: readonly Item[];
}

const nodeId = (kind: ContextKind, id: string) => `${kind}:${id}`;

/**
 * The shared academic context every module can project instead of creating a
 * private copy of a course, term, deadline, or source. This first projection
 * is deliberately factual: it contains imported objects and their explicit
 * relationships only, with no hidden risk, ability, motivation, or identity
 * inference.
 */
export function buildContextGraph(input: ContextGraphInput): ContextGraph {
  const nodes: ContextNode[] = [
    { id: nodeId('student', input.studentId), kind: 'student', label: 'Student', source: 'student-entered' },
    { id: nodeId('institution', input.institutionId), kind: 'institution', label: input.institutionId, source: 'institution-verified' },
    { id: nodeId('term', input.termId), kind: 'term', label: input.termId, source: 'student-entered' },
  ];
  const edges: ContextEdge[] = [
    { from: nodeId('student', input.studentId), to: nodeId('institution', input.institutionId), relation: 'belongs-to' },
    { from: nodeId('student', input.studentId), to: nodeId('term', input.termId), relation: 'views' },
  ];

  for (const course of input.courses) {
    const courseId = nodeId('course', course.id);
    const sourceId = nodeId('source', `course:${course.id}`);
    nodes.push(
      { id: courseId, kind: 'course', label: `${course.code} — ${course.name}`, source: 'imported' },
      { id: sourceId, kind: 'source', label: course.source || `${course.code} source`, source: 'imported' },
    );
    edges.push(
      { from: courseId, to: nodeId('term', course.term ?? input.termId), relation: 'occurs-in' },
      { from: courseId, to: sourceId, relation: 'grounded-by' },
      { from: nodeId('student', input.studentId), to: courseId, relation: 'studies' },
    );
  }

  for (const item of input.items) {
    const actionId = nodeId('action', item.id);
    nodes.push({ id: actionId, kind: 'action', label: item.title, source: 'imported' });
    edges.push(
      { from: actionId, to: nodeId('course', item.c), relation: 'belongs-to' },
      { from: actionId, to: nodeId('source', `course:${item.c}`), relation: 'grounded-by' },
    );
  }

  return { nodes, edges };
}

export function connectedTo(graph: ContextGraph, id: string): ContextNode[] {
  const ids = new Set(
    graph.edges.flatMap((edge) => (edge.from === id ? [edge.to] : edge.to === id ? [edge.from] : [])),
  );
  return graph.nodes.filter((node) => ids.has(node.id));
}

