// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvidenceReference, IntelligenceResponse } from './contracts';
import { IntelligenceDisclosure } from './Disclosure';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const responseFixture = (): IntelligenceResponse => ({
  text: 'Start with elasticity.',
  evidence: [
    {
      id: 'e1',
      sourceId: 'syllabus',
      origin: 'course',
      title: 'Syllabus',
      locator: 'p. 4',
      excerpt: 'Elasticity is on the midterm.',
      verifiedAt: '2026-09-23T12:00:00.000Z',
      authority: 'authoritative',
      scope: { tenantId: 'northstar', role: 'student', personId: 'nora' },
    },
  ],
  informationUsed: ['Current course', 'Midterm date'],
  origins: ['course'],
  mode: 'hint',
  actions: [],
});

const evidenceFixture = (
  id: string,
  authority: EvidenceReference['authority'],
  verifiedAt: string | null | undefined = '2026-09-23T12:00:00.000Z',
): EvidenceReference => ({
  id,
  sourceId: id,
  origin: 'course',
  title: `${authority} source`,
  locator: 'p. 4',
  excerpt: 'Source excerpt.',
  ...(verifiedAt === undefined ? {} : { verifiedAt }),
  authority,
  scope: { tenantId: 'northstar', role: 'student', personId: 'nora' },
});

