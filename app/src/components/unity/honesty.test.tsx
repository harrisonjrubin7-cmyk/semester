// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider, useStore } from '../../state/store';
import { loadSeed } from '../../data/seed';
import { STORAGE_KEY } from '../../state/shape';
import { closeOverlay, showCapture } from '../../lib/unity';
import { newApplication } from '../../lib/apply';
import { ItemDetail } from '../../screens/Courses';
import type { CourseId, CourseModule } from '../../lib/types';
import { CommandCenter } from './CommandCenter';
import { OfflineStrip } from './States';
import { UnityLayer } from './UnityLayer';

/**
 * The shared components say only what is true.
 *
 * Four places Codex's review of #792 found them saying more: a timer that
 * claimed a course it could not keep, an offline strip promising a sync to an
 * account that does not exist, an imported deadline called "yours" because
 * its quote was dropped, and an "upcoming" application that had closed.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let store: ReturnType<typeof useStore>;
let seed: CourseModule[];

function Probe() {
  const s = useStore();
  useEffect(() => {
    store = s;
  });
  return null;
}

beforeAll(async () => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  seed = await loadSeed();
});

beforeEach(async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
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
});

async function mount(node: ReactNode) {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Probe />
        {node}
        <UnityLayer />
      </StoreProvider>,
    );
  });
}

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const press = (label: string) =>
  act(async () => {
    const b = [...host.querySelectorAll('button')].find((x) => (x.textContent ?? '').trim() === label);
    if (!b) throw new Error(`no button "${label}" in: ${text()}`);
    b.click();
  });
const attached = () => [...host.querySelectorAll('[role="dialog"] .kicker')].some((k) => k.textContent === 'Attached to');

describe('Quick Capture', () => {
  it('offers a course only for the kinds that keep one', async () => {
    await mount(null);
    await act(async () => showCapture());
    // Control: a task keeps its course, so the choice is there.
    expect(attached()).toBe(true);
    await press('Study session');
    // A timer has nowhere to put a course, so it is not offered.
    expect(attached()).toBe(false);
  });
});

describe('the offline strip', () => {
  it('promises a sync only when there is an account to sync with', async () => {
    await mount(<OfflineStrip />);
    expect(text()).toContain('changes sync when you are back');
    await mount(<OfflineStrip syncs={false} />);
    expect(text()).toContain('everything is kept on this device');
    expect(text()).not.toMatch(/sync/i);
  });
});

describe('the deadline', () => {
  it('calls an imported item imported even when its quote was dropped', async () => {
    await mount(<ItemDetail />);
    // An imported course, as `lib/generate.ts` leaves one: the item kept, the
    // quote it could not verify cleared.
    const from = seed[0];
    const id = 'mine-101' as CourseId;
    const mine: CourseModule = {
      ...from,
      course: { ...from.course, id, code: 'MINE 101' },
      items: from.items.slice(0, 1).map((i) => ({ ...i, id: 'mine-1', c: id, quote: '', source: 'Syllabus' })),
    };
    await act(async () => store.dispatch({ type: 'addCourse', module: mine }));
    await act(async () => store.dispatch({ type: 'openItem', id: 'mine-1' }));
    const bar = host.querySelector('section.context-bar')!;
    expect(bar.textContent).toContain('MINE 101');
    expect(bar.textContent).toContain('Made here');
    expect(bar.textContent).not.toContain('You entered');
  });
});

describe('the upcoming opportunity widget', () => {
  it('shows the soonest live deadline still ahead, not a closed or passed one', async () => {
    const day = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const at = Date.now();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 6,
        pinned: 'opportunity',
        applications: [
          newApplication({ org: 'Withdrawn Co', due: day(2), stage: 'closed' }, at),
          newApplication({ org: 'Missed Co', due: day(-3), stage: 'writing' }, at),
          newApplication({ org: 'Live Co', due: day(9), stage: 'writing' }, at),
        ],
      }),
    );
    await mount(<CommandCenter />);
    const value = host.querySelector('.command-widget-value')?.textContent;
    expect(value).toBe(`Live Co · due ${day(9)}`);
  });
});
