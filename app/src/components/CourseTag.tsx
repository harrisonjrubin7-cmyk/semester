import type { CSSProperties, ReactNode } from 'react';
import { useStore } from '../state/store';

/**
 * A course code, in that course's colour.
 *
 * The chip is how nearly every list in this app says which class a thing
 * belongs to — a deadline on Today, a reading in the study plan, a cost on the
 * books screen — and there were a dozen hand-written copies of it, all reading
 * `catalog.byId[…]?.code` into a `tag tag-accent`. All twelve were the same
 * silver, so the code was the only thing distinguishing them and the code has
 * to be read.
 *
 * One component instead, so the colour arrives everywhere at once and a screen
 * added next year gets it without knowing it exists. The colour itself comes
 * from the store — see `lib/tint.ts` for what decides it.
 *
 * The code is still written out. Colour is the fast path and not the only one:
 * a screen reader gets the same sentence it always did, and so does anybody
 * who cannot tell two hues apart, which is about one man in twelve.
 */
export function CourseTag({
  id,
  children,
  style,
  title,
}: {
  /** The course. Null or unknown draws the plain accent, as before. */
  id: string | null | undefined;
  /** Overrides the code — used where the chip says a date or a count instead. */
  children?: ReactNode;
  style?: CSSProperties;
  title?: string;
}) {
  const { tint, catalog, courseCode } = useStore();
  const t = tint(id);
  return (
    <span
      className="tag"
      title={title}
      style={{ background: t.wash, color: t.ink, ...style }}
    >
      {children ?? (id ? (catalog.byId[id]?.code ?? courseCode(id)) : '')}
    </span>
  );
}

/**
 * The same fact as a mark rather than a word.
 *
 * For the places a chip does not fit — a rail of five classes, a row already
 * carrying four labels — where the question is only "same course as that
 * one?". Hidden from screen readers on purpose: every one of these sits beside
 * the course's name or code, and a reader announcing "orange square" before it
 * is noise rather than information.
 */
export function CourseDot({
  id,
  size = 8,
  style,
}: {
  id: string | null | undefined;
  size?: number;
  style?: CSSProperties;
}) {
  const { tint } = useStore();
  return (
    <span
      aria-hidden
      style={{
        flex: 'none',
        width: size,
        height: size,
        borderRadius: '50%',
        background: tint(id).fill,
        ...style,
      }}
    />
  );
}
