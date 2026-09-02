import type { Figure } from '../lib/types';
import { Blueprint } from './Blueprint';
import { Diagram } from './Diagram';

/** One figure, in whichever of the three forms it takes. */
export function FigureCard({ figure, unit }: { figure: Figure; unit?: string }) {
  return (
    <Blueprint style={{ padding: 15 }}>
      {unit && <div className="kicker">{unit}</div>}
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 19,
          lineHeight: 1.15,
          marginTop: 3,
        }}
      >
        {figure.title}
      </div>

      {figure.type === 'bars' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {figure.rows.map((r) => (
            <div key={r.l}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  fontSize: 12,
                  gap: 10,
                }}
              >
                <span style={{ opacity: 0.75 }}>{r.l}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14 }}>
                  {r.v.toLocaleString()}
                  <span style={{ opacity: 0.5, fontSize: 11 }}> {figure.unit}</span>
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--app-track)', marginTop: 3 }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round((r.v / figure.max) * 100))}%`,
                    background: 'var(--chrome)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {figure.type === 'steps' && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12 }}>
          {figure.steps.map((s) => (
            <div key={s.n + s.t} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              <div
                style={{
                  width: 40,
                  flex: 'none',
                  border: '1px solid var(--app-line)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 13,
                  color: 'var(--app-accent)',
                  alignSelf: 'flex-start',
                  padding: '6px 0',
                }}
              >
                {s.n}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, lineHeight: 1.2 }}>
                  {s.t}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.72,
                    lineHeight: 1.4,
                    marginTop: 2,
                    textWrap: 'pretty',
                  }}
                >
                  {s.d}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {figure.type === 'diagram' && <Diagram kind={figure.kind} />}

      <div
        style={{
          fontSize: 12,
          opacity: 0.6,
          lineHeight: 1.45,
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid var(--app-line)',
          textWrap: 'pretty',
        }}
      >
        {figure.caption}
      </div>
    </Blueprint>
  );
}
