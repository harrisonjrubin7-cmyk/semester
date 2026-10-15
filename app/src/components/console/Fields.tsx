import type { ReactNode } from 'react';
import { PRODUCTION_WRITE_NOTICE } from '../../lib/ops/console';
import type { Environment } from '../../lib/environment';
import { formatDateTime } from '../../lib/locale';

/**
 * The small pieces every console view is made of.
 *
 * `Fields` is a definition list: the context bar, the access basis under a
 * record and the provenance under a figure are all "these named fields, in
 * this order, each with a value", and the order and the names come from
 * `lib/ops/console.ts` rather than from any view. A field with nothing to
 * say still renders, with what it could not read — a missing row is the one
 * thing a test cannot tell from a rendered one.
 */
export function Fields({ label, items }: { label: string; items: readonly { field: string; value: ReactNode }[] }) {
  return (
    <dl aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 'var(--sp-4)', rowGap: 'var(--sp-2)', marginBlock: 0 }}>
      {items.map((it) => (
        <div key={it.field} style={{ display: 'contents' }}>
          <dt style={{ color: 'var(--app-dim)' }}>{it.field}</dt>
          <dd style={{ marginInlineStart: 0, overflowWrap: 'anywhere' }}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A sentence in a table cell.
 *
 * The shared table sets `white-space: nowrap` on every cell, which suits a
 * word or a number and not a sentence: above the tablet edge a long cell has
 * no scroll region in `stack` mode, so it widens the whole page. Prose opts
 * out, and breaks even a long file path, so the column takes the room that is
 * left. `data-prose` is what the console tests look for.
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <span data-prose="" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
      {children}
    </span>
  );
}

/**
 * The line under a write.
 *
 * In production it is `PRODUCTION_WRITE_NOTICE`, word for word. Anywhere else
 * it says which environment the write reaches, because "this will affect a
 * live customer" printed over a staging database is the kind of false alarm
 * that teaches an operator to stop reading the line.
 */
export function WriteNotice({ env }: { env: Environment }) {
  return (
    <p role="note" style={{ marginBlock: 0, color: env === 'Production' ? 'var(--app-fg)' : 'var(--app-dim)' }}>
      <strong>{env === 'Production' ? PRODUCTION_WRITE_NOTICE : `${env} change. This reaches the ${env.toLowerCase()} database, not a customer.`}</strong>
    </p>
  );
}

/** A time for an operator: date and minute, or a plain word when there is none. */
export function when(iso: string | null | undefined, none = 'none'): string {
  if (!iso) return none;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return formatDateTime(at, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** The first characters of a hash, enough to compare by eye. */
export const short = (hash: string | null | undefined, n = 12): string => (hash ? `${hash.slice(0, n)}…` : 'none');

/** What a caught failure says on screen. */
export const said = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback);

/** What every view is handed by the screen. */
export interface ViewProps {
  env: Environment;
  /** A tenant id, or `All`. Nothing outside it is rendered. */
  scope: string;
  /** The current view's text filter — what a saved view keeps. */
  filter: string;
  onStatus: (said: string) => void;
  /** Runs a privileged write, behind the second-factor step when the session is not fresh. */
  privileged: (run: () => Promise<void>) => void;
}

/** Whether a record's tenant is inside the page's scope. */
export const inScope = (scope: string, tenantId: string | null | undefined): boolean => scope === 'All' || tenantId === scope;

/** Whether a record's searchable words match the filter of the current view. */
export function matches(filter: string, ...words: (string | null | undefined)[]): boolean {
  const q = filter.trim().toLowerCase();
  if (!q) return true;
  return words.some((w) => (w ?? '').toLowerCase().includes(q));
}
