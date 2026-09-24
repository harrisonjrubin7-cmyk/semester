import { cardIdentity, type Reviews } from './review';
import type { Guide, StudyMode } from './types';

export type ConceptLearningState =
  | 'unseen'
  | 'introduced'
  | 'practising'
  | 'retained'
  | 'needs-review';

export type MistakeClassification =
  | 'concept-gap'
  | 'recall-gap'
  | 'procedure-error'
  | 'misread-prompt'
  | 'source-misuse'
  | 'calculation-error'
  | 'unsupported-claim'
  | 'confidence-mismatch';

export interface LearningConcept {
  id: string;
  name: string;
  source: string;
}

export interface LearningAttempt {
  conceptId: string;
  correct: boolean;
  kind: 'diagnostic' | 'retrieval' | 'practice' | 'teach-back';
  at?: number;
  source?: string;
  mistake?: MistakeClassification;
  nextReview?: string;
}

export interface LearningEvidence {
  kind: 'diagnostic' | 'retrieval' | 'practice' | 'teach-back' | 'due-retrieval' | 'mistake';
  label: string;
  source?: string;
}

export interface ConceptState {
  id: string;
  name: string;
  state: ConceptLearningState;
  confidence: number | null;
  evidence: LearningEvidence[];
  nextReview: string | null;
}

export interface LearningLoopInput {
  concepts: LearningConcept[];
  attempts: LearningAttempt[];
  due: number;
  recurringMistake: MistakeClassification | null;
  stale: boolean;
  coverage: number;
}

export function courseLearningInput(
  courseId: string,
  guide: Guide,
  reviews: Reviews,
  options: {
    due: number;
    recurringMistake?: MistakeClassification | null;
    stale?: boolean;
    now?: number;
  },
): LearningLoopInput {
  const concepts = guide.units.map((unit, index) => ({
    id: `${courseId}:unit:${index}`,
    name: unit.name,
    source: `${guide.source || 'Course material'} · ${unit.name}`,
  }));
  const attempts: LearningAttempt[] = guide.units.flatMap((unit, unitIndex) =>
    unit.cards.flatMap((card) => {
      const review = reviews[cardIdentity(courseId, card)];
      if (!review || review.seen <= 0) return [];
      return [
        {
          conceptId: `${courseId}:unit:${unitIndex}`,
          correct: review.streak > 0 && review.right >= review.wrong,
          kind: 'retrieval' as const,
          at: review.seen,
          source: `${guide.source || 'Course material'} · ${unit.name}`,
          mistake: review.wrong > review.right ? ('recall-gap' as const) : undefined,
          nextReview: new Date(review.due).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          }),
        },
      ];
    }),
  );
  const cardCount = guide.units.reduce((total, unit) => total + unit.cards.length, 0);
  return {
    concepts,
    attempts,
    due: options.due,
    recurringMistake: options.recurringMistake ?? null,
    stale: options.stale ?? attempts.some((attempt) =>
      attempt.at !== undefined && (options.now ?? Date.now()) - attempt.at > 180 * 86_400_000,
    ),
    coverage: cardCount === 0 ? 0 : attempts.length / cardCount,
  };
}

const mistakeLabel = (mistake: MistakeClassification) =>
  `${mistake[0].toUpperCase()}${mistake.slice(1).replaceAll('-', ' ')}`;

export function learningState(input: LearningLoopInput): ConceptState[] {
  return input.concepts.map((concept) => {
    const attempts = input.attempts.filter((attempt) => attempt.conceptId === concept.id);
    if (attempts.length === 0) {
      return {
        id: concept.id,
        name: concept.name,
        state: 'unseen',
        confidence: null,
        evidence: [],
        nextReview: null,
      };
    }

    const retrievals = attempts.filter((attempt) => attempt.kind !== 'diagnostic');
    const correct = attempts.filter((attempt) => attempt.correct).length;
    const last = attempts[attempts.length - 1];
    const hasMistake = attempts.some((attempt) => attempt.mistake);
    let state: ConceptLearningState = 'introduced';
    if (retrievals.length > 0) state = 'practising';
    if (retrievals.length >= 3 && correct / attempts.length >= 0.75) state = 'retained';
    if (!last.correct || hasMistake || input.due > 0) state = 'needs-review';

    const evidence: LearningEvidence[] = attempts.map((attempt) => ({
      kind: attempt.kind,
      label: `${attempt.correct ? 'Correct' : 'Needs work'} ${attempt.kind}`,
      source: attempt.source ?? concept.source,
    }));
    return {
      id: concept.id,
      name: concept.name,
      state,
      confidence: Math.round((correct / attempts.length) * 100) / 100,
      evidence,
      nextReview: [...attempts].reverse().find((attempt) => attempt.nextReview)?.nextReview ?? null,
    };
  });
}

