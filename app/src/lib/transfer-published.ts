import { cloud } from './cloud';
import { fromPublished, type PublishedRow, type Rule } from './transfer-credit';

/**
 * The approved equivalencies the student's own school has published, read
 * under `articulation_rules`' policy. Kept out of `transfer-credit.ts` so the
 * pure logic and its tests never load the account client.
 */
export async function publishedRules(): Promise<Rule[]> {
  const { data, error } = await (await cloud())
    .from('articulation_rules')
    .select('partner_scope, from_course, to_course, credits, status')
    .eq('status', 'approved')
    .limit(2000);
  if (error) throw new Error(error.message);
  return fromPublished((data ?? []) as PublishedRow[]);
}
