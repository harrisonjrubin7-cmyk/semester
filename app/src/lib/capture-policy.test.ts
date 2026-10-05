import { describe, expect, it } from 'vitest';
import { beginCapture, effectiveCapturePolicy } from './capture-policy';

const consent = { id: 'consent-1', status: 'granted' as const, participantNotice: true };

describe('capture policy', () => {
  it('does not initialize recording when policy prohibits it', () => {
    expect(() =>
      beginCapture({ recording: 'prohibited', modelProcessing: false }, consent),
    ).toThrow('Recording is not permitted by this course or institution.');
  });

  it('uses the most restrictive institution, course and participant rule', () => {
    expect(
      effectiveCapturePolicy({
        institution: { recording: 'permitted', modelProcessing: true },
        course: { recording: 'upload-only', modelProcessing: true },
        participant: { recording: 'permitted', modelProcessing: false },
      }),
    ).toMatchObject({ recording: 'upload-only', modelProcessing: false });
  });
});
