import { useEffect, useState } from 'react';
import type { Figure } from '../lib/types';
import { getFile } from '../lib/files';
import { Blueprint } from './Blueprint';
import { Diagram } from './Diagram';

/**
 * A picture you attached. The bytes live in IndexedDB, so the object URL is
 * made when the card mounts and revoked when it goes — a figure list of twenty
 * photographs should not hold twenty blobs open for the session.
 */
function StoredImage({ fileId, alt }: { fileId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let revoke: string | null = null;
    let live = true;
    getFile(fileId)
      .then((record) => {
        if (!record) {
          if (live) setMissing(true);
          return;
        }
        revoke = URL.createObjectURL(record.blob);
        if (live) setUrl(revoke);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [fileId]);

  if (missing) {
    return (
      <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55, marginTop: 12 }}>
        The file behind this figure is no longer on the device.
      </div>
    );
  }
  if (!url) return <div style={{ height: 120, background: 'var(--app-track)', marginTop: 12 }} />;
  return (
    <img
      src={url}
      alt={alt}
      style={{ width: '100%', display: 'block', marginTop: 12, border: '1px solid var(--app-line)' }}
    />
  );
}

/** One figure, in whichever of the three forms it takes. */
export function FigureCard({ figure, unit }: { figure: Figure; unit?: string }) {
  return (
    <Blueprint style={{ padding: 15 }}>
      {unit && <div className="kicker">{unit}</div>}
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'calc(19px * var(--text-scale, 1))',
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
                  fontSize: 'calc(12px * var(--text-scale, 1))',
                  gap: 10,
                }}
              >
                <span style={{ opacity: 0.75 }}>{r.l}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(14px * var(--text-scale, 1))' }}>
                  {r.v.toLocaleString()}
                  <span style={{ opacity: 0.5, fontSize: 'calc(11px * var(--text-scale, 1))' }}> {figure.unit}</span>
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
                  fontSize: 'calc(13px * var(--text-scale, 1))',
                  color: 'var(--app-accent)',
                  alignSelf: 'flex-start',
                  padding: '6px 0',
                }}
              >
                {s.n}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(16px * var(--text-scale, 1))', lineHeight: 1.2 }}>
                  {s.t}
                </div>
                <div
                  style={{
                    fontSize: 'calc(13px * var(--text-scale, 1))',
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

      {figure.type === 'image' && <StoredImage fileId={figure.fileId} alt={figure.title} />}

      <div
        style={{
          fontSize: 'calc(12px * var(--text-scale, 1))',
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
