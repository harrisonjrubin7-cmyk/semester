import type { FeatureState } from '../intelligence/contracts';
import { institutionalPreview, type PreviewEnv } from './institutional-preview';

export interface ExperienceFlags {
  semesterIntelligence: FeatureState;
  journeyNavigation: FeatureState;
  adaptiveLearning: FeatureState;
  careerSkillsGraph: FeatureState;
  multimodalCapture: FeatureState;
  universityControlPlane: FeatureState;
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
  };
}

export const EXPERIENCE_FLAGS = experienceFlags(import.meta.env);
