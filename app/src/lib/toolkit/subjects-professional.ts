import { analyse, labReport, matrix, planned, policyMemo, restricted, t, type Subject } from './tools';

/**
 * Health, clinical and applied sciences, and the field and environmental
 * sciences.
 *
 * Every clinical tool is educational simulation on invented cases — never
 * diagnosis, treatment, patient records or decision support — and patient
 * information is T4, blocked everywhere by the classification gate. Field
 * tools keep locations coarse and private.
 */
export const PROFESSIONAL: readonly Subject[] = [
  { id: 'nursing', name: 'Nursing', family: 'Health & clinical', prefixes: ['NURS'], tools: [t('med-math', 'Medication-math practice', 'Dosage calculations on invented practice cases', 'native', { screen: 'solve', boundary: 'clinical' }), restricted('clinical-cases', 'Clinical-reasoning cases', 'Invented educational cases only', 'clinical')] },
  { id: 'public-health', name: 'Public health', family: 'Health & clinical', prefixes: ['PH', 'MHS', 'GH'], tools: [analyse, matrix, policyMemo] },
  { id: 'kinesiology', name: 'Kinesiology and nutrition', family: 'Health & clinical', prefixes: ['KIN', 'NUTR', 'EXSC'], tools: [analyse, planned('guideline-compare', 'Guideline comparison', 'Compare published guidelines — not a meal or treatment plan', 'clinical')] },
  { id: 'environment', name: 'Environmental and earth science', family: 'Field & environment', prefixes: ['EES', 'ENVS', 'GEOL'], tools: [analyse, labReport, planned('gis-basics', 'GIS learning lab', 'Layers and maps with coarse locations only', 'location')] },
];
