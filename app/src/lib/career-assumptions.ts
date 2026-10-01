import type { AssumptionAdapter } from './assumptions';
import { CAREER_LIMITS, targetScore, type CareerLibrary } from './career';

export function careerAssumptions(value: CareerLibrary, apply: (patch: Partial<CareerLibrary>) => boolean): AssumptionAdapter[] {
  return (['targetRoles', 'targetLocations'] as const).map(key => ({
    id: key, label: key === 'targetRoles' ? 'Target roles' : 'Target locations', value: value[key], owner: 'student',
    source: 'Your private career preferences', maxLength: CAREER_LIMITS.targets,
    validate: draft => draft.length <= CAREER_LIMITS.targets,
    outcomes: draft => {
      const next = { ...value, [key]: draft };
      return value.opportunities.length ? [...value.opportunities]
        .sort((a, b) => targetScore(b, next) - targetScore(a, next))
        .map((o, i) => `${i + 1}. ${o.title}: ${targetScore(o, next)} matching target terms`) : ['Listing order: Unknown — no saved listings'];
    },
    apply: draft => apply({ [key]: draft }),
  }));
}
