import { EVENT_KINDS } from '../lib/kinds';
import { CLASS_TINT } from '../lib/kinds';

/**
 * What the colours mean.
 *
 * The month calendar shipped for a year drawing three different marks and
 * explaining none of them, which made the whole grid decorative. Not repeating
 * that: a grid that colours by category needs its key on the same screen.
 */
export function KindKey({ compact = false }: { compact?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '5px 12px',
        marginTop: compact ? 8 : 10,
        fontSize: 10,
        fontFamily: 'var(--font-heading)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        opacity: 0.55,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 3, height: 10, background: CLASS_TINT, flex: 'none' }} />
        Class
      </span>
      {EVENT_KINDS.map((k) => (
        <span key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 3, height: 10, background: k.tint, flex: 'none' }} />
          {k.label}
        </span>
      ))}
    </div>
  );
}
