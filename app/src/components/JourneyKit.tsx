import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import { OFFICES, officeUrl, type OfficeId } from '../lib/offices';
import type { Screen } from '../lib/types';

/**
 * The pieces Launchpad, Support, Opportunities and the notices hub share.
 *
 * Three ideas, drawn the same way on every screen so a student learns them
 * once: the door to an office (who decides, and how to get there), a checklist
 * that can show one step at a time, and the list of things a screen will never
 * do. Classes live in `styles/app.css` under `.jx-`.
 */

/** Which office decides this, and the door to it — or an honest "not known". */
export function OfficeDoor({ office, compact = false }: { office: OfficeId; compact?: boolean }) {
  const { state } = useStore();
  const o = OFFICES[office];
  const url = officeUrl(office, state.linkUrls);
  return (
    <span className="jx-door">
      <span className="jx-door-name">{o.name}</span>
      {compact ? null : <span className="jx-door-decides">{o.decides}</span>}
      {url ? (
        <a className="jx-door-link" href={url} target="_blank" rel="noreferrer">
          Open {o.name} ↗
        </a>
      ) : (
        <span className="jx-door-none">Find {o.name.toLowerCase()} on your school’s site.</span>
      )}
    </span>
  );
}

/** A button that moves to another screen in this app. */
export function GoTo({ screen, children }: { screen: Screen; children: ReactNode }) {
  const { dispatch } = useStore();
  return (
    <button type="button" className="jx-go" onClick={() => dispatch({ type: 'go', screen })}>
      {children} →
    </button>
  );
}

export interface CheckItem {
  id: string;
  title: string;
  detail?: ReactNode;
}

/**
 * A checklist. With `oneAtATime`, the first open step is drawn alone and the
 * rest fold under a count — the "one step at a time" access mode.
 */
export function Checklist({
  items,
  done,
  onToggle,
  oneAtATime,
  label,
}: {
  items: readonly CheckItem[];
  done: (id: string) => boolean;
  onToggle: (id: string) => void;
  oneAtATime: boolean;
  label: string;
}) {
  const open = items.filter((i) => !done(i.id));
  const shown = oneAtATime && open.length ? [open[0]] : items;
  return (
    <div className="jx-list" role="group" aria-label={label}>
      {shown.map((i) => (
        <label key={i.id} className={`jx-check${done(i.id) ? ' jx-check-done' : ''}`}>
          <input type="checkbox" checked={done(i.id)} onChange={() => onToggle(i.id)} aria-label={i.title} />
          <span className="jx-check-body">
            <span className="jx-check-title">{i.title}</span>
            {i.detail ? <span className="jx-check-detail">{i.detail}</span> : null}
          </span>
        </label>
      ))}
      {oneAtATime && open.length > 1 ? (
        <p className="jx-muted">{open.length - 1} more after this one. Turn off “One step at a time” in Appearance to see them all.</p>
      ) : null}
      {oneAtATime && !open.length && items.length ? <p className="jx-muted">All {items.length} done.</p> : null}
    </div>
  );
}

/** The promises a screen makes, drawn where the student can read them. */
export function Never({ items, heading = 'What this never does' }: { items: readonly string[]; heading?: string }) {
  return (
    <aside className="jx-never" aria-label={heading}>
      <div className="jx-never-head">{heading}</div>
      <ul>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </aside>
  );
}

/** A labelled card. */
export function Card({ title, kicker, children }: { title?: ReactNode; kicker?: ReactNode; children: ReactNode }) {
  return (
    <section className="jx-card">
      {kicker ? <div className="kicker">{kicker}</div> : null}
      {title ? <h3 className="jx-card-title">{title}</h3> : null}
      {children}
    </section>
  );
}
