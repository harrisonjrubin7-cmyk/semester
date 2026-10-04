import { useId, useRef, useState, type ReactNode } from 'react';
import { offlineModeOn, useOnline } from '../lib/offline-mode';
import { createPortal } from 'react-dom';
import { useModal, useScrim } from '../a11y/modal';

/**
 * A preview, then a choice (DESIGN-SYSTEM-IMPROVEMENTS §4.9).
 *
 * For actions that leave something behind or leave Semester — a share, an
 * export, a calendar write, a hand-off to an official system. Irreversible
 * ones stay on `TypeToConfirm`. The preview is the point: it says exactly
 * what will happen, to what, and where, before anything does.
 *
 * `external` is the hand-off tone: it adds the one sentence a student needs
 * before a link takes them out of the app — Semester cannot see or change what
 * happens there.
 *
 * Focus starts on **Cancel**, never on the confirm button, so a stray Enter
 * does nothing. `useModal` traps Tab, closes on Escape and returns focus.
 */
export function ConfirmDialog({
  title,
  preview,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = 'default',
}: {
  title: string;
  preview: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'default' | 'external';
}) {
  const titleId = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  const { ref, onKeyDown } = useModal<HTMLDivElement>({ onClose: onCancel, initial: cancel });
  const scrim = useScrim(onCancel);
  // Offline mode (Phase M): an official hand-off is never queued. Offline, the
  // dialog says so and its confirm does nothing — see lib/offline-mode.ts.
  const online = useOnline();
  const handoffBlocked = tone === 'external' && offlineModeOn() && !online;

  const dialog = (
    <div className="dialog-backdrop" {...scrim}>
      <div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="dialog-title">{title}</h2>
        <div className="dialog-body">
          {preview}
          {tone === 'external' ? (
            <p className="dialog-external">
              You are leaving Semester. Semester cannot see or change what happens there.
            </p>
          ) : null}
          {handoffBlocked ? (
            <p className="dialog-external" role="alert">
              You are offline. Opening an official site needs a connection, so nothing will open and nothing is waiting to.
            </p>
          ) : null}
        </div>
        <div className="dialog-actions">
          <button ref={cancel} type="button" className="explain-close" onClick={onCancel}>Cancel</button>
          <button type="button" className="explain-close dialog-confirm" onClick={onConfirm} disabled={handoffBlocked}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
  const host = typeof document === 'undefined' ? null : document.querySelector('.device');
  return host ? createPortal(dialog, host) : dialog;
}

/** A pending confirmation: the constitution's preview-then-choice, before anything moves. */
export interface Asking {
  title: string;
  preview: ReactNode;
  confirmLabel: string;
  run: () => Promise<void>;
}

/**
 * `confirmFirst` opens the dialog; confirming runs the write. The dialog closes first,
 * so a slow answer never leaves a confirm button to be pressed twice.
 */
export function useConfirm(): { confirmFirst: (a: Asking) => void; dialog: ReactNode } {
  const [asking, setAsking] = useState<Asking | null>(null);
  const dialog = asking ? (
    <ConfirmDialog
      title={asking.title}
      preview={asking.preview}
      confirmLabel={asking.confirmLabel}
      onCancel={() => setAsking(null)}
      onConfirm={() => {
        const run = asking.run;
        setAsking(null);
        void run();
      }}
    />
  ) : null;
  return { confirmFirst: setAsking, dialog };
}
