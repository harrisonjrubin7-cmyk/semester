// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { Launchpad } from './Launchpad';
import { Support } from './Support';
import { Opportunities } from './Opportunities';
import { Hub } from './Hub';
import { OperationsStudio } from '../components/institutional/OperationsStudio';

/**
 * The journey screens, driven the way a student would drive them.
 *
 * Each case is a promise the screen makes in its own words — a type adds a
 * step, the work-study box says private, the official channel says it is not
 * connected — checked in the rendered page rather than in the library, because
 * a library can keep a promise the screen forgets to say.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

const draw = (node: ReactNode) => act(() => root.render(<StoreProvider>{node}</StoreProvider>));

const button = (text: string) => {
  const b = [...host.querySelectorAll('button')].find((x) => x.textContent?.trim() === text);
  if (!b) throw new Error(`no button "${text}"`);
  return b;
};

const click = (el: Element) => act(() => (el as HTMLElement).click());

const type = (label: string, value: string) => {
  const field = host.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!field) throw new Error(`no field "${label}"`);
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set;
  act(() => {
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('Launchpad', () => {
  it('adds the international steps when the student says they are one, and removes nothing', () => {
    draw(<Launchpad />);
    const before = host.querySelectorAll('.jx-check').length;
    expect(host.textContent).not.toContain('Start your immigration documents');
    click(button('International'));
    expect(host.textContent).toContain('Start your immigration documents');
    expect(host.querySelectorAll('.jx-check').length).toBeGreaterThan(before);
  });

  it('says whose decision a step is, and that ticking it tells nobody', () => {
    draw(<Launchpad />);
    expect(host.textContent).toContain('ticking a step here tells no office anything');
    expect(host.textContent).toContain('Admissions');
  });

  it('keeps the peer-mentor request off until the student turns it on', () => {
    draw(<Launchpad />);
    click(button('Mentors & family'));
    expect(host.textContent).not.toContain('What would you like to talk about?');
    click(host.querySelector('input[aria-label="I would like a peer mentor"]')!);
    expect(host.textContent).toContain('A match uses only what you tick here');
  });
});

describe('Support', () => {
  it('opens on emergency numbers and says it does not monitor', () => {
    draw(<Support />);
    expect(host.querySelector('a[href="tel:988"]')).not.toBeNull();
    expect(host.textContent).toContain('Semester does not monitor anyone');
  });

  it('says where to go when no door obviously fits, on every tab', () => {
    draw(<Support />);
    for (const tab of [null, 'Care']) {
      if (tab) click(button(tab));
      expect([...host.querySelectorAll('button')].some((b) => b.textContent?.includes('See who can help with what'))).toBe(true);
    }
  });

  it('draws what happens to what you say before the door to the office', () => {
    draw(<Support />);
    click(button('Care'));
    const entry = [...host.querySelectorAll('.jx-entry')].find((e) => e.textContent?.includes('Counseling'))!;
    const privacy = entry.querySelector('.jx-privacy')!;
    const door = entry.querySelector('.jx-door')!;
    expect(privacy.textContent).toMatch(/^Confidential/);
    expect(privacy.compareDocumentPosition(door) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Opportunities', () => {
  it('offers the work-study box only on a job, and says it is private', () => {
    draw(<Opportunities />);
    click(button('+ Campus job'));
    expect(host.textContent).toContain('Private to you. Never shown in the list or on your resume.');
    click(button('← All opportunities'));
    click(button('+ Study abroad'));
    expect(host.textContent).not.toContain('Work-study position');
    expect(host.textContent).toContain('not legal advice');
  });

  it('previews the exact local consequence before deleting an opportunity', () => {
    draw(<Opportunities />);
    click(button('+ Research'));
    type('Title', 'Water quality fellowship');
    type('Organization', 'River Lab');
    type('Notes', 'Ask Dr. Chen about the field schedule.');

    click(button('Delete this'));
    expect(host.textContent).toContain('Delete this opportunity?');
    expect(host.textContent).toContain('Water quality fellowship');
    expect(host.textContent).toContain('stage, deadline, source link, checklist');
    expect(host.textContent).toContain('Other tracked opportunities, your weekly time budget');
    expect(host.textContent).toContain('There is no undo or backup for this tracker.');
    expect(host.textContent).toContain('Ask Dr. Chen about the field schedule.');

    click(button('Cancel'));
    expect((host.querySelector('[aria-label="Title"]') as HTMLInputElement).value).toBe('Water quality fellowship');
    expect((host.querySelector('[aria-label="Notes"]') as HTMLTextAreaElement).value).toBe('Ask Dr. Chen about the field schedule.');

    click(button('Delete this'));
    click(button('Delete opportunity'));
    expect(host.textContent).not.toContain('Water quality fellowship');
    expect(host.textContent).toContain('Nothing here yet.');
  });
});

describe('Notices', () => {
  it('says the official channel is not connected rather than showing an example', async () => {
    draw(<Hub />);
    // Nothing is claimed while the channel is still loading.
    expect(host.textContent).not.toContain('No school channel connected');
    await act(async () => {});
    expect(host.textContent).toContain('No school channel connected');
    expect(host.querySelectorAll('.jx-tag-official')).toHaveLength(0);
  });
});

describe('Operations studio', () => {
  it('refuses to open without the verified capability', () => {
    draw(<OperationsStudio verified={[]} tenantId="t" accountId="a" />);
    expect(host.textContent).toContain('needs the verified outcomes:read capability');
    expect(host.querySelector('textarea')).toBeNull();
  });

  it('keeps one analyst’s drafts out of another school’s studio', () => {
    localStorage.setItem('semester.operations.v1:t1:a', JSON.stringify({ evidence: [], standards: [], ready: { gdpr: true } }));
    draw(<OperationsStudio verified={['outcomes:read']} tenantId="t2" accountId="a" />);
    click(button('Readiness'));
    expect((host.querySelector('input[aria-label^="Data subject requests"]') as HTMLInputElement).checked).toBe(false);
  });

  it('withholds a small cell, and its complement, in the export it offers', () => {
    draw(<OperationsStudio verified={['outcomes:read']} tenantId="t" accountId="a" />);
    const area = host.querySelector('textarea[aria-label="Aggregate counts"]') as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(area, 'Fall,admitted,300\nFall,deferred,4\nFall,confirmed,210');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const csv = host.querySelector('.jx-pre')!.textContent!;
    expect(csv).toContain('"Fall","admitted",300');
    expect(csv).toContain('"Fall","deferred",');
    expect(csv).not.toContain(',4');
    expect(csv).not.toContain(',210');
  });
});
