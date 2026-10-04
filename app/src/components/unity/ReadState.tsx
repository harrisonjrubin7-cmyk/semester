import type { ReactNode } from 'react';
import { present, type ReadEnvelope } from '../../lib/read/envelope';
import { isSourceLabel } from '../../lib/source';
import { EmptyState } from '../ui';
import { SourceBadge } from '../SourceBadge';
import { ErrorState, LoadingState, OfflineStrip, PermissionNotice } from './States';

/**
 * Draws a `ReadEnvelope` — the one place a data-backed screen turns a state
 * into words.
 *
 * The decision about *what may be claimed* is `present()` in
 * `lib/read/envelope.ts`; this only draws it, reusing the state components
 * the app already has so there is one look for each state. Every surface says
 * what happened in words, offers a way on when the envelope carries one, and
 * keeps the source beside the content (text, never colour alone).
 */
export function ReadState<T>({
  env,
  now,
  what,
  empty,
  emptyNode,
  inset = false,
  onRecover,
  children,
}: {
  env: ReadEnvelope<T>;
  now: number;
  /** What is being read, for the sentences: "your reminders". */
  what: string;
  /** The empty state's own words; the envelope's limitations ride beneath it. */
  empty: { title: string; body: string };
  /**
   * The screen's own first-run, when it has a richer one than a title and a
   * sentence. Drawn instead of the plain empty state, with the same trigger.
   */
  emptyNode?: ReactNode;
  /** Side padding for the notes under content, for screens whose content draws edge to edge. */
  inset?: boolean;
  /** Runs a recovery action by its id. Absent means the action is not offered. */
  onRecover?: (action: string) => void;
  children: (data: T) => ReactNode;
}) {
  const p = present(env, now);
  const first = p.recovery[0];
  const recover = first && onRecover ? { label: first.label, run: () => onRecover(first.action) } : undefined;
  const gutter = inset ? { paddingInline: 'calc(18px * var(--density, 1))' } : undefined;
  const notes = p.limitations.map((l) => (
    <p key={l} className="state-body" style={{ fontSize: 'var(--type-sm)', ...gutter }}>
      {l}
    </p>
  ));
  const label = isSourceLabel(env.source.kind) ? env.source.kind : null;
  const badge = label && (
    <div style={gutter}>
      <SourceBadge label={label} at={env.observedAt ? Date.parse(env.observedAt) : null} now={now} unknownAge={!env.observedAt} />
    </div>
  );
  const reference = env.supportReference ?? env.correlationId;

  switch (p.surface) {
    case 'loading':
      return <LoadingState what={what} />;
    case 'denied':
      return (
        <PermissionNotice
          changed={`You can’t see ${what} here.`}
          why="Your access to this has changed or was never granted. Nothing about it is shown."
          control={recover}
        />
      );
    case 'failed':
      return (
        <ErrorState
          title={`${what[0].toUpperCase()}${what.slice(1)} didn’t load.`}
          body="Anything you had written is kept. Try again, and if it keeps happening, quote the reference."
          recover={recover ?? { label: 'Try again', run: () => onRecover?.('retry') }}
          reference={reference}
        />
      );
    case 'empty':
      if (emptyNode !== undefined) return <>{emptyNode}</>;
      return (
        <>
          <EmptyState
            title={empty.title}
            body={empty.body}
            action={recover ? { label: recover.label, onClick: recover.run } : undefined}
          />
          {notes}
          {badge}
        </>
      );
    default: {
      // content | offline | pending | degraded — data first, the notice beside it.
      const lead =
        p.surface === 'offline' ? (
          <OfflineStrip syncs={false} />
        ) : p.surface === 'pending' ? (
          <PermissionNotice changed={`${what[0].toUpperCase()}${what.slice(1)} are waiting for approval.`} why="Nothing here is final until it is approved." />
        ) : p.surface === 'degraded' ? (
          <PermissionNotice
            changed={`${what[0].toUpperCase()}${what.slice(1)} ${
              p.state === 'stale' ? 'may be out of date.' : p.state === 'syncing' ? 'are still updating.' : 'are only partly available.'
            }`}
            why="What you see is the last thing we knew."
            control={recover}
          />
        ) : null;
      return (
        <>
          {lead}
          {p.data !== null && children(p.data)}
          {notes}
          {badge}
        </>
      );
    }
  }
}
