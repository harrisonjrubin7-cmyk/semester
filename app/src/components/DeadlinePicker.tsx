import { useMemo } from 'react';
import { useStore } from '../state/store';
import { datedItems } from '../lib/select';
import { pickable } from '../lib/forwork';
import { secondLine } from '../lib/dim';

/** Eight, which is most courses' whole term and a heavy one's next two months. */
const VISIBLE = 8;

/**
 * Which deadline a thing is for, or none.
 *
 * The other half of `CoursePicker`, and it sits directly under it on every
 * screen that makes something. A course was as far as the app could go in
 * saying what a document was for, and a course is a term wide — so six
 * documents called "Draft" were filed identically and the only way back to the
 * right one was to open them.
 *
 * ## Why it only appears once a course is chosen
 *
 * A deadline belongs to a course, so the honest options for "Personal" are
 * none. Drawing an empty row, or a disabled control, would be the screen
 * advertising something it cannot do; drawing every deadline in the term would
 * be forty-odd chips, which stops being a control at about eight. So it is
 * absent until there is a course, and it appears the moment one is picked —
 * `pickable` in `lib/forwork.ts` decides the order, and returns nothing for a
 * null course so this can simply not render.
 *
 * It is also absent for a course with no deadlines at all, which is a real
 * state: a course added by hand, or one whose syllabus had no dated work in
 * it. A heading over an empty row is worse than no heading.
 *
 * ## The cap, and the "show all" that lifts it
 *
 * Eight chips by default, which covers the whole term for most courses and the
 * next two months for a heavy one. Where there are more, the rest are one tap
 * away rather than gone: a paper being finished three weeks late still has to
 * be filable against the thing it is late for.
 */
export function DeadlinePicker({
  courseId,
  value,
  onChange,
  showAll,
  onShowAll,
  style,
}: {
  /** The course the thing is filed against. Nothing is drawn for null. */
  courseId: string | null;
  value: string | null | undefined;
  onChange: (itemId: string | null) => void;
  /**
   * Whether the cap has been lifted, held by the caller.
   *
   * State rather than an internal `useState`, because the screens that draw
   * this also unmount it when the course changes, and a cap that silently
   * re-applied itself would be the list closing under somebody's hand. A
   * caller with no interest in the cap passes neither and gets the first
   * eight with a count of the rest.
   */
  showAll?: boolean;
  onShowAll?: () => void;
  style?: React.CSSProperties;
}) {
  const { catalog, now } = useStore();
  const options = useMemo(() => pickable(datedItems(catalog, now), courseId), [catalog, now, courseId]);

  if (options.length === 0) return null;

  const capped = showAll ? options : options.slice(0, VISIBLE);
  const hidden = options.length - capped.length;
  /*
   * A value pointing at a deadline that is not in the list.
   *
   * Two ways to get here and both are ordinary: the course was changed under a
   * document that was already filed against a deadline of the old one, and a
   * deadline that has been edited out of the course since. Either way the
   * chips would draw with nothing selected while the thing still claimed to be
   * filed — so the row says so, in the one place somebody can act on it.
   */
  const stray = value != null && !options.some((o) => o.id === value);

  return (
    <div style={{ marginTop: 'var(--sp-5)', ...style }}>
      {/* The kicker's own size is unscaled in `app.css`; the token is the
          same step and answers to the Text size setting, which every label in
          this app has to. */}
      <div className="kicker" style={{ fontSize: 'var(--type-xs)', marginBottom: 'var(--sp-3)' }}>
        What it is for
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <Chip on={value == null && !stray} onClick={() => onChange(null)}>
          Nothing in particular
        </Chip>
        {capped.map((o) => (
          <Chip
            key={o.id}
            on={value === o.id}
            /* The date as well as the title, because "Response paper" is the
               name of four things in a term and the day is what tells them
               apart. `dueShort` is already "Fri Sep 25" or "Tomorrow". */
            hint={o.dueShort}
            onClick={() => onChange(o.id)}
          >
            {o.title}
          </Chip>
        ))}
        {hidden > 0 && (
          <button
            type="button"
            className="bare tappable"
            onClick={onShowAll}
            style={{
              width: 'auto',
              padding: 'var(--sp-3) var(--sp-5)',
              fontSize: 'var(--type-sm)',
              ...secondLine(),
            }}
          >
            {hidden} more
          </button>
        )}
      </div>
      {stray && (
        <div
          style={{
            fontSize: 'var(--type-xs)',
            ...secondLine(),
            marginTop: 'var(--sp-4)',
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          This was filed against a deadline that is not in this course. Pick one here, or
          Nothing in particular, to settle it.
        </div>
      )}
    </div>
  );
}

/**
 * One chip, with a second line under the name.
 *
 * Not `PickChips`: that draws one line of text per option and every deadline
 * needs two, because the name alone does not identify one. Close to it on
 * purpose — the same border, radius and pressed treatment — so the two read as
 * the same control wherever they sit near each other.
 */
function Chip({
  on,
  hint,
  onClick,
  children,
}: {
  on: boolean;
  hint?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="bare tappable"
      aria-pressed={on}
      onClick={onClick}
      style={{
        width: 'auto',
        maxWidth: '100%',
        textAlign: 'left',
        padding: 'var(--sp-3) var(--sp-5)',
        borderRadius: 'var(--r-sm)',
        border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
        fontSize: 'var(--type-sm)',
        lineHeight: 'var(--leading-tight)',
      }}
    >
      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {children}
      </span>
      {hint && (
        <span style={{ display: 'block', fontSize: 'var(--type-xs)', ...secondLine() }}>{hint}</span>
      )}
    </button>
  );
}
