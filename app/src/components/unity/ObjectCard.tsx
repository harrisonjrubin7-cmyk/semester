import { useId } from 'react';
import type { StatusKey } from '../../lib/status';
import { statusOf } from '../../lib/status';
import { showSource, type SourceDetail } from '../../lib/unity';
import { OpenIn, type OpenTarget } from './OpenIn';

/** The kinds of thing Semester draws as a card. Presentation only — no kind unlocks anything. */
export type ObjectKind =
  | 'assignment'
  | 'course'
  | 'requirement'
  | 'source'
  | 'study'
  | 'opportunity'
  | 'event'
  | 'appointment'
  | 'task';

const KIND_SAID: Record<ObjectKind, string> = {
  assignment: 'Assignment',
  course: 'Course',
  requirement: 'Requirement',
  source: 'Source',
  study: 'Study',
  opportunity: 'Opportunity',
  event: 'Event',
  appointment: 'Appointment',
  task: 'Task',
};

export interface CardAction {
  label: string;
  run: () => void;
}

/**
 * The Universal Object Card — one rhythm for every kind of thing.
 *
 *   OFFICIAL · UPDATED TODAY          ← eyebrow: kind and source/status words
 *   Registration opens tomorrow       ← title (the card's heading)
 *   You have two items left.          ← one line of why it matters
 *   Tue 14 Oct · 9:00                 ← key metadata, tabular figures
 *   [Finish checklist]  View details  ← one primary, one quiet secondary
 *   Source & details · Open in …      ← disclosure, never in the way
 *
 * A decision card, not an information card: the primary action is the
 * reason it is on screen. It is optional only for the rare card whose
 * display *is* the task, and a card without one says so by omission rather
 * than by a dead button.
 *
 * The heading level is a prop because a card is a section of whatever it sits
 * in, and `a11y/landmarks.test.ts` holds one h1 per screen — a card cannot
 * know where it is in the outline.
 */
export function ObjectCard({
  kind,
  title,
  explanation,
  metadata,
  statuses = [],
  primary,
  secondary,
  source,
  openIn = [],
  level = 3,
}: {
  kind: ObjectKind;
  title: string;
  explanation?: string;
  metadata?: string;
  statuses?: StatusKey[];
  primary?: CardAction;
  secondary?: CardAction;
  source?: SourceDetail;
  openIn?: OpenTarget[];
  level?: 2 | 3 | 4;
}) {
  const heading = useId();
  const H = `h${level}` as 'h2' | 'h3' | 'h4';
  const eyebrow = [KIND_SAID[kind], ...statuses.map((s) => statusOf(s).label)].join(' · ');
  const glyphs = statuses.map((s) => statusOf(s).glyph).join(' ');
  return (
    <article className="object-card" data-kind={kind} aria-labelledby={heading}>
      <div className="object-card-eyebrow">
        {glyphs && (
          <span className="status-glyph" aria-hidden="true">
            {glyphs}{' '}
          </span>
        )}
        {eyebrow}
      </div>
      <H id={heading} className="object-card-title">
        {title}
      </H>
      {explanation && <p className="object-card-why">{explanation}</p>}
      {metadata && <p className="object-card-meta nums">{metadata}</p>}
      {/* Detailed mode puts the source's own sentence on the card; the other
          modes keep it one press away, behind Source & details. */}
      {source && (
        <p className="object-card-detail detail-only">
          {statusOf(source.origin).about}
          {source.freshness ? ` ${source.freshness}.` : ''}
        </p>
      )}
      {(primary || secondary) && (
        <div className="object-card-actions">
          {primary && (
            <button type="button" className="btn btn-primary" onClick={primary.run}>
              {primary.label}
            </button>
          )}
          {secondary && (
            <button type="button" className="bare link-quiet tap-y" onClick={secondary.run}>
              {secondary.label}
            </button>
          )}
        </div>
      )}
      {(source || openIn.length > 0) && (
        <div className="object-card-foot">
          {source && (
            <button
              type="button"
              className="bare link-quiet tap-y"
              onClick={() => showSource(source)}
              aria-label={`Source and details for ${title}`}
            >
              Source &amp; details
            </button>
          )}
          <OpenIn targets={openIn} about={title} />
        </div>
      )}
    </article>
  );
}
