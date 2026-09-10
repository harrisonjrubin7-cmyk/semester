import { useEffect, useState } from 'react';
import { Blueprint } from './Blueprint';
import { Plus } from './Icons';
import { FilePick } from './ui';
import { MAX_SHOTS, tooMany, toShots, weigh, type ShotFile } from '../lib/shots';

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

  const take = async (list: File[]) => {
    if (list.length === 0) return;
    setBusy(true);
    setErrors([]);
    const room = MAX_SHOTS - shots.length;
    const chosen = list.slice(0, Math.max(0, room));
    const { shots: made, errors: failed } = await toShots(chosen);
    const over = tooMany(list.length, room);
    if (over) failed.push(over);
    setErrors(failed);
    onChange([...shots, ...made]);
    setBusy(false);
  };

  const drop = (i: number) => onChange(shots.filter((_, k) => k !== i));

  const full = busy || shots.length >= MAX_SHOTS;

  return (
    <>
      {/* Two `FilePick`s rather than two refs and two hidden inputs. The
          difference between them is still the one attribute it always was —
          `capture` opens the rear camera, its absence opens the library — and
          it is now the thing the markup says, rather than which of two
          identical hidden inputs a click was forwarded to. */}
      <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
        <FilePick
          accept="image/*"
          capture="environment"
          multiple={false}
          disabled={full}
          block={false}
          onPick={(picked) => void take(picked)}
          style={{
            flex: 1,
            height: 42,
            fontSize: 'var(--type-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
          }}
        >
          <Plus size={14} />
          {busy ? 'Reading…' : label}
        </FilePick>
        <FilePick
          accept="image/*"
          disabled={full}
          block={false}
          onPick={(picked) => void take(picked)}
          style={{ flex: 1, height: 42, fontSize: 'var(--type-xs)' }}
        >
          From photos
        </FilePick>
      </div>

      {shots.length > 0 && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              gap: 'var(--sp-4)',
              marginTop: 'var(--sp-6)',
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
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-4)' }}>
            {shots.length} of {MAX_SHOTS} · about {weigh(shots)} KB after resizing
          </div>
        </>
      )}

      {errors.length > 0 && (
        <Blueprint plain style={{ padding: '10px 12px', marginTop: 'var(--sp-5)' }} role="alert">
          {errors.map((e) => (
            <div
              key={e}
              style={{ fontSize: 'var(--type-sm)', color: 'var(--app-accent)', lineHeight: 'var(--leading-normal)', marginTop: 'var(--sp-1)' }}
            >
              {e}
            </div>
          ))}
        </Blueprint>
      )}
    </>
  );
}
