import { useEffect, useRef, useState } from 'react';
import { canScan, scanFrame } from '../lib/barcode';

/**
 * Point the camera at the back of a book.
 *
 * Hidden entirely where the browser cannot decode a barcode — the button
 * appears on Chrome and Android and nowhere else, which is better than
 * shipping one that does nothing. The alternative is a megabyte of
 * WebAssembly polyfill for one field, which it is not worth.
 *
 * The camera is released the moment a code is found or the panel is closed.
 * A live camera left running behind a closed panel is a battery drain and,
 * more to the point, a camera light that stays on for no reason a person can
 * see.
 */
export function ScanIsbn({ onFound }: { onFound: (isbn: string) => void }) {
  const [open, setOpen] = useState(false);
  const [trouble, setTrouble] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  // Everything here has to be torn down on the way out, and the effect is the
  // only place that knows both halves.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    let timer = 0;

    const stop = () => {
      alive = false;
      window.clearTimeout(timer);
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };

    const run = async () => {
      try {
        const got = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!alive) {
          got.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = got;
        if (video.current) {
          video.current.srcObject = got;
          await video.current.play();
        }
      } catch {
        setTrouble('No camera, or permission refused. Type the number instead.');
        return;
      }

      const look = async () => {
        if (!alive || !video.current) return;
        const isbn = await scanFrame(video.current);
        if (!alive) return;
        if (isbn) {
          onFound(isbn);
          setOpen(false);
          return;
        }
        // Four times a second is plenty for a barcode held still, and much
        // cheaper than every frame.
        timer = window.setTimeout(() => void look(), 250);
      };
      void look();
    };

    void run();
    return stop;
  }, [open, onFound]);

  if (!canScan()) return null;

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-block"
        onClick={() => {
          setTrouble('');
          setOpen((was) => !was);
        }}
        style={{ height: 38, marginBottom: 8, fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
      >
        {open ? 'Stop scanning' : 'Scan the barcode on the book'}
      </button>

      {open && (
        <div style={{ marginBottom: 8 }}>
          <video
            ref={video}
            muted
            playsInline
            style={{
              width: '100%',
              maxHeight: 200,
              objectFit: 'cover',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--app-line)',
              background: '#000',
            }}
          >
            <track kind="captions" />
          </video>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 6, lineHeight: 1.45 }}>
            {trouble ||
              'Hold the barcode still in frame. The number is read on this device and goes no further — the app does not look it up, because that would mean telling somebody else what you are studying.'}
          </div>
        </div>
      )}
    </>
  );
}
