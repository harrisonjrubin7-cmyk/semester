import { describe, expect, it } from 'vitest';
import { assembleIntelligenceRequest, type AssembleIntelligenceInput } from './assemble';
import type { EvidenceReference } from './contracts';
import { assemble as assembleScreen } from '../ai/assemble';

const evidence = (sourceId: string, excerpt: string): EvidenceReference => ({
  id: `evidence-${sourceId}`,
  sourceId,
  origin: 'course',
  title: sourceId,
  locator: 'p. 1',
  excerpt,
  verifiedAt: '2026-09-23T12:00:00.000Z',
  authority: 'authoritative',
  scope: { tenantId: 'northstar', role: 'student', personId: 'nora', resourceId: 'econ' },
});

const fixture = (over: Partial<AssembleIntelligenceInput> = {}): AssembleIntelligenceInput => ({
  question: 'What should I review?',
  scope: { tenantId: 'northstar', role: 'student', personId: 'nora', resourceId: 'econ' },
  screen: 'study',
  courseId: 'econ',
  visibleSourceIds: ['syllabus-1'],
  evidence: [
    evidence('syllabus-1', 'Elasticity is on the midterm.'),
    evidence('family-note-1', 'private-family-note'),
  ],
  requestedMode: 'explain',
  allowedModes: ['explain', 'hint', 'practice', 'review'],
  policyId: 'policy-1',
  consentIds: [],
  timezone: 'America/Chicago',
  providerRoute: 'managed',
  assembledAt: '2026-09-23T12:05:00.000Z',
  ...over,
});

describe('Semester Intelligence request assembly', () => {
  it('takes the exact visible source slice from the existing screen provider', () => {
    const sources = Array.from({ length: 42 }, (_, index) => ({
      id: `source-${index}`,
      raw: `Source ${index}`,
      author: '',
      year: '',
      title: '',
      container: '',
      url: '',
      role: '',
      courseId: null,
      project: '',
      created: 0,
    }));
    const screen = assembleScreen({
      screen: 'sources',
      live: () => ({ state: { sources } as never, catalog: { byId: {} } as never, now: new Date() }),
      registered: () => [],
    });
    expect(screen.visibleSourceIds).toEqual(sources.slice(0, 40).map((source) => source.id));
  });

  it('sends only evidence selected by the active screen provider', () => {
    const request = assembleIntelligenceRequest(fixture());
    expect(request.context.sourceIds).toEqual(['syllabus-1']);
    expect(request.evidence.map((item) => item.sourceId)).toEqual(['syllabus-1']);
    expect(JSON.stringify(request)).not.toContain('private-family-note');
  });

  it('re-evaluates integrity policy for every request', () => {
    const request = assembleIntelligenceRequest(
      fixture({ requestedMode: 'draft', allowedModes: ['hint'] }),
    );
    expect(request.context.integrityMode).toBe('hint');
    expect(request.policyDecision.restricted).toBe(true);
  });

  it('refuses to assemble a request when policy permits no learning mode', () => {
    expect(() => assembleIntelligenceRequest(fixture({ allowedModes: [] }))).toThrow(
      'No integrity mode is permitted',
    );
  });
});
