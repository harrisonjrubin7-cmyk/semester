import type { Level } from '@semester/institution';

/**
 * Which rung of the automation ladder each automated feature stands on.
 *
 * The ladder (`packages/institution/src/automation.ts`) says what each rung
 * costs. This says who stands where, so a feature that quietly moves up a
 * rung — a draft that starts sending, a suggestion that starts writing — is a
 * line in a diff with a test beside it, not a change nobody was asked about.
 *
 * Only what exists is listed, and each entry cites the file that does it. A
 * feature that has not been built is not declared here, and one that would go
 * above `prepare` must say which rung it was stepped up from — the ladder then
 * refuses the entry unless it is one step, with its grounds.
 */
export interface Rung {
  id: string;
  what: string;
  rung: Level;
  /** For anything above `prepare`: the rung it was reached from. */
  steppedFrom?: Level;
  /** The file that does it. */
  evidence: string;
}

export const RUNGS: readonly Rung[] = [
  { id: 'notify-plan-ahead', what: 'A reminder planned, capped and explained on the device', rung: 'inform', evidence: 'app/src/lib/notify.ts' },
  { id: 'moment-feedback', what: 'One optional question after something happens; the answer stays on the device', rung: 'inform', evidence: 'app/src/lib/momentfeedback.ts' },
  { id: 'life-events', what: 'Optional plan adjustments and routes for a change in circumstances; nothing is sent', rung: 'recommend', evidence: 'app/src/lib/lifeevents.ts' },
  { id: 'learner-pathways', what: 'Checklists and filters offered for pathways the student ticked', rung: 'recommend', evidence: 'app/src/lib/learner-pathways.ts' },
  { id: 'university-templates', what: 'Preparation drafts a student edits; never submitted', rung: 'draft', evidence: 'app/src/lib/university.templates.ts' },
  { id: 'gateway-prepare', what: 'A review of an institution action; the record and the school are unchanged', rung: 'prepare', evidence: 'app/server/institution/gateway.ts' },
  { id: 'help-request', what: 'A help request is previewed line by line and sent only on the student’s confirmation', rung: 'confirm', steppedFrom: 'prepare', evidence: 'app/src/components/GetHelp.tsx' },
  { id: 'gateway-commit', what: 'An authorised adapter action runs, on a confirmation, an authority, a policy and an audit record', rung: 'execute', steppedFrom: 'confirm', evidence: 'app/server/institution/gateway.ts' },
];

export const rungById = (id: string): Rung | undefined => RUNGS.find((r) => r.id === id);
