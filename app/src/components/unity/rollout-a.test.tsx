// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { StoreProvider, useStore } from '../../state/store';
import { loadSeed } from '../../data/seed';
import { STORAGE_KEY, type State } from '../../state/shape';
import { closeOverlay } from '../../lib/unity';
import { handOver } from '../../lib/draft.hook';
import { ItemDetail } from '../../screens/Courses';
import { Guide } from '../../screens/Guide';
import { AddMaterial } from '../../screens/Update';
import { CourseHub } from '../CourseHub';
import { StudyStudio } from '../StudyStudio';
import { UnityLayer } from './UnityLayer';
import { AIProvider } from '../../ai/store';
import { withoutComments } from '../../styles/rules';

/**
 * The shared components on the screens they were built for — the first
 * rollout. Each test mounts the real screen inside the real store and asks
 * what a reader would: is the bar there, and does it say honestly where the
 * thing came from. Every course in the seed is a sample course, so every
 * provenance here is "Sample" and never "Made here" or "Official".
 */

/**
 * No `vi.mock` here, on purpose: this file runs in the shared workers, where a
 * mock can only rebind a module nobody has evaluated yet (`src/isolation.test.ts`).
 * The two things that would leave the machine are held at the edge instead —
 * `fetch`, which is the one door `lib/claude.ts` goes out of, and a file's own
 * `text()`, which is what `lib/extract.ts` reads a text file with.
 */
const pending = {
  /** The one request out, held until a test settles it. */
  fetch: null as null | { reject: (e: Error) => void },
};

/** A text file whose contents arrive only when the test lets them. */
function heldFile(name: string): { file: File; release: () => void } {
  const file = new File([''], name, { type: 'text/plain' });
  let release = () => {};
  const text = new Promise<string>((resolve) => {
    release = () => resolve(`The contents of ${name}. `.repeat(40));
  });
  Object.defineProperty(file, 'text', { value: () => text });
  return { file, release: () => release() };
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let seen: State;

function Probe() {
  const { state } = useStore();
  useEffect(() => {
    seen = state;
  });
  return null;
}

beforeAll(async () => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  pending.fetch = null;
  vi.stubGlobal(
    'fetch',
    () =>
      new Promise<Response>((_, reject) => {
        pending.fetch = { reject };
      }),
  );
  (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
  });
});

afterEach(async () => {
  await act(async () => closeOverlay());
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
  delete (Element.prototype as unknown as { scrollIntoView?: () => void }).scrollIntoView;
});

async function mount(node: ReactNode) {
  await act(async () => {
    root.render(
      <StoreProvider>
        <AIProvider>
          <Probe />
          {node}
          <UnityLayer />
        </AIProvider>
      </StoreProvider>,
    );
  });
}

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const bar = () => host.querySelector('section.context-bar') as HTMLElement | null;
const buttons = (label: string) => [...host.querySelectorAll('button')].filter((b) => (b.textContent ?? '').trim() === label);
const press = (label: string) =>
  act(async () => {
    const [b] = buttons(label);
    if (!b) throw new Error(`no button "${label}" in: ${text()}`);
    b.click();
  });

/** The one step of a StepStatus, and the word its state is read as. */
const step = (label: string) =>
  [...host.querySelectorAll('.state-steps li')].find((li) => (li.textContent ?? '').slice(1).startsWith(label))?.getAttribute('data-state');

describe('the deadline (ItemDetail)', () => {
  it('names the course, the kind and the item in a context bar, with a sample source and Done on it', async () => {
    await mount(<ItemDetail />);
    const b = bar();
    expect(b).not.toBeNull();
    expect(b!.querySelector('.kicker')?.textContent).toMatch(/ · /);
    // A plain line, as the title was: the screen's name is the only h1, and
    // this screen had no heading of its own to replace.
    expect(b!.querySelector('h1, h2, h3')).toBeNull();
    expect(b!.textContent).toContain('Sample');
    expect(b!.textContent).not.toContain('Made here');
    expect(b!.textContent).not.toContain('Official');
    // Moved, not copied.
    expect(buttons('Mark done')).toHaveLength(1);
    expect(buttons('Study')).toHaveLength(1);
    const id = seen.itemId;
    await press('Mark done');
    expect(Object.keys(seen.done).length).toBeGreaterThan(0);
    expect(buttons('Mark not done')).toHaveLength(1);
    expect(id).toBe(seen.itemId);
  });

  it('says in Source & details where the date came from', async () => {
    await mount(<ItemDetail />);
    await press('Source & details');
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Sample');
  });
});

