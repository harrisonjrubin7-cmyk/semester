import { Suspense, lazy, useEffect, useState } from 'react';
import { secondLine } from '../lib/dim';
import type { Figure } from '../lib/types';
import { getFile } from '../lib/files';
import { Blueprint } from './Blueprint';
import { Diagram } from './Diagram';

/**
 * Lazy for the reason `components/Drawing.tsx` is lazy on the Draw screen:
 * it pulls Mermaid, which is the largest thing in the app, and a course whose
 * figures are all tables should not pay for it. Most guides have no drawn
 * figure at all, and the ones that do load it when the card renders.
 */
const Drawing = lazy(() => import('./Drawing').then((m) => ({ default: m.Drawing })));

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
      <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-6)' }}>
        The file behind this figure is no longer on the device.
      </div>
    );
  }
  if (!url) return <div style={{ height: 120, background: 'var(--app-track)', marginTop: 'var(--sp-6)' }} />;
  return (
    <img
      src={url}
      alt={alt}
      style={{ width: '100%', display: 'block', marginTop: 'var(--sp-6)', border: '1px solid var(--app-line)' }}
    />
  );
}

/** One figure, in whichever of the three forms it takes. */
export function FigureCard({ figure, unit }: { figure: Figure; unit?: string }) {
  return (
    <Blueprint style={{ paddingBlock: 'calc(15px * var(--density, 1))', paddingInline: 'calc(15px * var(--density, 1))' }}>
      {unit && <div className="kicker">{unit}</div>}
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'calc(19px * var(--text-scale, 1))',
          lineHeight: 1.15,
          marginTop: 'calc(3px * var(--density, 1))',
        }}
      >
        {figure.title}
      </div>

      {figure.type === 'bars' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 'calc(14px * var(--density, 1))' }}>
          {figure.rows.map((r) => (
            <div key={r.l}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  fontSize: 'var(--type-sm)',
                  gap: 'var(--sp-5)',
                }}
              >
                <span style={secondLine()}>{r.l}</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-md)' }}>
                  {r.v.toLocaleString()}
                  <span style={{ color: 'var(--app-dim)', fontSize: 'var(--type-xs)' }}> {figure.unit}</span>
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--app-track)', marginTop: 'calc(3px * var(--density, 1))' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'var(--sp-6)' }}>
          {figure.steps.map((s) => (
            <div key={s.n + s.t} style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'stretch' }}>
              <div
                style={{
                  width: 40,
                  flex: 'none',
                  border: '1px solid var(--app-line)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'var(--type-base)',
                  color: 'var(--app-accent)',
                  alignSelf: 'flex-start',
                  padding: '6px 0',
                }}
              >
                {s.n}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: 'var(--sp-6)' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(16px * var(--text-scale, 1))', lineHeight: 1.2 }}>
                  {s.t}
                </div>
                <div
                  style={{
                    fontSize: 'var(--type-base)',
                    color: 'var(--app-dim)',
                    lineHeight: 1.4,
                    marginTop: 'var(--sp-1)',
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

      {figure.type === 'drawn' && (
        <div style={{ marginTop: 'var(--sp-6)' }}>
          <Suspense
            fallback={
              <div
                style={{
                  fontSize: 'var(--type-sm)',
                  color: 'var(--app-dim)',
                  paddingBlock: 'var(--sp-7)',
                }}
              >
                Drawing…
              </div>
            }
          >
            <Drawing code={figure.code} language={figure.language} />
          </Suspense>
          {/*
            Said on the card rather than inferred from how it looks.

            The hand-drawn diagrams are the app's own, checked by a person and
            the same every time they are shown. A count here would rot the next
            time one is added; `DIAGRAM_KINDS` is the list. This one was written to a
            description, by a model, and kept by whoever was reading it — which
            is a weaker claim, and one worth making in the place where somebody
            is deciding how much to trust the picture. `lib/where.ts` makes the
            same argument about a deadline: six kinds of fact in one typeface is
            the failure, and a per-row line is the answer to it.
          */}
          <div
            style={{
              fontSize: 'var(--type-xs)',
              color: 'var(--app-dim)',
              marginTop: 'var(--sp-4)',
              lineHeight: 'var(--leading-normal)',
            }}
          >
            Drawn from a description you gave, not from the guide. Check it against your notes.
          </div>
        </div>
      )}

      <div
        style={{
          fontSize: 'var(--type-sm)',
          color: 'var(--app-dim)',
          lineHeight: 'var(--leading-normal)',
          marginTop: 'var(--sp-6)',
          paddingTop: 'var(--sp-5)',
          borderTop: '1px solid var(--app-line)',
          textWrap: 'pretty',
        }}
      >
        {figure.caption}
      </div>
    </Blueprint>
  );
}
