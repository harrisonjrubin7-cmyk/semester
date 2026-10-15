/**
 * The consumer tools as registry rows: `TB-01` of docs/ai-governance/04-tool-broker.md.
 *
 * `lib/tools.ts` already types the sixteen writes (a proposal with a sentence,
 * a button, a `reach` and an inverse built when the card is drawn), and
 * `lib/lookup.ts` types the six reads. What did not exist is one list that
 * says, for every tool a model may be offered, what it is, how far it reaches,
 * what puts it back, and what data it can carry, in the vocabulary the rest of
 * the governance code uses, so that a new tool arrives as a row somebody had to
 * write and not as a function name in an array.
 *
 * This is the first half of a broker and it is deliberately only that. It
 * changes no behaviour: nothing at runtime reads it. `ai-tools.test.ts` holds
 * it to the tree in both directions: every tool in `TOOLS`, `LOOKUPS`, the
 * role lists in `packages/institution/src/agents.ts` and `APP_TOOLS` has a row
 * and every row has a tool, and each row's `reach` and `undo` are read back out
 * of the branch of `readProposal` that produces them. The server half (strict
 * argument schemas, a server-rendered preview, a per-tool kill key) is `TB-02`
 * onward and is not here.
 *
 * ## Deny by default
 *
 * A tool with no row fails the suite. That is the same posture `agents.ts`
 * takes ("new tools are denied by default"), moved to where a person adding a
 * tool will meet it.
 */

import type { Tier } from '../toolkit/classification';
import type { Reach } from '../reach';
import type { ActionTier } from './ai-playbook';

export type ToolKind = 'read' | 'write' | 'view';

/** What puts a write back: an exact inverse, the row that appeared, or nothing (a view changes nothing to put back). */
export type UndoKind = 'inverse' | 'appeared' | 'none';

/** Who must approve, weakest first. Mirrors the approval column of the broker design. */
export const APPROVALS = ['self', 'fresh-auth', 'second-person', 'official-handoff'] as const;
export type Approval = (typeof APPROVALS)[number];

export interface ToolRecord {
  name: string;
  kind: ToolKind;
  /** The highest action tier the tool reaches (ai-playbook.ts). */
  action: ActionTier;
  /** How far a confirmed call reaches (lib/reach.ts). Reads and views are `look`; the writes today are `mine`. */
  reach: Reach;
  undo: UndoKind;
  /** The highest data tier the tool can accept or return to the model. */
  data: Tier;
  approval: Approval;
}

const read = (name: string, data: Tier = 'T2'): ToolRecord =>
  ({ name, kind: 'read', action: 'A', reach: 'look', undo: 'none', data, approval: 'self' });

const write = (name: string, undo: Exclude<UndoKind, 'none'>): ToolRecord =>
  ({ name, kind: 'write', action: 'C', reach: 'mine', undo, data: 'T2', approval: 'self' });

export const TOOL_RECORDS: readonly ToolRecord[] = [
  // The reads (`lib/lookup.ts`). `read_grades` and `read_attendance` are the T3 reaches recorded
  // as the reconciliation on `AI-01.1` in ai-systems.ts.
  read('find_deadlines'),
  read('read_grades', 'T3'),
  read('read_attendance', 'T3'),
  read('search_material'),
  read('read_tasks'),
  read('read_timetable'),
  // The writes (`lib/tools.ts`), each a proposal the student presses.
  write('tick_deadline', 'inverse'),
  write('add_task', 'appeared'),
  write('move_task', 'inverse'),
  write('mark_attendance', 'inverse'),
  write('start_timer', 'appeared'),
  write('add_note', 'appeared'),
  write('add_source', 'appeared'),
  write('add_application', 'appeared'),
  write('set_look', 'inverse'),
  write('set_day_budget', 'inverse'),
  write('move_application', 'inverse'),
  write('set_next_step', 'inverse'),
  write('make_document', 'appeared'),
  write('make_sheet', 'appeared'),
  write('save_equation', 'appeared'),
  // A view: applied on arrival when it targets the screen already open, and nothing is kept.
  { name: 'open_screen', kind: 'view', action: 'A', reach: 'look', undo: 'none', data: 'T2', approval: 'self' },
];

export const toolRecord = (name: string): ToolRecord | undefined => TOOL_RECORDS.find((t) => t.name === name);

/**
 * The weakest approval a reach may have. A tool that sends, binds or needs an
 * institution's gate cannot arrive with the tap a checkbox gets by saying nothing.
 */
export const REQUIRED_APPROVAL: Record<Reach, Approval> = {
  look: 'self',
  mine: 'self',
  outward: 'fresh-auth',
  binding: 'fresh-auth',
  guarded: 'official-handoff',
};

export const approvalAtLeast = (have: Approval, need: Approval): boolean => APPROVALS.indexOf(have) >= APPROVALS.indexOf(need);