describe('the course hub', () => {
  it('includes subject-wide and free-elective requirement connections', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({schemaVersion: 6, requirements: [
      {id: 'subject', programme: 'Major', name: 'Economics block', need: 'courses', count: 1, accepts: ['ECON'], note: ''},
      {id: 'elective', programme: 'Degree', name: 'Free elective', need: 'courses', count: 1, accepts: [], note: ''},
      {id: 'other', programme: 'Major', name: 'Unrelated block', need: 'courses', count: 1, accepts: ['ZZZZ'], note: ''},
    ]}));
    await mount(<Hub />);
    const map = host.querySelector('[aria-label="Course relationships"]')!;
    expect(map.textContent).toContain('Economics block');
    expect(map.textContent).toContain('Free elective');
    expect(map.textContent).not.toContain('Unrelated block');
  });
  function Hub() {
    // The store settles its course pointer after the first render, as
    // `CourseDetail` allows for; this waits the same way.
    const { state, catalog } = useStore();
    const course = catalog.byId[state.guideId];
    return course ? <CourseHub course={course} information={null} /> : null;
  }

  it('is a context bar at h2 that calls a seed course a sample, whatever the term', async () => {
    await mount(<Hub />);
    const b = bar();
    expect(b).not.toBeNull();
    expect(b!.querySelector('h2')?.textContent?.length).toBeGreaterThan(0);
    expect(b!.querySelector('.kicker')?.textContent).toContain(seen.term);
    expect(b!.textContent).toContain('Sample');
    expect(b!.textContent).not.toContain('Made here');
    expect(text()).not.toContain('Sample course');
    expect(buttons('Continue studying →')).toHaveLength(1);
    expect(buttons('+ Add reading')).toHaveLength(1);
    expect([...host.querySelectorAll('summary')].some(summary => summary.textContent === 'Relationship map')).toBe(true);
    expect(host.querySelector('[aria-label="Course relationships"]')).not.toBeNull();
    await press('Continue studying →');
    expect(seen.screen).toBe('guide');
  });

  it('keeps creation, upload-adjacent, and text actions visually quiet inside the portal', async () => {
    const style = document.createElement('style');
    style.textContent = ['app.css', 'features.css', 'tokens.css', 'unity.css']
      .map(file => readFileSync(new URL(`../../styles/${file}`, import.meta.url), 'utf8'))
      .flatMap(sheet => withoutComments(sheet).split('}'))
      .map(chunk => {
        const open = chunk.lastIndexOf('{');
        return open < 0 ? null : [chunk.slice(0, open).trim(), chunk.slice(open + 1)] as const;
      })
      .filter((rule): rule is readonly [string, string] => rule !== null)
      .filter(([selector]) =>
        selector === '.workspace-text-button' ||
        selector === '.portal-workspace button, .portal-button' ||
        /\.device \.portal-workspace button(?:\.workspace-text-button|\.for-this-)/.test(selector)
      )
      .map(([selector, body]) => `${selector}{${body}}`)
      .join('\n')
      // jsdom does not resolve custom properties in shorthands. Give the
      // portal wash its resolved colour so the real cascade remains visible.
      .replaceAll('var(--app-accent-wash)', 'rgb(1, 2, 3)');
    document.head.append(style);
    host.classList.add('device');
    try {
      await mount(<Hub />);
      const documentButton = buttons('Document')[0];
      const attachButton = buttons('Attach something you already have')[0];
      const allAssignments = buttons('View all assignments →')[0];
      const uploadFace = [...host.querySelectorAll('label span')].find(element => element.textContent === 'Upload')!;
      expect(documentButton.classList).toContain('for-this-new');
      expect(getComputedStyle(documentButton).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(readFileSync('src/styles/unity.css', 'utf8')).toMatch(
        /button\.for-this-new\s*\{[^}]*min-height:\s*44px/,
      );
      expect(getComputedStyle(documentButton.querySelector('span')!).color).toBe(getComputedStyle(uploadFace).color);
      expect(getComputedStyle(attachButton).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(allAssignments).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    } finally {
      host.classList.remove('device');
      style.remove();
    }
  });
});

describe('the study guide', () => {
  it('names the guide under its course, as a sample, and keeps where it was built from', async () => {
    await mount(<Guide />);
    const b = bar();
    expect(b).not.toBeNull();
    expect(b!.querySelector('h1, h2, h3')).toBeNull();
    expect(b!.textContent).toContain('Sample');
    expect(text()).toContain('Built from');
  });
});

