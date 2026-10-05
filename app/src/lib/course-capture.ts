import type { EvidenceReference, Scope } from '../intelligence/contracts';

export interface CaptureOriginal {
  id: string;
  name: string;
  mime: string;
  size: number;
  hash: string;
}

export interface CaptureLocator {
  sourceId: string;
  locator: string;
  text: string;
}

export interface CourseCaptureRecord {
  id: string;
  courseId: string;
  consent: 'granted' | 'withdrawn' | 'declined';
  capturedAt: string;
  originals: CaptureOriginal[];
  moments: CaptureLocator[];
  regions: CaptureLocator[];
  scope?: Scope;
}

export interface CaptureProposal {
  id: string;
  kind: 'deadline' | 'action';
  text: string;
  sourceId: string;
  locator: string;
  confirmed: false;
}

export interface CaptureArtifact {
  id: string;
  kind: 'notes' | 'cards' | 'quiz' | 'audio-review';
  title: string;
  evidenceLocators: string[];
}

export function deriveCaptureArtifacts(capture: CourseCaptureRecord): {
  status: 'ready' | 'blocked';
  artifacts: CaptureArtifact[];
  proposals: CaptureProposal[];
} {
  if (capture.consent !== 'granted') return { status: 'blocked', artifacts: [], proposals: [] };
  const locators = [...capture.moments, ...capture.regions];
  const evidenceLocators = locators.map((item) => item.locator);
  const artifacts: CaptureArtifact[] = ['notes', 'cards', 'quiz', 'audio-review'].map((kind) => ({
    id: `${capture.id}:${kind}`,
    kind: kind as CaptureArtifact['kind'],
    title: kind === 'audio-review' ? 'Audio review outline' : `Capture ${kind}`,
    evidenceLocators,
  }));
  const proposals = capture.moments
    .filter((moment) => /\b(due|deadline|submit|turn in)\b/i.test(moment.text))
    .map((moment, index): CaptureProposal => ({
      id: `${capture.id}:proposal:${index}`,
      kind: 'deadline',
      text: moment.text,
      sourceId: moment.sourceId,
      locator: moment.locator,
      confirmed: false,
    }));
  return { status: 'ready', artifacts, proposals };
}

const words = (value: string) =>
  value.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 2 && !['why', 'did', 'the'].includes(word)) ?? [];

export function answerFromCapture(question: string, capture: CourseCaptureRecord): {
  text: string;
  evidence: EvidenceReference[];
} {
  if (capture.consent !== 'granted') return { text: 'Capture consent is not active.', evidence: [] };
  const query = words(question);
  const linked = [...capture.moments, ...capture.regions].filter((item) => {
    const hay = item.text.toLowerCase();
    return query.some((word) => hay.includes(word));
  });
  const byId = new Map(capture.originals.map((original) => [original.id, original]));
  const scope = capture.scope ?? {
    tenantId: 'local',
    role: 'student',
    personId: 'device',
    resourceId: capture.courseId,
  };
  const evidence: EvidenceReference[] = linked.map((item) => ({
    id: `${capture.id}:${item.sourceId}:${item.locator}`,
    sourceId: item.sourceId,
    origin: 'student',
    title: byId.get(item.sourceId)?.name ?? 'Course capture',
    locator: item.locator,
    excerpt: item.text,
    verifiedAt: capture.capturedAt,
    authority: 'unverified',
    scope,
  }));
  return {
    text: evidence.length > 0
      ? linked.map((item) => item.text).join(' ')
      : 'No linked transcript moment or image region answers that question.',
    evidence,
  };
}

export async function captureHash(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
