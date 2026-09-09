import { CLASS_TINT, EVENT_KINDS, kindTint } from '../lib/kinds';
import { useStore } from '../state/store';
import { ground as groundOf, resolveGround } from '../lib/look';
import { usePrefersDark } from '../lib/prefers';

/**
 * What the colours mean.
 *
 * The month calendar shipped for a year drawing three different marks and
 * explaining none of them, which made the whole grid decorative. Not repeating
 * that: a grid that colours by category needs its key on the same screen.
 *
 * Since classes are drawn in their own course's colour rather than in one
 * accent, the key names the courses too — a legend that said "Class" once
 * while the grid drew four different colours would be worse than none. With
 * the setting off there is one class colour again, and the key says so.
 *
 * The courses come first and the kinds after, because that is also the
 * difference the grids draw: a class is filled with its colour, something of
 * yours carries its colour on the edge. Two colours landing near each other on
 * the wheel is possible — there are seven kinds and no promise about where a
 * course falls — and filled-versus-outlined is what still tells them apart
 * when they do.
 */
export function KindKey({ compact = false }: { compact?: boolean }) {
  const { catalog, state, tint } = useStore();
  const byCourse = state.courseColours !== 'off' && !catalog.empty;
  const light = groundOf(resolveGround(state.ground, usePrefersDark())).light;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '5px 12px',
        marginTop: compact ? 8 : 10,
        fontSize: 'calc(10px * var(--text-scale, 1))',
        fontFamily: 'var(--font-heading)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        opacity: 0.55,
      }}
    >
      {/* One list rather than three copies of the same row: the swatch and
          its word are the same shape whether it names a course or a kind. */}
      {[
        ...(byCourse
          ? catalog.courses.map((c) => ({ key: c.id, tint: tint(c.id).fill, label: catalog.short[c.id] }))
          : [{ key: 'class', tint: CLASS_TINT, label: 'Class' }]),
        ...EVENT_KINDS.map((k) => ({ key: k.id, tint: kindTint(k.id, light), label: k.label })),
      ].map((row) => (
        <span key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 3, height: 10, background: row.tint, flex: 'none' }} />
          {row.label}
        </span>
      ))}
    </div>
  );
}