describe('IntelligenceDisclosure', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('shows exact source locators, information used, origin and mode', () => {
    act(() => root.render(<IntelligenceDisclosure response={responseFixture()} />));
    expect(host.textContent).toContain('Syllabus · p. 4');
    expect(host.textContent).toContain('Course material');
    expect(host.textContent).toContain('Information Semester used');
    expect(host.textContent).toContain('Hint mode');
    expect(host.querySelector('details')?.hasAttribute('open')).toBe(false);
    expect(host.querySelector('summary')?.getAttribute('tabindex')).toBe('0');
  });

  it('renders citations as application-owned controls keyed by evidence id', () => {
    act(() => root.render(<IntelligenceDisclosure response={responseFixture()} />));
    expect(host.querySelector('[data-evidence-id="e1"]')).toBeInstanceOf(HTMLDetailsElement);
    expect(host.querySelector('[data-evidence-id="e1"]')?.textContent).toContain('Elasticity is on the midterm');
  });

  it('shows each evidence authority without turning its timestamp into a verification claim', () => {
    const response = responseFixture();
    response.evidence = [
      evidenceFixture('authoritative', 'authoritative'),
      evidenceFixture('confirmed', 'confirmed'),
      evidenceFixture('unverified', 'unverified'),
      evidenceFixture('inferred', 'inferred'),
    ];

    act(() => root.render(<IntelligenceDisclosure response={response} />));

    for (const [id, label] of [
      ['authoritative', 'Authoritative'],
      ['confirmed', 'Confirmed'],
      ['unverified', 'Unverified'],
      ['inferred', 'Inferred'],
    ]) {
      const source = host.querySelector(`[data-evidence-id="${id}"]`);
      expect(source?.textContent).toContain(`Authority: ${label}`);
      expect(source?.textContent).toContain('Last checked: 2026-09-23T12:00:00.000Z');
      expect(source?.textContent).not.toContain('Verified 2026-09-23T12:00:00.000Z');
    }
  });

  it('names missing and invalid check times and does not invent a freshness threshold for an old one', () => {
    const response = responseFixture();
    const omitted = evidenceFixture('omitted', 'confirmed');
    delete omitted.verifiedAt;
    response.evidence = [
      omitted,
      evidenceFixture('missing', 'confirmed', null),
      evidenceFixture('invalid', 'unverified', 'not-a-timestamp'),
      evidenceFixture('old', 'authoritative', '2001-01-01T00:00:00.000Z'),
    ];

    act(() => root.render(<IntelligenceDisclosure response={response} />));

    expect(host.querySelector('[data-evidence-id="omitted"]')?.textContent).toContain('Last checked: Not recorded');
    expect(host.querySelector('[data-evidence-id="missing"]')?.textContent).toContain('Last checked: Not recorded');
    expect(host.querySelector('[data-evidence-id="missing"]')?.textContent).toContain('Freshness: Unknown');
    expect(host.querySelector('[data-evidence-id="invalid"]')?.textContent).toContain('Last checked: Invalid timestamp');
    expect(host.querySelector('[data-evidence-id="invalid"]')?.textContent).toContain('Freshness: Unknown');
    expect(host.querySelector('[data-evidence-id="old"]')?.textContent).toContain('Last checked: 2001-01-01T00:00:00.000Z');
    expect(host.querySelector('[data-evidence-id="old"]')?.textContent).toContain('Freshness: Not classified');
    expect(host.textContent).not.toMatch(/Freshness: (Current|Stale)/);
  });

  it('rejects legacy date syntax and calendar rollover instead of exposing invalid time metadata', () => {
    const response = responseFixture();
    response.evidence = [
      evidenceFixture('numeric', 'confirmed', '0'),
      evidenceFixture('legacy', 'confirmed', '2026/02/28'),
      evidenceFixture('rollover', 'confirmed', '2026-02-31T12:00:00.000Z'),
    ];

    act(() => root.render(<IntelligenceDisclosure response={response} />));

    for (const id of ['numeric', 'legacy', 'rollover']) {
      const source = host.querySelector(`[data-evidence-id="${id}"]`);
      expect(source?.textContent).toContain('Last checked: Invalid timestamp');
      expect(source?.querySelector('time')).toBeNull();
    }
  });

  it('keeps valid ISO timestamps with fractional seconds and timezone offsets', () => {
    const response = responseFixture();
    response.evidence = [
      evidenceFixture('fractional', 'confirmed', '2026-09-23T12:00:00.123456Z'),
      evidenceFixture('offset', 'confirmed', '2026-09-23T12:00:00+05:30'),
    ];

    act(() => root.render(<IntelligenceDisclosure response={response} />));

    expect(host.querySelector('[data-evidence-id="fractional"] time')?.getAttribute('datetime'))
      .toBe('2026-09-23T12:00:00.123456Z');
    expect(host.querySelector('[data-evidence-id="offset"] time')?.getAttribute('datetime'))
      .toBe('2026-09-23T12:00:00+05:30');
  });

  it('labels each source authority and freshness group for assistive technology', () => {
    act(() => root.render(<IntelligenceDisclosure response={responseFixture()} />));

    expect(host.querySelector('[aria-label="Syllabus source authority and freshness"]')).toBeInstanceOf(HTMLDListElement);
    expect(host.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-23T12:00:00.000Z');
  });

  it('carries the app’s own AI-assisted badge, and External when the web was used', () => {
    act(() => root.render(<IntelligenceDisclosure response={responseFixture()} />));
    expect(host.querySelector('[data-source="ai_assisted"]')?.textContent).toContain('AI-assisted');
    expect(host.querySelector('[data-source="external"]')).toBeNull();

    act(() => root.render(<IntelligenceDisclosure response={{ ...responseFixture(), origins: ['course', 'web'] }} />));
    expect(host.querySelector('[data-source="external"]')?.textContent).toContain('External');
  });

  it('offers a way to a person only when the screen can take the student there', () => {
    act(() => root.render(<IntelligenceDisclosure response={responseFixture()} />));
    expect([...host.querySelectorAll('button')].map((b) => b.textContent)).toEqual([]);

    const onAskHuman = vi.fn();
    act(() => root.render(<IntelligenceDisclosure response={responseFixture()} onAskHuman={onAskHuman} />));
    const button = [...host.querySelectorAll('button')].find((b) => /who can help/i.test(b.textContent ?? ''));
    expect(button).toBeDefined();
    act(() => button!.click());
    expect(onAskHuman).toHaveBeenCalledTimes(1);
  });
});
