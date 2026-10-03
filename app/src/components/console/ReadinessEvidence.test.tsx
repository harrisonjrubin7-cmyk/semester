// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { READINESS_LAYERS, type ReadinessObservation } from '../../lib/ops/readiness';
import { ReadinessEvidence } from './ReadinessEvidence';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const SUBJECT = 'operations-console-foundation';
const allCurrent: readonly ReadinessObservation[] = READINESS_LAYERS.map((layer) => ({
  subjectId: SUBJECT,
  layer,
  source: `evidence:${layer}`,
  observedAt: '2026-10-03',
  outcome: 'current',
}));

describe('console readiness evidence', () => {
  it('renders stale and missing layers as blocked with provenance and limitations', async () => {
    await act(async () => root.render(<ReadinessEvidence today="2026-11-03" />));
    expect(host.textContent).toContain('Blocked');
    expect(host.textContent).toContain('Repository — stale');
    expect(host.textContent).toContain('Configuration — missing');
    const activation = host.querySelector('[aria-label="Readiness Activation / approval"]');
    expect(activation).not.toBeNull();
    expect(activation?.textContent).toContain('Named approval and activation record');
    expect(activation?.textContent).toContain('Named tenant and capability');
    expect(activation?.textContent).toContain('does not prove the system operated successfully');
  });

  it('shows ready only when every layer has current evidence', async () => {
    await act(async () => root.render(<ReadinessEvidence today="2026-10-03" evidence={allCurrent} />));
    expect(host.textContent).toContain('Ready');
    expect(host.textContent).toContain('Observed operation — current');
    expect(host.textContent).not.toContain('— missing');
  });
});
