import type { Action, Priority } from './actions';
import { toHash } from './route';
import {
  CHANNEL_TEXT,
  EMERGENCY_GUIDANCE,
  URGENCY_TEXT,
  followUpAt,
  needsFollowUp,
  placeLine,
  titleOf,
  whenLine,
  type MaintenanceRequest,
} from './maintenance';

/**
 * Repair follow-ups for Today's Action Center (catalog G-010).
 *
 * Separate from `lib/maintenance.ts` on purpose: that file is read by the
 * store's loader, and an import of `lib/route.ts` from there closed a cycle
 * back through the store (architecture guard `legacy-cycles-do-not-grow`).
 */

const short = (text: string) => (text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text);

function priorityOf(r: MaintenanceRequest): Priority {
  if (r.status === 'not_fixed') return 'high';
  return r.urgency === 'routine' ? 'normal' : 'high';
}

/**
 * The follow-ups the Action Center ranks with everything else.
 *
 * One per open request whose follow-up time has come. The id carries the
 * status and the follow-up time, so "still waiting, check tomorrow" or a
 * scheduled visit is a new action rather than one the student already
 * dismissed. `reopensNextDay`, because "Done" in the Action Center changes
 * nothing about the repair: it holds for today and the follow-up comes back
 * tomorrow while the request is still open, while a snooze or a dismissal
 * keeps its own terms against the same id.
 */
export function maintenanceActions(list: MaintenanceRequest[], now: number): Action[] {
  const out: Action[] = [];
  for (const r of list) {
    if (!needsFollowUp(r, now)) continue;
    const at = followUpAt(r);
    const what = short(titleOf(r));
    const ref = r.reference ? `Reference ${r.reference}` : 'No reference number recorded';
    const reported = `Reported by ${CHANNEL_TEXT[r.channel].toLowerCase()}, ${whenLine(r.reportedAt)}`;
    const visit = r.status === 'scheduled';
    const again = r.status === 'not_fixed';
    out.push({
      id: `maintenance:${r.id}:${r.status}:${at}`,
      reopensNextDay: true,
      type: 'housing',
      group: 'Housing',
      title: again ? `Report again: ${what}` : visit ? `Did the repair visit happen? ${what}` : `Check on your repair: ${what}`,
      whyItMatters: again
        ? 'You marked it still not fixed. Housing will not know until you tell them.'
        : visit
          ? 'The scheduled visit has passed. Record whether it was fixed so Semester stops asking.'
          : r.checkBackStated
            ? 'Housing said they would reply by now, and the request is still open.'
            : 'You planned to check back by now, and the request is still open.',
      priority: priorityOf(r),
      dueAt: at,
      expiresAt: null,
      source: {
        label: 'student_entered',
        system: 'Repairs you recorded in Semester',
        at: r.updated,
        authority: 'Your school’s housing or facilities office',
        dataOwner: 'You',
        correctionRoute: 'Semester cannot edit a recorded repair yet. Open Housing, remove it, and record it again with the right details; its status history goes with it.',
        officialFallback: 'Check the request in your housing portal, or call the housing office.',
      },
      explanation: {
        trigger: again
          ? 'You recorded that the repair did not fix it.'
          : visit
            ? 'A day has passed since the visit housing scheduled.'
            : r.checkBackStated
              ? 'The reply time housing gave has passed.'
              : 'The check-back time you chose has passed.',
        factors: [placeLine(r), `${URGENCY_TEXT[r.urgency]} request`, reported, ref],
        expectedImpact: 'A short follow-up with the reference number usually gets a request looked at again.',
        limitations: [
          'Semester cannot see your housing portal, so it does not know whether housing already replied or fixed it.',
          'Recording a follow-up here does not contact housing.',
          ...(r.urgency === 'emergency' ? [EMERGENCY_GUIDANCE] : []),
        ],
        alternatives: ['Mark it fixed if it already was.', 'Choose a later time to check back.'],
      },
      primary: { label: 'Open the request', kind: 'navigate', target: toHash({ screen: 'housing', id: '' }), requiresConfirmation: false },
    });
  }
  return out;
}
