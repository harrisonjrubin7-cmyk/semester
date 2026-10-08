export interface Action { reversible: boolean; leavesSemester?: boolean; record?: boolean; money?: number; institutional?: boolean; affectsOthers?: boolean }
export type Pattern = 'undo' | 'preview' | 'review-confirm' | 'two-person';
/** The one rule for how hard an action is to take. */
export function pattern(a: Action): Pattern {
  if (a.institutional) return 'two-person';
  if (a.record || (a.money ?? 0) > 0) return 'review-confirm';
  if (a.leavesSemester || a.affectsOthers || !a.reversible) return 'preview';
  return 'undo';
}
export const RECOVERY = { undo: 'You can undo this.', request: 'This can be reversed on request.', none: 'This can’t be undone.' } as const;
