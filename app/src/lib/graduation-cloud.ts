import { dollars } from './cost';
import { cloud } from './cloud';
import { project, termLabel, type Plan, type Scenario } from './graduation';

/**
 * Graduation scenario drafts, saved to the student's account (Phase D,
 * `graduation_simulator`), in the `graduation_scenarios` table #762 created.
 *
 * On the device every scenario is already saved as it is typed. Saving to the
 * account is a separate, deliberate act — it puts the student's plan on a
 * server — so the screen shows exactly this row first (`draftPreview`) and
 * writes nothing until they confirm. Row-level security limits every row to
 * its owner; account deletion removes them (`OWNED_TABLES` in `lib/cloud.ts`).
 *
 * `source_label` is always `estimated`: the table refuses anything stronger,
 * and nothing here is.
 */

export interface DraftRow {
  name: string;
  inputs: {
    done: number;
    needed: number;
    perTerm: number;
    summer: number;
    costPerTerm: number;
    summerCost: number;
    next: string;
    change: { extra: number; perTerm: number; summer: number; abroad?: Scenario['abroad'] };
  };
  projected_grad_term: string | null;
  projected_cost_cents: number | null;
  source_label: 'estimated';
}

export function draftRow(plan: Plan, done: number, scenario: Scenario): DraftRow {
  const p = project(plan, done, scenario);
  return {
    name: scenario.name.trim().slice(0, 120) || 'Scenario',
    inputs: {
      done,
      needed: plan.needed,
      perTerm: plan.perTerm,
      summer: plan.summer,
      costPerTerm: plan.costPerTerm,
      summerCost: plan.summerCost,
      next: termLabel(plan.next),
      change: {
        extra: scenario.extra,
        perTerm: scenario.perTerm,
        summer: scenario.summer,
        ...(scenario.abroad ? { abroad: scenario.abroad } : {}),
      },
    },
    projected_grad_term: p.finish ? termLabel(p.finish) : null,
    projected_cost_cents: p.cost === null ? null : Math.round(p.cost * 100),
    source_label: 'estimated',
  };
}

/** What the confirmation shows: every field that will be stored, in words. */
export function draftPreview(row: DraftRow): string[] {
  const i = row.inputs;
  return [
    `Name: ${row.name}`,
    `Credits finished: ${i.done} of ${i.needed}`,
    `Current plan: ${i.perTerm} a term, ${i.summer} each summer, starting ${i.next}`,
    `Change: ${i.change.extra >= 0 ? '+' : ''}${i.change.extra} credits, ${i.change.perTerm} a term, ${i.change.summer} each summer${
      i.change.abroad ? `, ${i.change.abroad.terms} term abroad earning ${i.change.abroad.credits}` : ''
    }`,
    `Costs you entered: ${dollars(i.costPerTerm)} a term, ${dollars(i.summerCost)} a summer`,
    `Estimated finish: ${row.projected_grad_term ?? 'not reached at this pace'}`,
    `Estimated remaining cost: ${row.projected_cost_cents === null ? 'not estimated' : dollars(row.projected_cost_cents / 100)}`,
    'Labelled: Estimated',
  ];
}

/**
 * Insert or update one draft. Returns its id, which the device keeps on the
 * scenario so the next save updates the same row rather than adding another.
 */
export async function saveDraft(userId: string, row: DraftRow, id?: string): Promise<string> {
  const key = id ?? crypto.randomUUID();
  const { error } = await (await cloud())
    .from('graduation_scenarios')
    .upsert({ id: key, user_id: userId, ...row, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return key;
}

export async function deleteDraft(id: string): Promise<void> {
  const { error } = await (await cloud()).from('graduation_scenarios').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