describe('the study studio', () => {
  async function studio() {
    await mount(null);
    const about = `${seen.term}:econ`;
    return about;
  }

  it('puts the draft under a context bar at h3, AI-assisted and saved, with Save & open in Write as its primary', async () => {
    const about = await studio();
    handOver('study-studio', 'guide', '# A draft\n\nSome text.', { about });
    await mount(<StudyStudio courseId="econ" onClose={() => {}} />);
    const b = bar();
    expect(b).not.toBeNull();
    expect(b!.querySelector('h3')?.textContent).toBe('Your study guide');
    expect(b!.textContent).toContain('AI-assisted, source-linked');
    expect(b!.querySelector('[role="status"]')?.textContent).toContain('Saved');
    expect(buttons('Save & open in Write')).toHaveLength(1);
    expect(text()).toContain('Saved temporarily on this device');
  });

  it('shows the generation as named steps, and which one failed', async () => {
    // A key of one's own, so the studio will ask; the request itself goes
    // nowhere — it is the held `fetch` above.
    localStorage.setItem('semester.claude.v1', JSON.stringify({ apiKey: 'sk-ant-test' }));
    await mount(<StudyStudio courseId="econ" onClose={() => {}} />);
    const box = host.querySelector('.study-source-list input[type=checkbox]') as HTMLInputElement;
    await act(async () => box.click());
    for (const label of [...host.querySelectorAll('label')]) {
      if (/I checked the course policy|Send the selected text/.test(label.textContent ?? '')) {
        const input = label.querySelector('input[type=checkbox]') as HTMLInputElement;
        await act(async () => input.click());
      }
    }
    await press('Create study guide');
    expect(step('Selecting sources')).toBe('done');
    expect(step('Drafting')).toBe('working');
    expect(step('Matching quotations')).toBe('waiting');
    await vi.waitFor(() => expect(pending.fetch).not.toBeNull());
    await act(async () => pending.fetch!.reject(new TypeError('Failed to fetch')));
    await vi.waitFor(() => expect(step('Drafting')).toBe('failed'));
    expect(step('Matching quotations')).toBe('waiting');
    expect(step('Ready')).toBe('waiting');
  });
});

describe('adding material (Update)', () => {
  async function attach(...files: File[]) {
    const input = [...host.querySelectorAll('input[type="file"]')].find((el) =>
      (el.getAttribute('accept') ?? '').includes('.pdf'),
    ) as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  const plain = (name: string) => new File([`The contents of ${name}. `.repeat(40)], name, { type: 'text/plain' });

  it('shows reading several files as a determinate progress', async () => {
    await mount(<AddMaterial multimodalCapture={false} />);
    const second = heldFile('second.txt');
    await attach(plain('first.txt'), second.file);
    await vi.waitFor(() => expect(host.querySelector('progress[aria-label="Reading your files"]')).not.toBeNull());
    const bar = host.querySelector('progress[aria-label="Reading your files"]') as HTMLProgressElement;
    expect(bar).not.toBeNull();
    expect(bar.value).toBe(1);
    expect(bar.max).toBe(2);
    expect(text()).toContain('50%');
    await act(async () => second.release());
    await vi.waitFor(() => expect(host.querySelector('progress[aria-label="Reading your files"]')).toBeNull());
  });

  it('shows the three steps of reading one file, and the one it stopped on', async () => {
    await mount(<AddMaterial multimodalCapture={false} />);
    await attach(plain('reading.txt'));
    // Where it stops depends on whether this machine has an assistant — with
    // none, the harvest refuses; with one, the held request is refused — so
    // the claim is about the shape: one failed step, everything before it
    // done, everything after it still waiting.
    await vi.waitFor(async () => {
      if (pending.fetch) await act(async () => pending.fetch!.reject(new TypeError('Failed to fetch')));
      expect(host.querySelector('.state-steps [data-state="failed"]')).not.toBeNull();
    });
    const states = ['Working out what it is', 'Reading what is in it', 'Comparing with the course'].map(step);
    const at = states.indexOf('failed');
    expect(states.slice(0, at).every((st) => st === 'done')).toBe(true);
    expect(states.slice(at + 1).every((st) => st === 'waiting')).toBe(true);
    expect(host.querySelector('ol.state-steps')?.getAttribute('aria-label')).toBe('Reading this file');
  });
});
