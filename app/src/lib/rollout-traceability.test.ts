import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAPABILITIES, type EvidenceRef, type RolloutCapability } from './rollout-capabilities';
import {
  validateTraceability,
  type SourceRecord,
  type TraceabilityContext,
} from './rollout-traceability';

const sources = JSON.parse(
  readFileSync(new URL('../../../docs/institutional-rollout/source-index.json', import.meta.url), 'utf8'),
) as SourceRecord[];

const context: TraceabilityContext = {
  repoPaths: new Set([
    'docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md',
    'app/src/lib/types.ts',
    'app/src/lib/nav.ts',
    'app/src/lib/nav.registry.test.ts',
  ]),
  attachments: new Map([['Pasted text.txt', 1059]]),
  driveIds: new Set(),
};

describe('rollout source traceability', () => {
  it('resolves every capability source in the committed index', () => {
    expect(validateTraceability([...CAPABILITIES], sources, context)).toEqual([]);
  });

  it('rejects a bare source title', () => {
    const capability = {
      ...CAPABILITIES[0],
      sources: ['Master specification' as EvidenceRef],
    } as RolloutCapability;
    expect(validateTraceability([capability], sources, context)).toContain(
      'CAP-001: invalid evidence reference Master specification',
    );
  });

  it('rejects a verified repository source that is missing', () => {
    const missing: SourceRecord = {
      ref: 'repo:docs/does-not-exist.md',
      title: 'Missing file',
      status: 'verified',
      checkedAt: '2026-09-23T00:00:00.000Z',
      note: 'Mutation fixture.',
    };
    expect(validateTraceability([], [...sources, missing], context)).toContain(
      'repo:docs/does-not-exist.md: verified repository file is unavailable',
    );
  });

  it('rejects fake Drive IDs and attachment ranges outside the supplied file', () => {
    const bad: SourceRecord[] = [
      { ref: 'drive:not-real', title: 'Fake Drive row', status: 'verified', checkedAt: '2026-09-23T00:00:00.000Z', note: 'Mutation fixture.' },
      { ref: 'attachment:Pasted text.txt#L1000-L2000', title: 'Bad range', status: 'verified', checkedAt: '2026-09-23T00:00:00.000Z', note: 'Mutation fixture.' },
    ];
    const errors = validateTraceability([], [...sources, ...bad], context);
    expect(errors).toContain('drive:not-real: invalid Drive file ID');
    expect(errors).toContain('attachment:Pasted text.txt#L1000-L2000: line range exceeds 1059');
  });

  it('rejects a verified capability whose cited evidence is unverified', () => {
    const changed = sources.map((source) =>
      source.ref === CAPABILITIES[0].sources[0] ? { ...source, status: 'unverified' as const } : source,
    );
    expect(validateTraceability([CAPABILITIES[0]], changed, context)).toContain(
      'CAP-001: verified capability cites unverified evidence attachment:Pasted text.txt#L194-L985',
    );
  });
});
