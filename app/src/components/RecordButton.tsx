import { useEffect, useRef, useState } from 'react';
import { Blueprint } from './Blueprint';
import { Recorder, clockOf, micSupported, recordingName } from '../lib/mic';
import { addFile, formatBytes, type FileMeta } from '../lib/files';
import { ActionButton } from './ui';
import {
  Scribe,
  asText,
  explainScribeError,
  liveSupported,
  paragraphs,
  stamp,
  words,
  type Segment,
} from '../lib/transcribe';

/**
 * Record a lecture, and write it down while it happens.
 *
 * The transcript is taken live, alongside the recording, because that is the
 * only kind a browser can produce: there is no offline recogniser you can hand
 * an hour of finished audio to. Running the two together turns that limit into
 * the better feature anyway — you get timestamped text as the class goes on
 * rather than after it, and the audio is kept regardless, so if recognition
 * drops out the recording is still there.
 *
 * What it is not: a court reporter. It mishears technical vocabulary, it does
 * not know who is speaking, and in Chrome the recognition happens on Google's
 * servers rather than on the device. All three are said on the screen, because
 * a transcript you trust more than it deserves is worse than none.
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
  onSaved: (file: FileMeta, seconds: number, transcript: string) => void;
}) {
  const recorder = useRef<Recorder | null>(null);
  const scribe = useRef<Scribe | null>(null);
  const [state, setState] = useState<'idle' | 'recording' | 'paused' | 'saving'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ name: string; size: number; seconds: number } | null>(null);
  const [wantText, setWantText] = useState(liveSupported());
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState('');
  const [scribeNote, setScribeNote] = useState('');
  const [stamps, setStamps] = useState(true);

  // A counter that ticks while recording, and nothing else running otherwise.
  useEffect(() => {
    if (state !== 'recording') return;
    const id = setInterval(() => setSeconds(recorder.current?.elapsed() ?? 0), 500);
    return () => clearInterval(id);
  }, [state]);

  // Hand the microphone back if the screen goes while it is still open.
  useEffect(
    () => () => {
      recorder.current?.release();
      scribe.current?.stop();
    },
    [],
  );

  if (!micSupported()) {
    return (
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 'var(--leading-relaxed)' }}>
        This browser will not give the app a microphone. Safari and Chrome both will — and a page
        served over plain http never does, which is why this needs https.
      </div>
    );
  }

  const start = async () => {
    setError('');
    setSaved(null);
    setSegments([]);
    setInterim('');
    setScribeNote('');
    recorder.current = new Recorder();
    try {
      await recorder.current.start();
      setSeconds(0);
      setState('recording');
      // Started after the recorder, so the timestamps are offsets into the
      // file rather than into the permission prompt.
      if (wantText) {
        scribe.current = new Scribe(
          (segs, saying) => {
            setSegments(segs);
            setInterim(saying);
          },
          (kind) => setScribeNote(explainScribeError(kind)),
        );
        scribe.current.start();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      recorder.current = null;
    }
  };

  const stop = async () => {
    const rec = recorder.current;
    if (!rec) return;
    setState('saving');
    const heard = scribe.current?.stop() ?? [];
    scribe.current = null;
    setSegments(heard);
    setInterim('');
    try {
      const got = await rec.stop();
      const ext = got.mime.includes('mp4') ? 'm4a' : got.mime.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([got.blob], `${recordingName(label)}.${ext}`, { type: got.mime });
      const meta = await addFile(file, courseId);
      setSaved({ name: meta.name, size: meta.size, seconds: got.seconds });
      onSaved(meta, got.seconds, asText(paragraphs(heard), stamps));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setState('idle');
      recorder.current = null;
    }
  };

  return (
    <>
      {state === 'idle' && liveSupported() && (
        <label
          style={{
            display: 'flex',
            gap: 9,
            alignItems: 'flex-start',
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            lineHeight: 'var(--leading-normal)',
            marginBottom: 'var(--sp-5)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={wantText}
            onChange={(e) => setWantText(e.target.checked)}
            style={{ marginTop: 'var(--sp-1)', flex: 'none' }}
          />
          <span style={{ opacity: 0.75 }}>
            Write it down as it goes. Live only — the recogniser has to hear the speech happening,
            so this cannot be run on the file afterwards. It mishears technical words, it does not
            know who is talking, and in Chrome the audio goes to Google to be recognised.
          </span>
        </label>
      )}

      {state === 'idle' && !liveSupported() && (
        <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55, marginBottom: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
          This browser has no speech recognition, so this records audio only. Chrome and Safari
          will write it down as it goes; Firefox will not.
        </div>
      )}

      {state === 'idle' && (
        <ActionButton
          onClick={() => void start()}
          style={{ fontSize: 'var(--type-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}
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
          {wantText && liveSupported() ? 'Record and transcribe' : 'Record audio'}
        </ActionButton>
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
              style={{ fontSize: 'calc(22px * var(--text-scale, 1))', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
            >
              {clockOf(seconds)}
            </span>
            <span style={{ flex: 1, fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6 }}>
              {state === 'saving' ? 'Saving…' : state === 'paused' ? 'Paused' : 'Recording'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
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
              style={{ flex: 1, height: 40, fontSize: 'var(--type-xs)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              {state === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={state === 'saving'}
              onClick={() => void stop()}
              style={{ flex: 1, height: 40, fontSize: 'var(--type-xs)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              Stop and keep
            </button>
          </div>

          {wantText && (segments.length > 0 || interim) && (
            <div
              style={{
                marginTop: 'var(--sp-6)',
                paddingTop: 11,
                borderTop: '1px solid var(--app-line)',
                maxHeight: 190,
                overflowY: 'auto',
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                lineHeight: 'var(--leading-relaxed)',
              }}
            >
              {paragraphs(segments).slice(-6).map((seg) => (
                <p key={`${seg.at}-${seg.text.length}`} style={{ margin: '0 0 8px' }}>
                  <span style={{ opacity: 0.4, fontVariantNumeric: 'tabular-nums' }}>
                    {stamp(seg.at)}{' '}
                  </span>
                  {seg.text}
                </p>
              ))}
              {interim && <p style={{ margin: 0, opacity: 0.45 }}>{interim}…</p>}
            </div>
          )}

          {wantText && segments.length === 0 && !interim && (
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.45, marginTop: 11 }}>
              Listening. Words appear here as they are recognised.
            </div>
          )}

          {scribeNote && (
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', marginTop: 'var(--sp-5)', opacity: 0.7, lineHeight: 'var(--leading-normal)' }}>
              {scribeNote}
            </div>
          )}
        </Blueprint>
      )}

      {saved && segments.length > 0 && (
        <div style={{ marginTop: 'var(--sp-6)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 'var(--sp-5)',
              marginBottom: 'var(--sp-3)',
            }}
          >
            <span className="kicker">Transcript · {words(segments)} words</span>
            <button
              type="button"
              className="bare"
              onClick={() => setStamps((on) => !on)}
              style={{ fontSize: 'var(--type-xs)', letterSpacing: '0.08em', opacity: 0.65, width: 'auto' }}
            >
              {stamps ? 'HIDE TIMES' : 'SHOW TIMES'}
            </button>
          </div>
          <textarea
            className="input"
            readOnly
            value={asText(paragraphs(segments), stamps)}
            style={{ width: '100%', minHeight: 150, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
          />
          <ActionButton
            onClick={() => {
            void navigator.clipboard
            .writeText(asText(paragraphs(segments), stamps))
            .catch(() => setError('The browser would not give the app the clipboard.'));
            }}
            style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--type-xs)' }}
          >
            Copy the transcript
          </ActionButton>
        </div>
      )}

      {saved && (
        <div style={{ fontSize: 'var(--type-sm)', opacity: 0.65, marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-relaxed)' }}>
          Kept {saved.name} — {clockOf(saved.seconds)}, {formatBytes(saved.size)}. It plays from
          Mine → Files, and it stays on this device.
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            color: 'var(--app-accent)',
            marginTop: 'var(--sp-5)',
            lineHeight: 'var(--leading-normal)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}
