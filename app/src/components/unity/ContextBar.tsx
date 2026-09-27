import type { ReactNode } from 'react';
import type { StatusKey } from '../../lib/status';
import { showSource, type SourceDetail } from '../../lib/unity';
import { SaveState, StatusChip } from './Status';

/**
 * The Semester Context Bar — where you are, in what, on whose authority.
 *
 * The same four lines in every workspace that has a context worth naming:
 *
 *   PSY 101 · Research Methods                     ← context
 *   Statistical analysis report                    ← the object
 *   ◇ Course-provided · Updated today · ✓ Saved    ← source, freshness, save
 *   [Primary action]  Source & details  More…      ← one primary, the rest quieter
 *
 * Not the page header. The header names the *screen*; this names the *thing
 * being worked on*, which on a workspace is more specific and changes without
 * the screen changing. It sits at the top of the workspace's content, scrolls
 * with it, and never sticks — sticky chrome is what obscures focus (WCAG
 * 2.4.11), and the header already sticks.
 *
 * On a phone the rows wrap rather than truncate, so nothing on it is lost to
 * a narrow screen: the source link and the save state are the two things a
 * compact layout is most tempted to drop and the two a student most needs.
 */
export function ContextBar({
  context,
  title,
  statuses = [],
  save,
  source,
  primary,
  secondary,
  children,
  heading,
}: {
  /** The course, project or path this sits in. */
  context?: string;
  title: string;
  /** Source and freshness states, strongest first. */
  statuses?: StatusKey[];
  /** The work's save state, when the work is editable. */
  save?: StatusKey;
  /** What the Source & details drawer shows. Omit only where there is no source. */
  source?: SourceDetail;
  /** `disabled` while the action cannot run — a request already in flight. */
  primary?: { label: string; run: () => void; disabled?: boolean };
  secondary?: { label: string; run: () => void; disabled?: boolean };
  /** Anything further — a menu of advanced actions, disclosed on request. */
  children?: ReactNode;
  /**
   * Draw the title as a heading at this level. The bar replaces a screen's
   * own header on the course, the assignment and the deadline, where the title
   * was already the section's heading; `a11y/landmarks.test.ts` holds one h1
   * per screen, so a bar never takes 1.
   */
  heading?: 2 | 3;
}) {
  return (
    <section className="context-bar" aria-label={context ? `${context}: ${title}` : title}>
      {context && <div className="kicker">{context}</div>}
      {heading === 2 ? (
        <h2 className="context-bar-title">{title}</h2>
      ) : heading === 3 ? (
        <h3 className="context-bar-title">{title}</h3>
      ) : (
        <div className="context-bar-title">{title}</div>
      )}
      {(statuses.length > 0 || save) && (
        <div className="context-bar-states">
          {statuses.map((s) => (
            <StatusChip key={s} status={s} />
          ))}
          {save && <SaveState status={save} />}
        </div>
      )}
      {(primary || secondary || source || children) && (
        <div className="context-bar-actions">
          {primary && (
            <button type="button" className="btn btn-primary" onClick={primary.run} disabled={primary.disabled}>
              {primary.label}
            </button>
          )}
          {secondary && (
            <button type="button" className="btn btn-ghost" onClick={secondary.run} disabled={secondary.disabled}>
              {secondary.label}
            </button>
          )}
          {source && (
            <button type="button" className="bare link-quiet tap-y" onClick={() => showSource(source)}>
              Source &amp; details
            </button>
          )}
          {children}
        </div>
      )}
    </section>
  );
}
