import { describe, expect, it } from 'vitest';
import { answerFromCapture, deriveCaptureArtifacts, type CourseCaptureRecord } from './course-capture';

const fixture = (patch: Partial<CourseCaptureRecord> = {}): CourseCaptureRecord => ({
  id: 'capture-1',
  courseId: 'econ',
  consent: 'granted',
  capturedAt: '2026-09-23T15:00:00.000Z',
  originals: [
    { id: 'lecture-1', name: 'Lecture 8.mp4', mime: 'video/mp4', size: 1200, hash: 'sha256-video' },
    { id: 'diagram-1', name: 'curve.png', mime: 'image/png', size: 400, hash: 'sha256-image' },
  ],
  moments: [
    { sourceId: 'lecture-1', locator: '00:14:22', text: 'The response paper is due October 2.' },
    { sourceId: 'lecture-1', locator: '00:22:08', text: 'The demand curve moved because preferences changed.' },
  ],
  regions: [
    {
      sourceId: 'diagram-1',
      locator: 'region:x120-y80-w340-h210',
      text: 'Demand curve movement after a preference change.',
    },
  ],
  ...patch,
});

describe('course capture provenance', () => {
  it('stops processing after consent withdrawal and exposes no derived artifacts', () => {
    const result = deriveCaptureArtifacts(fixture({ consent: 'withdrawn' }));
    expect(result.status).toBe('blocked');
    expect(result.artifacts).toEqual([]);
  });

  it('links every extracted deadline to a transcript moment and leaves it unconfirmed', () => {
    const result = deriveCaptureArtifacts(fixture());
    expect(result.proposals[0]).toMatchObject({ locator: '00:14:22', confirmed: false });
  });

  it('answers about a video or diagram only from linked moments or regions', () => {
    const result = answerFromCapture('Why did the curve move?', fixture());
    expect(result.evidence).toEqual([
      expect.objectContaining({ sourceId: 'lecture-1', locator: '00:22:08' }),
      expect.objectContaining({ sourceId: 'diagram-1', locator: 'region:x120-y80-w340-h210' }),
    ]);
  });
});
