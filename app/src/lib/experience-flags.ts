import type { FeatureState } from '../intelligence/contracts';
import { institutionalPreview, type PreviewEnv } from './institutional-preview';

export interface ExperienceFlags {
  semesterIntelligence: FeatureState;
  journeyNavigation: FeatureState;
  adaptiveLearning: FeatureState;
  careerSkillsGraph: FeatureState;
  multimodalCapture: FeatureState;
  universityControlPlane: FeatureState;
  humanHelp: FeatureState;
  /** The staff Integration Dashboard. Tenant flags and `integration:view` still apply. */
  integrationDashboard: FeatureState;
  /**
   * The staff Operations studio: data dictionary, suppressed exports,
   * curriculum simulation, evidence, developer platform and readiness.
   */
  institutionalOperations: FeatureState;
}

const STATES: readonly FeatureState[] = ['off', 'preview', 'sandbox', 'production'];

function featureState(env: PreviewEnv, key: string, preview: boolean): FeatureState {
  const value = env[key];
  if (value === undefined) return preview ? 'preview' : 'off';
  return STATES.includes(value as FeatureState) ? (value as FeatureState) : 'off';
}

export function experienceFlags(env: PreviewEnv): ExperienceFlags {
  const preview = institutionalPreview(env);
  return {
    semesterIntelligence: featureState(env, 'VITE_SEMESTER_INTELLIGENCE', preview),
    journeyNavigation: featureState(env, 'VITE_JOURNEY_NAVIGATION', preview),
    adaptiveLearning: featureState(env, 'VITE_ADAPTIVE_LEARNING', preview),
    careerSkillsGraph: featureState(env, 'VITE_CAREER_SKILLS_GRAPH', preview),
    multimodalCapture: featureState(env, 'VITE_MULTIMODAL_CAPTURE', preview),
    universityControlPlane: featureState(env, 'VITE_UNIVERSITY_CONTROL_PLANE', preview),
    humanHelp: featureState(env, 'VITE_HUMAN_HELP', preview),
    integrationDashboard: featureState(env, 'VITE_INTEGRATION_DASHBOARD', preview),
    institutionalOperations: featureState(env, 'VITE_INSTITUTIONAL_OPERATIONS', preview),
  };
}

export const EXPERIENCE_FLAGS = experienceFlags(import.meta.env);
