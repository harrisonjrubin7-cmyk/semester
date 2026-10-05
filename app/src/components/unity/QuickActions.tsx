import { SESSION_MINUTES } from '../../lib/unity';
import { useStore } from '../../state/store';
import { useWorkspaceMode } from './modes';

/**
 * The palette's quick actions — the command half of ⌘K / Ctrl+K.
 *
 * `Command.tsx` refuses a verb palette for a reason worth keeping: an action
 * that changes data has to show what it will do before it does it, and a
 * list that mixes "go to the calendar" with "delete this course" is one wrong
 * Enter from a loss. So these are only the actions that change nothing you
 * cannot see and undo at once — opening the capture sheet (which previews
 * and asks for Save), starting a timer (which can be stopped), and switching
 * Focus mode (which is presentation). Nothing here deletes, submits or shares.
 *
 * The same chips on a phone, where the full-screen search page is the
 * palette: the brief's "phone equivalent via full-screen search and
 * quick-action chips".
 */
export function QuickActions({ onDone }: { onDone: () => void }) {
  const { dispatch } = useStore();
  const mode = useWorkspaceMode();
  const actions: { label: string; run: () => void }[] = [
    {
      label: 'Capture something',
      // The same box the header's + opens — one launcher, however it is
      // reached. Its "Or keep it as" row is the way to the other kinds.
      run: () => {
        onDone();
        dispatch({ type: 'quickAdd', open: true });
      },
    },
    {
      label: `Start a ${SESSION_MINUTES}-minute focus session`,
      run: () => {
        dispatch({ type: 'addTimer', label: 'Focus session', seconds: SESSION_MINUTES * 60, at: Date.now() });
        onDone();
      },
    },
    {
      label: mode === 'focused' ? 'Leave Focus mode' : 'Turn on Focus mode',
      run: () => {
        dispatch({ type: 'setLook', look: { workspaceMode: mode === 'focused' ? 'guided' : 'focused' } });
        onDone();
      },
    },
  ];
  return (
    <div className="quick-actions" role="group" aria-label="Quick actions">
      <span className="kicker">Quick actions</span>
      <div className="quick-actions-row">
        {actions.map((a) => (
          <button key={a.label} type="button" className="pill-soft tap-y" onClick={a.run}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
