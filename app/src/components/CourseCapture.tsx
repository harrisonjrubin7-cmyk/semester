import { useEffect, useRef, useState } from 'react';
import { FilePick } from './ui';
import type { CapturePolicy } from '../lib/capture-policy';
import { captureHash, type CaptureOriginal } from '../lib/course-capture';
import { liveSupported } from '../lib/transcribe';

const ACCEPT = 'audio/*,video/*,image/*,.pdf,.docx,.pptx,.txt,.md,text/*,application/pdf';

export function CourseCapture({
  courseId,
  policy,
  onFiles,
  onGuidedProblem,
  onConsentChange,
  onRemovePersisted,
}: {
  courseId: string;
  policy: CapturePolicy;
  onFiles: (files: File[]) => void | Promise<Array<{ id: string }> | void>;
  onGuidedProblem?: (file: File) => void;
  onConsentChange?: (granted: boolean) => void;
  onRemovePersisted?: (ids: string[]) => void | Promise<void>;
}) {
  const [consent, setConsent] = useState(false);
  const [originals, setOriginals] = useState<Array<CaptureOriginal & { file: File }>>([]);
  const [status, setStatus] = useState('Waiting for explicit consent.');
  const generation = useRef(0);
  const persisted = useRef<string[]>([]);
  useEffect(() => () => { generation.current += 1; }, []);

  const add = async (files: File[]) => {
    if (!consent || policy.recording === 'prohibited') return;
    const run = generation.current;
    setStatus('Preserving originals and checking file integrity…');
    const made = await Promise.all(
      files.map(async (file, index) => ({
        id: `${courseId}:${file.name}:${file.size}:${index}`,
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        hash: await captureHash(file),
        file,
      })),
    );
    if (run !== generation.current) return;
    const stored = await onFiles(files);
    const ids = stored?.map(({ id }) => id) ?? [];
    if (run !== generation.current) {
      if (ids.length) await onRemovePersisted?.(ids);
      return;
    }
    persisted.current.push(...ids);
    setOriginals((current) => [...current, ...made]);
    setStatus(`${made.length} ${made.length === 1 ? 'original was' : 'originals were'} preserved locally with a content hash.`);
  };

  const denied = policy.recording === 'prohibited';
  return (
    <section className="course-capture" aria-label="Course capture">
      <div className="course-capture-policy">
        <strong>Capture policy</strong>
        <span>
          {denied
            ? 'Recording is not permitted by this course or institution.'
            : policy.recording === 'upload-only'
              ? 'Uploads are permitted; live recording is disabled.'
              : 'Live recording and uploads are permitted after consent.'}
        </span>
        <span>{policy.modelProcessing ? 'Approved processing may be used.' : 'Local handling only; model processing is disabled.'}</span>
      </div>

      <label className="course-capture-consent">
        <input
          type="checkbox"
          checked={consent}
          aria-label="I have permission to capture and process this material"
          onChange={(event) => {
            setConsent(event.target.checked);
            onConsentChange?.(event.target.checked);
            if (!event.target.checked) {
              generation.current += 1;
              const ids = [...persisted.current];
              persisted.current = [];
              if (ids.length) void onRemovePersisted?.(ids);
              setOriginals([]);
              setStatus('Consent withdrawn. Capture-session originals were cleared and persisted copies were queued for removal.');
            } else {
              setStatus('Consent recorded for this capture session.');
            }
          }}
        />
        I have permission to capture this material and have given any required participant notice.
      </label>

      <FilePick accept={ACCEPT} disabled={!consent || denied} onPick={(files) => void add(files)}>
        Add audio, video, image or course document
      </FilePick>

      {!denied && policy.recording === 'permitted' && (
        <p className="course-capture-live">
          {liveSupported()
            ? 'This browser can create a timestamped live transcript after you confirm consent.'
            : 'Live transcription is unavailable in this browser; upload-first capture remains available.'}
        </p>
      )}

      {originals.map((original) => (
        <div className="course-capture-original" key={original.id}>
          <span><strong>{original.name}</strong> · {original.mime} · hash {original.hash.slice(0, 12)}…</span>
          {original.mime.startsWith('image/') && onGuidedProblem && (
            <button type="button" onClick={() => onGuidedProblem(original.file)}>Open guided problem</button>
          )}
          <button
            type="button"
            aria-label={`Remove ${original.name}`}
            onClick={() => {
              const ids = [...persisted.current];
              persisted.current = [];
              if (ids.length) void onRemovePersisted?.(ids);
              setOriginals((current) => current.filter((item) => item.id !== original.id));
              setStatus(`${original.name} was removed from this capture session; persisted copies were queued for removal.`);
            }}
          >
            Remove
          </button>
        </div>
      ))}

      <p role="status" className="course-capture-status">{status}</p>
    </section>
  );
}
