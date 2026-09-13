import type { ReactNode } from 'react';
import { secondLine } from '../../lib/dim';

/**
 * The control bar, which is the one part of a call app nobody should redesign.
 *
 * A Zoom Room's bar is a row of round buttons with a word under each and one
 * red one on its own: audio, video, share, the rest, end. Every student has
 * used it hundreds of times, and the muscle memory is worth more than any
 * arrangement of this app's own that might be marginally tidier. So the shape
 * is borrowed wholesale — round target, glyph, caption underneath, the leave
 * button separated and red — and only the palette is this app's.
 *
 * Two rows rather than one, because a phone is 390px wide and eleven controls
 * are not. The three that matter during a call are on the first row and the
 * rest wrap under them; nothing is ever hidden behind a "…" that has to be
 * discovered, except the genuinely rare things, which are behind More
 * exactly as they are in the app this is copying.
 */
export function Bar({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 'var(--sp-4)',
        paddingBlock: 'var(--sp-5)',
      }}
    >
      {children}
    </div>
  );
}

/**
 * One round control.
 *
 * `on` is not "enabled" — it is the state the control is *reporting*. Mute is
 * the case that decides the colour rule: a muted microphone is the button
 * lit in the warning colour, because being muted while talking is the single
 * commonest thing to be wrong about in a call, and a control that looked the
 * same either way would be no help at all.
 */
export function Control({
  label,
  icon,
  onClick,
  danger = false,
  warn = false,
  live = false,
  disabled = false,
  pressed,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** The leave button, and only that. */
  danger?: boolean;
  /** Reporting a state somebody would want to notice — muted, camera off. */
  warn?: boolean;
  /** Reporting a state that is on and deliberate — sharing, hand up, a panel. */
  live?: boolean;
  disabled?: boolean;
  pressed?: boolean;
}) {
  const ink = danger ? '#fff' : warn ? 'var(--app-warn)' : live ? 'var(--app-accent)' : undefined;
  return (
    <button
      type="button"
      className="bare tappable"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 62,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        paddingBlock: 'var(--sp-3)',
        opacity: disabled ? 'var(--app-row-dim)' : undefined,
      }}
    >
      <span
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          border: '1px solid var(--app-line)',
          background: danger ? 'var(--app-warn)' : live ? 'var(--app-hero)' : 'transparent',
          color: ink,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          fontSize: 'var(--type-xs)',
          textAlign: 'center',
          lineHeight: 'var(--leading-tight)',
          ...(danger || warn || live ? { color: danger ? 'var(--app-warn)' : ink } : secondLine()),
        }}
      >
        {label}
      </span>
    </button>
  );
}
