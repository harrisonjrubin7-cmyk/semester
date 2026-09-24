import { describe, expect, it } from 'vitest';
import {
  classifyMistake,
  initialDiagnostic,
  learningState,
  readinessForecast,
  recommendLearningActivity,
  type LearningLoopInput,
} from './learning-loop';

const concepts = [
  { id: 'elasticity', name: 'Elasticity', source: 'Course guide · Unit 2' },
  { id: 'equilibrium', name: 'Equilibrium', source: 'Course guide · Unit 3' },
];

const fixture = (patch: Partial<LearningLoopInput> = {}): LearningLoopInput => ({
  concepts,
  attempts: [],
  due: 0,
  recurringMistake: null,
  stale: false,
  coverage: 0,
  ...patch,
});

describe('adaptive learning evidence', () => {
  it('keeps unobserved concepts unmeasured rather than inheriting an authored percentage', () => {
    const [concept] = learningState(fixture({ attempts: [] }));
    expect(concept.state).toBe('unseen');
    expect(concept.confidence).toBeNull();
    expect(concept.evidence).toEqual([]);
  });

  it('uses an initial diagnostic as evidence without turning it into a grade', () => {
    const result = initialDiagnostic(concepts, [
      { conceptId: 'elasticity', correct: true, source: 'Course guide · Unit 2' },
    ]);
    expect(result.concepts[0].state).toBe('introduced');
    expect(result.concepts[0].evidence[0].kind).toBe('diagnostic');
    expect(result).not.toHaveProperty('grade');
  });

  it('explains a recommendation from due retrieval and a recurring procedure error', () => {
    const next = recommendLearningActivity(
      fixture({ due: 4, recurringMistake: 'procedure-error' }),
    );
    expect(next.activity).toBe('cards');
    expect(next.evidence.map((evidence) => evidence.kind)).toEqual(
      expect.arrayContaining(['due-retrieval', 'mistake']),
    );
  });

  it('widens readiness when a source is stale or evidence coverage is sparse', () => {
    expect(readinessForecast(fixture({ stale: true, coverage: 0.2 })).range).toEqual([20, 55]);
  });

  it('suggests a classification without silently confirming it', () => {
    expect(classifyMistake({ attempt: 'I used the right idea but skipped a step in the method.' })).toEqual({
      classification: 'procedure-error',
      label: 'Procedure error',
      confirmed: false,
      reason: 'The attempt describes a missed or misordered step.',
    });
  });
});
