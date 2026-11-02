import { cloud } from './cloud';
import { requireOnline } from './offline-mode';
import { readStudentActions, type StudentAction, type StudentActionState } from './student-actions';

/**
 * The calls behind released feedback in the Action Center. The student reads
 * through `my_student_actions` and changes a row only through
 * `settle_student_action`, which takes the version they read and a key; the
 * table itself is read-only to them.
 */

/** The server moved the row since it was read; nothing was saved. */
export class StaleActionError extends Error {
  constructor() {
    super('This changed on another device, so nothing was saved. The list has been refreshed — try again.');
    this.name = 'StaleActionError';
  }
}

export async function myStudentActions(): Promise<StudentAction[]> {
  const { data, error } = await (await cloud()).rpc('my_student_actions');
  if (error) throw new Error(error.message);
  return readStudentActions(data);
}

export interface Settled {
  id: string;
  state: StudentActionState;
  version: number;
}

/**
 * Moves one row. The key names the row, the version read and the state asked
 * for, so pressing the same button twice on a slow connection is one change.
 */
export async function settleStudentAction(id: string, to: StudentActionState, version: number): Promise<Settled> {
  requireOnline('send');
  const { data, error } = await (await cloud()).rpc('settle_student_action', {
    want_action: id,
    want_state: to,
    want_version: version,
    want_key: `feedback:${id}:${version}:${to}`,
  });
  if (error) {
    if ((error as { code?: string }).code === '40001') throw new StaleActionError();
    throw new Error(error.message);
  }
  const r = (data ?? {}) as Record<string, unknown>;
  return { id: String(r.id ?? id), state: (r.state as StudentActionState) ?? to, version: Number(r.version ?? version + 1) };
}
