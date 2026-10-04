// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fromSourceLabel, phrase, type FactProvenance } from '../../lib/factprovenance';
import { ObjectCard } from './ObjectCard';
import { ProvenanceChips } from './ProvenanceChips';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 9, 4, 12);
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const staleOfficial: FactProvenance = {
  origin: 'official',
  authority: 'Registrar',
  assurance: 'verified',
  freshness: 'stale',
  observedAt: NOW - 5 * 86_400_000,
  access: 'restricted',
  controller: 'the Registrar',
  lifecycle: 'pending',
  owner: 'Dean’s office',
};

describe('ProvenanceChips', () => {
  it('draws the origin and at most two cues, each as a glyph and a word', () => {
    act(() => root.render(<ProvenanceChips provenance={staleOfficial} now={NOW} />));
    const chips = [...host.querySelectorAll('.prov-chip')];
    expect(chips.map((c) => c.getAttribute('data-cue') ?? 'origin')).toEqual(['origin', 'restricted', 'stale']);
    for (const c of chips) {
      expect(c.querySelector('.status-glyph')?.textContent?.trim().length).toBeGreaterThan(0);
      expect(c.textContent?.replace(c.querySelector('.status-glyph')?.textContent ?? '', '').trim().length).toBeGreaterThan(0);
    }
    expect(chips[0].getAttribute('data-fill')).toBe('solid');
  });

  it('hides the pieces from assistive technology and says the whole as one sentence', () => {
    act(() => root.render(<ProvenanceChips provenance={staleOfficial} now={NOW} />));
    expect(host.querySelector('.prov-visible')?.getAttribute('aria-hidden')).toBe('true');
    const said = host.querySelector('.sr-only')!.textContent;
    expect(said).toBe(phrase(staleOfficial, NOW));
    // The pending request does not fit on the row, and is still said.
    expect(said).toContain('Pending · Dean’s office');
    expect(host.querySelectorAll('.prov-chip')).toHaveLength(3);
  });

  it('shows how long ago, as text, beside the chips', () => {
    act(() => root.render(<ProvenanceChips provenance={staleOfficial} now={NOW} />));
    expect(host.querySelector('.prov-age')?.textContent).toMatch(/^Updated /);
  });

  it('is not a control: nothing in it can be tabbed to', () => {
    act(() => root.render(<ProvenanceChips provenance={staleOfficial} now={NOW} />));
    expect(host.querySelectorAll('button, a, [tabindex]')).toHaveLength(0);
  });
});

describe('ObjectCard provenance', () => {
  it('draws it when given, and not otherwise', () => {
    act(() => root.render(<ObjectCard kind="requirement" title="Statistics requirement" provenance={fromSourceLabel('estimated')} />));
    expect(host.querySelector('.prov')).not.toBeNull();
    expect(host.querySelector('.prov')?.textContent).toContain('Estimated');
    act(() => root.render(<ObjectCard kind="requirement" title="Statistics requirement" />));
    expect(host.querySelector('.prov')).toBeNull();
  });
});
