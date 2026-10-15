import { AI_DATA_CEILING, aiClassVerdict, type ClassVerdict, type DataClass, type FieldClaim } from '../../../packages/institution/src/ai-data-class.ts';
import type { ProviderGenerationRequest } from './providers/types.ts';
import type { ApprovedIntelligenceSource } from './intelligence.ts';

/**
 * The data class of every field the institution gateway can hand a provider
 * (privacy finding C7).
 *
 * `Record<keyof ...>` is the structural half: adding a field to
 * `ProviderGenerationRequest` or `ApprovedIntelligenceSource` without a class
 * here does not compile. `checkProviderRequest` is the runtime half: it reads
 * the keys of the object it is actually given, so a field that arrives some
 * other way (a loader that spreads a database row, a cast) has no class and is
 * refused as T3 by name.
 *
 * Declared as the product says each field is, not as it was inspected:
 *
 *  - `question` is the student's own words, T2.
 *  - A source is institution-approved and course-authorized material, T1, the
 *    class `ai-systems.ts` records for this system. `approved_source` has no
 *    class column today, so this is a declaration by construction, not a
 *    property of the data; a school's data steward owning one is a follow-up.
 *  - Everything else is routing and configuration.
 *
 * The ceiling is `AI_DATA_CEILING` (T2). A tenant that wants a lower one is
 * served by `data_classification_rules`, which nothing on the AI path reads
 * yet; this check only ever applies the platform one.
 */
export const PROVIDER_FIELD_CLASS: Readonly<Record<keyof ProviderGenerationRequest, DataClass>> = {
  provider: 'T0',
  model: 'T0',
  question: 'T2',
  mode: 'T0',
  agent: 'T0',
  coursePolicyInstruction: 'T1',
  sources: 'T1',
  maxOutputTokens: 'T0',
};

export const SOURCE_FIELD_CLASS: Readonly<Record<keyof ApprovedIntelligenceSource, DataClass>> = {
  id: 'T0',
  labels: 'T0',
  evidenceIds: 'T0',
  body: 'T1',
  courseId: 'T0',
  origin: 'T0',
  policyScope: 'T0',
  policyCourseCode: 'T0',
  policyTerm: 'T0',
  title: 'T1',
  locator: 'T1',
  verifiedAt: 'T0',
};

const own = (table: Readonly<Record<string, DataClass>>, key: string): DataClass | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

/**
 * Whether every field of this provider request, and of every source in it, is
 * declared at or under the ceiling. The verdict names fields (`sources[].x`)
 * and never carries a value.
 */
export function checkProviderRequest(request: ProviderGenerationRequest): ClassVerdict {
  const claims: FieldClaim[] = Object.keys(request).map((key) => [key, own(PROVIDER_FIELD_CLASS, key)]);
  const seen = new Set<string>();
  for (const source of Array.isArray(request.sources) ? request.sources : []) {
    for (const key of Object.keys(source)) {
      if (seen.has(key)) continue;
      seen.add(key);
      claims.push([`sources[].${key}`, own(SOURCE_FIELD_CLASS, key)]);
    }
  }
  return aiClassVerdict(claims, AI_DATA_CEILING);
}
