import type { ReactNode } from 'react';

/**
 * The standard states, beside `EmptyState` in `components/ui.tsx`.
 *
 * Empty already had its component and its rule — say what would fill it,
 * and offer it. These are the other four the brief names, built to the same
 * rule: every state says what is happening in words, offers the next useful
 * action, and never carries its meaning in motion or colour alone.
 */

/**
 * Loading — something is on its way, and a reader is told so.
 *
 * The app's screen fallback drew four grey bars with `aria-hidden` and
 * nothing else, so a screen reader heard silence while a screen loaded.
 * This keeps the bars for sighted readers (they hold the layout still, so
 * nothing jumps when content lands) and adds the sentence, in a polite live
 * region, with `aria-busy` on the region being filled.
 *
 * No spinner and no shimmer: a determinate wait gets `Progress` below, and an
 * indeterminate one gets a still placeholder that says what it is waiting for.
 */
export function LoadingState({ what = 'this screen', bars = [62, 30, 96, 96] }: { what?: string; bars?: number[] }) {
  return (
    <div className="state-loading" aria-busy="true">
      <p className="sr-only" role="status">
        Loading {what}…
      </p>
      {bars.map((h, i) => (
        <div key={i} className="state-loading-bar" style={{ height: h }} aria-hidden="true" />
      ))}
    </div>
  );
}

/**
 * Error — what went wrong, in plain words, and the way out.
 *
 * `recover` is required: an error with no recovery action is a dead end,
 * and the brief's rule is that a student can fix a mistake without support.
 * The reference, when there is one, is the thing to quote to support if the
 * recovery does not work. Assertive, because the student needs to hear it
 * before they carry on.
 */
export function ErrorState({
  title,
  body,
  recover,
  secondary,
  reference,
  busy = false,
}: {
  title: string;
  body: string;
  recover: { label: string; run: () => void };
  secondary?: { label: string; run: () => void };
  reference?: string;
  /** While the recovery is already running — a retry that is in flight. */
  busy?: boolean;
}) {
  return (
    <div className="state-error" role="alert">
      <div className="state-title">
        <span className="status-glyph" aria-hidden="true">
          !{' '}
        </span>
        {title}
      </div>
      <p className="state-body">{body}</p>
      <div className="state-actions">
        <button type="button" className="btn btn-primary" onClick={recover.run} disabled={busy}>
          {recover.label}
        </button>
        {secondary && (
          <button type="button" className="btn btn-ghost" onClick={secondary.run}>
            {secondary.label}
          </button>
        )}
      </div>
      {reference && <p className="state-ref nums">Reference: {reference}</p>}
    </div>
  );
}

/**
 * Success, and the milestone — acknowledge it, then point at what is next.
 *
 * Respectful rather than celebratory: no streaks, no ranks, no comparison to
 * anybody else. The brief's example is the whole pattern — "You completed
 * your registration readiness checklist. Next: compare two course options."
 */
export function SuccessState({
  title,
  body,
  next,
}: {
  title: string;
  body?: string;
  next?: { label: string; run: () => void };
}) {
  return (
    <div className="state-success" role="status">
      <div className="state-title">
        <span className="status-glyph" aria-hidden="true">
          ✓{' '}
        </span>
        {title}
      </div>
      {body && <p className="state-body">{body}</p>}
      {next && (
        <p className="state-body">
          Next:{' '}
          <button type="button" className="bare link-quiet tap-y" onClick={next.run}>
            {next.label}
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * A determinate wait — an upload, an import, a long process.
 *
 * A real `<progress>` so assistive tech reads the value, the percentage in
 * words beside it, and Cancel and Retry as buttons with names. `failed`
 * swaps the bar for the reason and the retry; nothing here is conveyed by the
 * bar's colour.
 */
export function Progress({
  label,
  done,
  total,
  onCancel,
  failed,
  onRetry,
  note,
}: {
  label: string;
  done: number;
  total: number;
  onCancel?: () => void;
  failed?: string;
  onRetry?: () => void;
  /** The data or permission note the brief asks for on an upload. */
  note?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const canRetry = Boolean(failed && onRetry);
  return (
    <div className="state-progress">
      <div className="state-progress-head">
        <span>{label}</span>
        <span className="nums">{failed ? 'Stopped' : `${pct}%`}</span>
      </div>
      {failed ? (
        <p className="state-body" role="alert">
          {failed}
        </p>
      ) : (
        <progress className="state-progress-bar" value={done} max={total} aria-label={label} />
      )}
      {note && <p className="state-note">{note}</p>}
      <div className="state-actions">
        {/* The failure itself is announced by the alert above; this is its way out. */}
        {canRetry && (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Retry
          </button>
        )}
        {!failed && onCancel && pct < 100 && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export type StepState = 'waiting' | 'working' | 'done' | 'failed';

const STEP_GLYPH: Record<StepState, string> = { waiting: '○', working: '…', done: '✓', failed: '!' };
const STEP_SAID: Record<StepState, string> = { waiting: 'waiting', working: 'in progress', done: 'done', failed: 'failed' };

/**
 * A process in named steps — "Gathering sources → Drafting → Ready".
 *
 * For AI generation above all: the brief's rule is to show the work being
 * done rather than fake an instant, certain answer. Each step's state is a
 * glyph and a word, and the list is an ordered list so its position is read.
 */
export function StepStatus({ steps, label }: { steps: { label: string; state: StepState }[]; label: string }) {
  return (
    <ol className="state-steps" aria-label={label}>
      {steps.map((s) => (
        <li key={s.label} data-state={s.state} aria-current={s.state === 'working' ? 'step' : undefined}>
          <span className="status-glyph" aria-hidden="true">
            {STEP_GLYPH[s.state]}
          </span>
          {s.label}
          <span className="sr-only"> — {STEP_SAID[s.state]}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * A permission or visibility change — what changed, why, and where to control it.
 */
export function PermissionNotice({
  changed,
  why,
  control,
}: {
  changed: string;
  why: string;
  control?: { label: string; run: () => void };
}) {
  return (
    <div className="state-permission" role="status">
      <div className="state-title">{changed}</div>
      <p className="state-body">{why}</p>
      {control && (
        <button type="button" className="bare link-quiet tap-y" onClick={control.run}>
          {control.label}
        </button>
      )}
    </div>
  );
}

/** An offline strip — says what still works and that work is queued. */
/**
 * `syncs` is whether there is an account copy to catch up with. Without one —
 * sync off in this build, or signed out — everything is on this device already
 * and reconnecting changes nothing, so the strip must not promise a sync.
 */
export function OfflineStrip({
  queued = 0,
  syncs = true,
  children,
}: {
  queued?: number;
  syncs?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="state-offline" role="status">
      <span className="status-glyph" aria-hidden="true">
        ⊘{' '}
      </span>
      You are offline. You can keep working
      {!syncs
        ? '; everything is kept on this device.'
        : queued > 0
          ? ` — ${queued} change${queued === 1 ? '' : 's'} will sync when you are back.`
          : '; changes sync when you are back.'}
      {children}
    </div>
  );
}
