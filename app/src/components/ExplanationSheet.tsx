import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModal, useScrim } from '../a11y/modal';
import type { Action } from '../lib/actions';
import { DESKTOP, useMedia } from '../lib/media';
import { SourceBadge } from './SourceBadge';

/**
 * "Why this?" — every field of an action's explanation, in a fixed order.
 *
 * One component, two shapes, because the question is the same at every
 * width and the answer should not read differently on a phone:
 *
 * - **Under 1200px, a bottom sheet.** A modal dialog over a wash, portalled
 *   into `.device` like `TileSheet`, trapped by `useModal` (Escape closes,
 *   focus returns to whatever opened it). The handle is drawn but is not the
 *   way out — the Close button is, because a drag is never the only route
 *   (`a11y/dragging.test.ts`).
 * - **At 1200px and wider, a drawer.** Docked on the right and deliberately
 *   *not* modal: the page beside it stays usable, which is the reason to have
 *   the width. Escape still closes it, and focus still goes back.
 *
 * The first heading takes focus on open, so a screen reader starts at "Why
 * now?" rather than at the top of the page.
 */
export function ExplanationSheet({
  action,
  ranking,
  onClose,
  children,
}: {
  action: Action;
  /** "How it was ranked", in words, when the caller has the score's parts. */
  ranking?: string;
  onClose: () => void;
  /** Snooze, dismiss, correct — whatever the caller offers. */
  children?: ReactNode;
}) {
  const wide = useMedia(DESKTOP);
  const headingId = useId();
  const first = useRef<HTMLHeadingElement>(null);
  const { ref: modalRef, onKeyDown: modalKeys } = useModal<HTMLDivElement>({ onClose, initial: first, on: !wide });
  const scrim = useScrim(onClose);
  const e = action.explanation;

  // The drawer is not a dialog, so `useModal` does not manage it: take focus
  // on open and give it back on close by hand.
  useEffect(() => {
    if (!wide) return undefined;
    const came = document.activeElement as HTMLElement | null;
    first.current?.focus();
    return () => {
      if (came && came.isConnected) came.focus();
    };
  }, [wide]);

  const body = (
    <>
      <div className="explain-head">
        <h2 id={headingId} className="explain-title">{action.title}</h2>
        <button type="button" className="explain-close" onClick={onClose}>Close</button>
      </div>
      <div className="explain-body">
        <h3 ref={first} tabIndex={-1}>Why now?</h3>
        <p>{e.trigger}</p>
        <h3>Why this?</h3>
        <p>{action.whyItMatters}</p>
        <h3>Based on</h3>
        <ul>
          <li>
            <span>{action.source.system}</span> <SourceBadge label={action.source.label} at={action.source.at ?? undefined} />
          </li>
          {e.factors.map((f) => <li key={f}>{f}</li>)}
        </ul>
        {(action.source.authority || action.source.dataOwner || action.source.correctionRoute || action.source.officialFallback) ? (
          <dl className="explain-source-details">
            {action.source.authority ? <><dt>Authority</dt><dd>{action.source.authority}</dd></> : null}
            {action.source.dataOwner ? <><dt>Data owner</dt><dd>{action.source.dataOwner}</dd></> : null}
            {action.source.correctionRoute ? <><dt>Correction route</dt><dd>{action.source.correctionRoute}</dd></> : null}
            {action.source.officialFallback ? <><dt>Official fallback</dt><dd>{action.source.officialFallback}</dd></> : null}
          </dl>
        ) : null}
        <h3>What it changes</h3>
        <p>{e.expectedImpact}</p>
        <h3>What Semester can’t tell you</h3>
        <ul>{e.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        <h3>Other options</h3>
        <ul>{e.alternatives.map((a) => <li key={a}>{a}</li>)}</ul>
        {ranking ? (
          <>
            <h3>How it was ranked</h3>
            <p>{ranking}</p>
          </>
        ) : null}
        {children ? <div className="explain-controls">{children}</div> : null}
      </div>
    </>
  );

  const escape = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      onClose();
    }
  };

  const host = typeof document === 'undefined' ? null : document.querySelector('.device');

  if (wide) {
    const aside = (
      <aside className="explain-drawer" aria-labelledby={headingId} onKeyDown={escape}>
        {body}
      </aside>
    );
    return host ? createPortal(aside, host) : aside;
  }

  const sheet = (
    <div className="explain-wash" {...scrim}>
      <div
        ref={modalRef}
        className="explain-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={modalKeys}
        onClick={(ev) => ev.stopPropagation()}
      >
        <span className="explain-handle" aria-hidden="true" />
        {body}
      </div>
    </div>
  );
  return host ? createPortal(sheet, host) : sheet;
}