export function initialDiagnostic(
  concepts: LearningConcept[],
  answers: Array<Pick<LearningAttempt, 'conceptId' | 'correct' | 'source'>>,
) {
  return {
    completedAt: Date.now(),
    concepts: learningState({
      concepts,
      attempts: answers.map((answer) => ({ ...answer, kind: 'diagnostic' as const })),
      due: 0,
      recurringMistake: null,
      stale: false,
      coverage: concepts.length === 0 ? 0 : answers.length / concepts.length,
    }),
  };
}

export interface MistakeSuggestion {
  classification: MistakeClassification;
  label: string;
  confirmed: false;
  reason: string;
}

export function classifyMistake(input: {
  attempt?: string;
  correction?: string;
  topic?: string;
  source?: string;
}): MistakeSuggestion {
  const text = `${input.attempt ?? ''} ${input.correction ?? ''} ${input.topic ?? ''}`.toLowerCase();
  let classification: MistakeClassification = 'concept-gap';
  let reason = 'The explanation points to a missing or incomplete concept.';
  if (/skip|step|order|method|procedure/.test(text)) {
    classification = 'procedure-error';
    reason = 'The attempt describes a missed or misordered step.';
  } else if (/calculat|arithmetic|sign|decimal|unit/.test(text)) {
    classification = 'calculation-error';
    reason = 'The attempt points to a calculation, sign or unit error.';
  } else if (/misread|prompt|question asked/.test(text)) {
    classification = 'misread-prompt';
    reason = 'The attempt indicates that the prompt was read differently than intended.';
  } else if (/source|citation|page/.test(text)) {
    classification = 'source-misuse';
    reason = 'The attempt indicates that a source or citation may have been used incorrectly.';
  } else if (/claim|evidence|support/.test(text)) {
    classification = 'unsupported-claim';
    reason = 'The attempt includes a claim that needs supporting evidence.';
  } else if (/forgot|remember|recall/.test(text)) {
    classification = 'recall-gap';
    reason = 'The concept was recognized but not recalled when needed.';
  } else if (/confident|guess|unsure/.test(text)) {
    classification = 'confidence-mismatch';
    reason = 'The stated confidence does not match the evidence in the attempt.';
  }
  return { classification, label: mistakeLabel(classification), confirmed: false, reason };
}

export interface ReadinessForecast {
  range: [number, number];
  asOf: string;
  inputs: string[];
  missingEvidence: string[];
}

export function readinessForecast(input: LearningLoopInput, now = new Date()): ReadinessForecast {
  const coverage = Math.max(0, Math.min(1, input.coverage));
  const low = Math.round(coverage * 100);
  const high = Math.min(100, low + (input.stale || coverage < 0.5 ? 35 : 20));
  const missingEvidence: string[] = [];
  if (coverage < 0.5) missingEvidence.push('Evidence covers less than half of the concepts.');
  if (input.stale) missingEvidence.push('Some source or practice evidence is stale.');
  return {
    range: [low, high],
    asOf: now.toISOString(),
    inputs: [`${Math.round(coverage * 100)}% evidence coverage`, `${input.due} retrievals due`],
    missingEvidence,
  };
}

export interface LearningRecommendation {
  activity: StudyMode;
  label: string;
  reason: string;
  evidence: LearningEvidence[];
}

export function recommendLearningActivity(input: LearningLoopInput): LearningRecommendation {
  const evidence: LearningEvidence[] = [];
  if (input.due > 0) {
    evidence.push({ kind: 'due-retrieval', label: `${input.due} retrievals are due.` });
  }
  if (input.recurringMistake) {
    evidence.push({
      kind: 'mistake',
      label: `Recurring ${mistakeLabel(input.recurringMistake).toLowerCase()}.`,
    });
  }
  if (input.due > 0) {
    return {
      activity: 'cards',
      label: `Review ${input.due} ${input.due === 1 ? 'card' : 'cards'}`,
      reason: evidence.map((item) => item.label).join(' '),
      evidence,
    };
  }
  if (input.coverage === 0) {
    return {
      activity: 'read',
      label: 'Start with the course material',
      reason: 'No learning evidence has been recorded for these concepts yet.',
      evidence,
    };
  }
  if (input.recurringMistake) {
    return {
      activity: 'quiz',
      label: 'Practise the recurring error',
      reason: evidence[0]?.label ?? 'A repeated mistake is ready for practice.',
      evidence,
    };
  }
  return {
    activity: 'quiz',
    label: 'Check retrieval',
    reason: 'A short practice set will add current evidence.',
    evidence,
  };
}
