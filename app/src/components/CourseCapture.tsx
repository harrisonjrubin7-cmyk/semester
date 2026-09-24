import { useState } from 'react';
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
}: {
  courseId: string;
  policy: CapturePolicy;
  onFiles: (files: File[]) => void;
  onGuidedProblem?: (file: File) => void;
  onConsentChange?: (granted: boolean) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [originals, setOriginals] = useState<Array<CaptureOriginal & { file: File }>>([]);
  const [status, setStatus] = useState('Waiting for explicit consent.');

  const add = async (files: File[]) => {
    setStatus('Preserving originals and checking file integrity…');
    // Hand the originals to the established import pipeline immediately. A
    // content digest can be slower for a long lecture and must not make a
    // successful native file selection appear unresponsive.
    onFiles(files);
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
              setOriginals([]);
              setStatus('Consent withdrawn. Local originals and derived artifacts were removed.');
            } else {
              setStatus('Consent recorded for this capture session.');
            }
          }}
        />
        I have permission to capture this material and have given any required participant notice.
      </label>

      <FilePick accept={ACCEPT} disabled={!consent} onPick={(files) => void add(files)}>
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
              setOriginals((current) => current.filter((item) => item.id !== original.id));
              setStatus(`${original.name} was removed from local capture storage.`);
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
