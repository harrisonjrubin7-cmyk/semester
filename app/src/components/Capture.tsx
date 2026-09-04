import { useEffect, useRef, useState } from 'react';
import { Blueprint } from './Blueprint';
import { Plus } from './Icons';
import { MAX_SHOTS, toShots, weigh, type ShotFile } from '../lib/shots';

/**
 * Photograph the board, or pick from the camera roll.
 *
 * Two buttons rather than one, because they are two different intentions and
 * the browser distinguishes them: `capture="environment"` on a file input opens
 * the rear camera straight away on a phone, and the same input without it opens
 * the photo library. On a laptop the first falls back to the file picker, which
 * is the right thing there.
 *
 * Nothing is uploaded by this component. It hands back prepared shots — resized
 * and re-encoded — and the screen using it decides what to do with them.
 */
export function Capture({
  shots,
  onChange,
  label = 'Photograph it',
}: {
  shots: ShotFile[];
  onChange: (next: ShotFile[]) => void;
  label?: string;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const roll = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Thumbnails are object URLs; letting them accumulate leaks memory on a
  // screen somebody keeps adding to.
  useEffect(() => {
    return () => {
      for (const s of shots) {
        if (s.preview.startsWith('blob:')) URL.revokeObjectURL(s.preview);
      }
    };
  }, [shots]);

  const take = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    setErrors([]);
    const room = MAX_SHOTS - shots.length;
    const chosen = [...list].slice(0, Math.max(0, room));
    const { shots: made, errors: failed } = await toShots(chosen);
    if (list.length > room) {
      failed.push(`Only ${MAX_SHOTS} photos go in one batch — the rest were left out.`);
    }
    setErrors(failed);
    onChange([...shots, ...made]);
    setBusy(false);
  };

  const drop = (i: number) => onChange(shots.filter((_, k) => k !== i));

  return (
    <>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          void take(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={roll}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          void take(e.target.files);
          e.target.value = '';
        }}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || shots.length >= MAX_SHOTS}
          onClick={() => camera.current?.click()}
          style={{
            flex: 1,
            height: 42,
            fontSize: 'calc(11px * var(--text-scale, 1))',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
          }}
        >
          <Plus size={14} />
          {busy ? 'Reading…' : label}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || shots.length >= MAX_SHOTS}
          onClick={() => roll.current?.click()}
          style={{
            flex: 1,
            height: 42,
            fontSize: 'calc(11px * var(--text-scale, 1))',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          From photos
        </button>
      </div>

      {shots.length > 0 && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              gap: 8,
              marginTop: 12,
            }}
          >
            {shots.map((s, i) => (
              <button
                key={`${s.name}-${i}`}
                type="button"
                className="bare"
                onClick={() => drop(i)}
                title={`${s.name} — tap to remove`}
                aria-label={`Remove ${s.name}`}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  border: '1px solid var(--app-line)',
                  borderRadius: 'var(--r-sm)',
                  overflow: 'hidden',
                  padding: 0,
                }}
              >
                <img
                  src={s.preview}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    inset: 'auto 0 0 0',
                    background: 'rgba(0,0,0,.65)',
                    fontSize: 'calc(9px * var(--text-scale, 1))',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    padding: '2px 0',
                    textAlign: 'center',
                  }}
                >
                  Remove
                </span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 8 }}>
            {shots.length} of {MAX_SHOTS} · about {weigh(shots)} KB after resizing
          </div>
        </>
      )}

      {errors.length > 0 && (
        <Blueprint plain style={{ padding: '10px 12px', marginTop: 10 }}>
          {errors.map((e) => (
            <div
              key={e}
              style={{ fontSize: 'calc(12px * var(--text-scale, 1))', color: 'var(--app-accent)', lineHeight: 1.45, marginTop: 2 }}
            >
              {e}
            </div>
          ))}
        </Blueprint>
      )}
    </>
  );
}
