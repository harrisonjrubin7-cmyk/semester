import { useMemo } from 'react';
import { useStore } from '../state/store';
import { asLines, forCourse } from '../lib/sources';

/**
 * "Use my kept sources", wherever a tool asks for them.
 *
 * Four tools in this app refuse to invent a citation and ask for yours. Two
 * of them learned to read the kept list as soon as it existed and two did not,
 * on the reasoning that the deck builder and the practice paper take *material*
 * rather than citations. That is a real distinction and it is not worth two
 * different behaviours: a reading you have kept is exactly the material a deck
 * about it should be built from.
 *
 * So it is one component now rather than a copied block, which is also what
 * stops the fourth copy of it drifting from the first.
 */
export function UseSources({
  courseId,
  onFill,
  label = 'sources',
}: {
  /** Scope to a course, or null for everything you have kept. */
  courseId: string | null;
  /** Given the lines to append; the caller decides where they go. */
  onFill: (lines: string) => void;
  /** What the receiving box holds, for the button's wording. */
  label?: string;
}) {
  const { state, dispatch } = useStore();
  const kept = useMemo(() => forCourse(state.sources, courseId), [state.sources, courseId]);

  if (kept.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => onFill(asLines(kept))}
        style={{ flex: 1, height: 38, fontSize: 12.5 }}
      >
        Use my {kept.length} kept {kept.length === 1 ? label.replace(/s$/, '') : label}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => dispatch({ type: 'go', screen: 'sources' })}
        style={{ flex: 'none', height: 38, fontSize: 12.5 }}
      >
        Manage
      </button>
    </div>
  );
}

/** Append to a box that may already have something in it. */
export function appendTo(current: string, lines: string): string {
  return current.trim() ? `${current.trim()}\n${lines}` : lines;
}
