import { useEffect, useRef, useState } from 'react';
import { Blueprint } from './Blueprint';
import { Recorder, clockOf, micSupported, recordingName } from '../lib/mic';
import { addFile, formatBytes, type FileMeta } from '../lib/files';

/**
 * Record a lecture, and keep the file.
 *
 * Says what it is up front, because the obvious expectation is wrong: this
 * captures audio, it does not transcribe it. A browser cannot turn an hour of
 * recorded speech into text on its own, and anything that appeared to would be
 * uploading a professor's voice somewhere. Dictation — live speech to text — is
 * a different feature on the note editor, where it belongs.
 *
 * The permission is asked for when you press record, never before.
 */
export function RecordButton({
  courseId,
  label,
  onSaved,
}: {
  courseId: string | null;
  /** Used to name the file — a course code, or a note's title. */
  label: string;
  onSaved: (file: FileMeta, seconds: number) => void;
}) {
  const recorder = useRef<Recorder | null>(null);
  const [state, setState] = useState<'idle' | 'recording' | 'paused' | 'saving'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ name: string; size: number; seconds: number } | null>(null);

  // A counter that ticks while recording, and nothing else running otherwise.
  useEffect(() => {
    if (state !== 'recording') return;
    const id = setInterval(() => setSeconds(recorder.current?.elapsed() ?? 0), 500);
    return () => clearInterval(id);
  }, [state]);

  // Hand the microphone back if the screen goes while it is still open.
  useEffect(() => () => recorder.current?.release(), []);

  if (!micSupported()) {
    return (
      <div style={{ fontSize: 12.5, opacity: 0.6, lineHeight: 1.5 }}>
        This browser will not give the app a microphone. Safari and Chrome both will — and a page
        served over plain http never does, which is why this needs https.
      </div>
    );
  }

  const start = async () => {
    setError('');
    setSaved(null);
    recorder.current = new Recorder();
    try {
      await recorder.current.start();
      setSeconds(0);
      setState('recording');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      recorder.current = null;
    }
  };

  const stop = async () => {
    const rec = recorder.current;
    if (!rec) return;
    setState('saving');
    try {
      const got = await rec.stop();
      const ext = got.mime.includes('mp4') ? 'm4a' : got.mime.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([got.blob], `${recordingName(label)}.${ext}`, { type: got.mime });
      const meta = await addFile(file, courseId);
      setSaved({ name: meta.name, size: meta.size, seconds: got.seconds });
      onSaved(meta, got.seconds);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setState('idle');
      recorder.current = null;
    }
  };

  return (
    <>
      {state === 'idle' && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => void start()}
          style={{
            height: 44,
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--app-accent)',
              flex: 'none',
            }}
          />
          Record audio
        </button>
      )}

      {(state === 'recording' || state === 'paused' || state === 'saving') && (
        <Blueprint style={{ padding: '13px 14px', background: 'var(--app-hero)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: state === 'recording' ? 'var(--app-accent)' : 'var(--app-track)',
                flex: 'none',
              }}
            />
            <span
              className="chrome-text"
              style={{ fontSize: 22, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
            >
              {clockOf(seconds)}
            </span>
            <span style={{ flex: 1, fontSize: 11.5, opacity: 0.6 }}>
              {state === 'saving' ? 'Saving…' : state === 'paused' ? 'Paused' : 'Recording'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={state === 'saving'}
              onClick={() => {
                if (state === 'recording') {
                  recorder.current?.pause();
                  setState('paused');
                } else {
                  recorder.current?.resume();
                  setState('recording');
                }
              }}
              style={{ flex: 1, height: 40, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              {state === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={state === 'saving'}
              onClick={() => void stop()}
              style={{ flex: 1, height: 40, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Stop and keep
            </button>
          </div>
        </Blueprint>
      )}

      {saved && (
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 10, lineHeight: 1.5 }}>
          Kept {saved.name} — {clockOf(saved.seconds)}, {formatBytes(saved.size)}. It plays from
          Mine → Files, and it stays on this device.
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--app-accent)',
            marginTop: 10,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}
