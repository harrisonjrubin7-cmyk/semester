export type RecordingPolicy = 'prohibited' | 'upload-only' | 'permitted';

export interface CapturePolicy {
  recording: RecordingPolicy;
  modelProcessing: boolean;
  retentionDays?: number;
  reason?: string;
}

export interface CaptureConsent {
  id: string;
  status: 'granted' | 'declined' | 'withdrawn';
  participantNotice: boolean;
}

const rank: Record<RecordingPolicy, number> = {
  prohibited: 0,
  'upload-only': 1,
  permitted: 2,
};

export function effectiveCapturePolicy(input: {
  institution: CapturePolicy;
  course?: CapturePolicy;
  participant?: CapturePolicy;
}): CapturePolicy {
  const policies = [input.institution, input.course, input.participant].filter(
    (policy): policy is CapturePolicy => Boolean(policy),
  );
  const recording = policies.reduce(
    (mostRestrictive, policy) =>
      rank[policy.recording] < rank[mostRestrictive] ? policy.recording : mostRestrictive,
    'permitted' as RecordingPolicy,
  );
  const retention = policies
    .map((policy) => policy.retentionDays)
    .filter((days): days is number => typeof days === 'number');
  return {
    recording,
    modelProcessing: policies.every((policy) => policy.modelProcessing),
    ...(retention.length > 0 ? { retentionDays: Math.min(...retention) } : {}),
    reason: policies.map((policy) => policy.reason).filter(Boolean).join(' ') || undefined,
  };
}

export function beginCapture(policy: CapturePolicy, consent: CaptureConsent) {
  if (policy.recording === 'prohibited') {
    throw new Error('Recording is not permitted by this course or institution.');
  }
  if (consent.status !== 'granted') throw new Error('Explicit capture consent is required.');
  if (!consent.participantNotice) throw new Error('Participant notice must be confirmed before recording.');
  return {
    id: `capture:${consent.id}`,
    consentId: consent.id,
    mode: policy.recording === 'upload-only' ? 'upload' : 'live-or-upload',
    modelProcessing: policy.modelProcessing,
  };
}
