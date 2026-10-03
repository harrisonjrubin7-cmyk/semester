// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider, useStore } from '../../state/store';
import { loadSeed } from '../../data/seed';
import { STORAGE_KEY, type Action, type State } from '../../state/shape';
import { backupOf } from '../../lib/export';
import { blankCourse } from '../../lib/edit';
import { RESTORED_LINE, type Snapshot } from '../../lib/snapshots';
import type { PackFile, PackResult } from '../../lib/travelpack';
import type { IntakeResult } from '../../lib/intake';
import type { AthleticEvent } from '../../lib/athletics';
import { Write } from '../../screens/Write';
import { NoteEditor } from '../../screens/Mine';
import { SettingsAssistant } from '../../screens/settings/Assistant';
import { SupportAccess } from '../SupportAccess';
import { Family } from '../../screens/Family';
import { ShareCourse } from '../ShareCourse';
import { Export } from '../../screens/Export';
import { Snapshots } from '../Snapshots';
import { Toolkit } from '../toolkit/Toolkit';
import { toolkitFlags } from '../../lib/toolkit/flags';
import { toolkitKey } from '../toolkit/store';
import { TravelPack } from '../TravelPack';
import { Import } from '../../screens/Import';
import * as supportAccess from '../../lib/support-access';
import * as snapshots from '../../lib/snapshots';
import * as travelpack from '../../lib/travelpack';
import * as intake from '../../lib/intake';
import * as generate from '../../lib/generate';
import * as assistant from '../../lib/assistant';
import * as cloud from '../../lib/cloud';
import * as store from '../../state/store';
import * as schoolClaim from '../SchoolClaim';
import * as referralLink from '../ReferralLink';
import * as storageRoom from '../StorageRoom';
import { AccountScreen } from '../../screens/Account';
import { closeOverlay } from '../../lib/unity';
import { UnityLayer } from './UnityLayer';

/**
 * The shared states, placed on real screens — the third rollout.
 *
 * Each test mounts the screen or component that now carries a shared state and
 * drives it to the moment the state appears, then checks two things: that the
 * shared component is what drew it (its class and its role), and that the
 * words a student relied on before are still there. Where a network, a
 * database or IndexedDB stands between the screen and the state, that one
 * module is replaced with a controllable double; everything else is real.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * No `vi.mock` here, on purpose: this file runs in the shared workers, where a
 * mock can only rebind a module nobody has evaluated yet (`src/isolation.test.ts`),
 * and one that did rebind would leak into whichever file ran next. The few
 * modules that stand between a screen and its state — a database, IndexedDB,
 * the network — are spied on instead, per test, and every spy is restored in
 * `afterEach`, so nothing outlives the test that asked for it.
 */
let host: HTMLDivElement;
let root: Root;
let seen: State;
let send: (a: Action) => void;

/** Reads the store after each commit, and hands the test a dispatch. */
function Probe() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    seen = state;
    send = dispatch;
  });
  return null;
}

beforeAll(async () => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
  await loadSeed();
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
  vi.restoreAllMocks();
});

async function mount(node: ReactNode, store = true) {
  await act(async () => {
    root.render(
      store ? (
        <StoreProvider>
          <Probe />
          {node}
          <UnityLayer />
        </StoreProvider>
      ) : (
        node
      ),
    );
  });
}

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const buttons = () => [...host.querySelectorAll('button')];
const button = (label: string | RegExp): HTMLButtonElement => {
  const found = buttons().find((b) =>
    typeof label === 'string' ? (b.textContent ?? '').trim() === label : label.test(b.textContent ?? ''),
  );
  if (!found) throw new Error(`no button "${label}" in: ${text()}`);
  return found;
};
const press = (label: string | RegExp) => act(async () => button(label).click());
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

function pick(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── 1. Account ──────────────────────────────────────────────────────────────

describe('Account: the sync lines', () => {
  /*
   * Account renders its signed-in half only with an account service and an
   * account, neither of which a test build has. So these spy on the cloud
   * flag and the store hook — the real store underneath, with an account,
   * a sync state and a refresh laid over it — and on the three children that
   * would reach for the network.
   */
  async function signedIn(sync: { status: 'synced' | 'error'; at: number; error: string }, refresh: () => Promise<string>) {
    const real = store.useStore;
    vi.spyOn(cloud, 'cloudConfigured', 'get').mockReturnValue(true);
    vi.spyOn(store, 'useStore').mockImplementation(() => ({
      ...real(),
      account: { id: 'me', email: 'me@example.edu', via: 'email' },
      sync,
      refresh,
    }));
    vi.spyOn(schoolClaim, 'SchoolClaim').mockImplementation(() => null as never);
    vi.spyOn(referralLink, 'ReferralLink').mockImplementation(() => null as never);
    vi.spyOn(storageRoom, 'StorageRoom').mockImplementation(() => null as never);
    await mount(<AccountScreen />);
  }

  it('says Synced, with the counts, in the live sync line', async () => {
    // Since #777 the sync line is Account's own live region, worded from
    // `SYNC_WORDS`, rather than the shared `SyncState`.
    await signedIn({ status: 'synced', at: Date.now(), error: '' }, async () => 'Up to date.');
    const line = [...host.querySelectorAll('[role="status"]')].find((n) => /Synced/.test(n.textContent ?? ''));
    expect(line?.textContent).toMatch(/Synced .* · \d+ courses? · \d+ added · \d+ notes · \d+ actions/);
    expect(buttons().filter((b) => b.textContent === 'Check now')).toHaveLength(1);
  });

  it('turns a failed sync into an error state whose recovery is the same check', async () => {
    const refresh = vi.fn(async () => 'Checked just now.');
    await signedIn({ status: 'error', at: 0, error: 'The server said no.\n\nWhat to do next.\n\nReference: SEM-1234' }, refresh);
    const alert = host.querySelector('.state-error')!;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Sync did not finish');
    // Paragraphs kept: `.state-body` is `white-space: pre-line`, so the breaks show.
    expect(alert.querySelector('.state-body')!.textContent).toBe('The server said no.\n\nWhat to do next.');
    expect(alert.querySelector('.state-body')!.textContent).not.toContain('Reference');
    expect(alert.textContent).toContain('Reference: SEM-1234');
    // Said once: the failure is the error state's, not repeated in the live line.
    expect(text().split('Sync failed.').length - 1).toBe(0);
    // One "Check now", not the error state's and the old button's.
    expect(buttons().filter((b) => /Check now/.test(b.textContent ?? ''))).toHaveLength(1);
    await press('Check now');
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Checked just now.');
  });
});

// ── 2. Write ────────────────────────────────────────────────────────────────

describe('Write: the save line', () => {
  it('draws the shared save state beside the sentence it always had', async () => {
    await mount(<Write />);
    await press(/^Blank document$/);
    const save = host.querySelector('.save-state')!;
    expect(save.getAttribute('role')).toBe('status');
    expect(save.textContent).toContain('Saving…');
    expect(text()).toContain('Every change is kept as you type.');
  });
});

// ── 3. Mine ─────────────────────────────────────────────────────────────────

describe('Mine: the note editor', () => {
  it('says the note is saved, under its title', async () => {
    await mount(<NoteEditor />);
    await act(async () => send({ type: 'newNote', courseId: null }));
    const title = host.querySelector('input[aria-label="Note title"]')!;
    const save = host.querySelector('.save-state')!;
    expect(save.textContent).toContain('Saved');
    expect(title.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ── 4. Settings → Assistant ────────────────────────────────────────────────

describe('Settings: the assistant save', () => {
  it('shows the shared Saved line only once it has been saved', async () => {
    await mount(<SettingsAssistant />);
    expect(host.querySelector('.save-state')).toBeNull();
    await press('Save on this device');
    expect(button('Saved on this device')).toBeTruthy();
    expect(host.querySelector('.save-state')?.textContent).toContain('Saved');
  });
});

// ── 5. SupportAccess ────────────────────────────────────────────────────────

describe('SupportAccess: permission changes and a failed load', () => {
  const ACCOUNT = { id: 'me', email: 'me@example.edu', via: 'email' } as const;
  const WINDOW = {
    grantId: 'grant-1', side: 'student', counterpartLabel: 'Advisor Rivera',
    reason: 'Help me review the pattern.', expiresAt: '2099-01-02T00:00:00Z',
    revokedAt: null, createdAt: '2099-01-01T00:00:00Z',
    ticketId: '123e4567-e89b-12d3-a456-426614174000', scopes: ['learning-progress'], consentState: 'active',
  };
  const TICKETS = [{ ticketId: '123e4567-e89b-12d3-a456-426614174000', subject: 'Recovery plan' }];

  it('says a created window as a permission change, with the way to the revoke', async () => {
    vi.spyOn(supportAccess, 'loadSupportAccess')
      .mockResolvedValueOnce({ supporters: [{ supporterId: 'staff', label: 'Advisor Rivera' }], tickets: TICKETS, windows: [] } as never)
      .mockResolvedValue({ supporters: [{ supporterId: 'staff', label: 'Advisor Rivera' }], tickets: TICKETS, windows: [WINDOW] } as never);
    vi.spyOn(supportAccess, 'createSupportAccess').mockResolvedValue(undefined as never);
    await mount(<SupportAccess account={ACCOUNT} />, false);
    await act(async () => setValue(host.querySelector('textarea')!, 'Help me make a recovery plan.'));
    await act(async () => {
      host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    const notice = host.querySelector('.state-permission')!;
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.querySelector('.state-title')!.textContent).toBe('Support access created');
    expect(notice.textContent).toContain('You can revoke it at any time.');
    expect(button('Go to active windows')).toBeTruthy();
    expect(host.querySelector('#support-access-active')).not.toBeNull();
  });

  it('says a revoke as a permission change with no control to go anywhere', async () => {
    vi.spyOn(supportAccess, 'loadSupportAccess').mockResolvedValue({ supporters: [], tickets: [], windows: [WINDOW] } as never);
    vi.spyOn(supportAccess, 'revokeSupportAccess').mockResolvedValue(undefined as never);
    await mount(<SupportAccess account={ACCOUNT} />, false);
    await press('Revoke now');
    const notice = host.querySelector('.state-permission')!;
    expect(notice.querySelector('.state-title')!.textContent).toBe('Support access revoked');
    expect(notice.textContent).toContain('The supporter can no longer open this summary.');
    expect(notice.querySelector('button')).toBeNull();
  });

  it('turns a failed load into an error state that tries again', async () => {
    const load = vi
      .spyOn(supportAccess, 'loadSupportAccess')
      .mockRejectedValueOnce(new Error('The service is down.'))
      .mockResolvedValue({ supporters: [], tickets: [], windows: [] } as never);
    await mount(<SupportAccess account={ACCOUNT} />, false);
    const alert = host.querySelector('.state-error')!;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Could not load support access');
    expect(alert.textContent).toContain('The service is down.');
    await press('Try again');
    expect(load).toHaveBeenCalledTimes(2);
    expect(host.querySelector('.state-error')).toBeNull();
  });
});

// ── 6. Family ───────────────────────────────────────────────────────────────

describe('Family: saving a permission plan', () => {
  it('says what changed, why it is safe, and opens the preview', async () => {
    await mount(<Family />);
    const name = [...host.querySelectorAll('label')].find((l) => l.textContent?.startsWith('Name'))!.querySelector('input')!;
    await act(async () => setValue(name, 'Aunt May'));
    await press('Save plan');
    const notice = host.querySelector('.state-permission')!;
    expect(notice.querySelector('.state-title')!.textContent).toBe('Permission plan saved for Aunt May');
    expect(notice.textContent).toContain('Saved on this device. It grants no account access to anybody.');
    await press('Preview what they would see');
    // On the preview tab the control has nowhere further to go.
    expect(buttons().some((b) => b.textContent === 'Preview what they would see')).toBe(false);
  });
});

// ── 7. ShareCourse ──────────────────────────────────────────────────────────

describe('ShareCourse: after sending', () => {
  it('says the file was shared as a permission change, with what it carries', async () => {
    const created = vi.fn(() => 'blob:test');
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: () => {} });
    const module_ = blankCourse('TEST 101');
    await mount(<ShareCourse courseId={module_.course.id} />);
    await act(async () => send({ type: 'addCourse', module: module_ } as Action));
    expect(text()).toContain('A file with this course in it');
    await press('Share this course');
    const notice = host.querySelector('.state-permission')!;
    expect(notice.querySelector('.state-title')!.textContent).toBe('Course file shared');
    expect(notice.textContent).toContain('none of your own notes, ticks or timings');
    expect(created).toHaveBeenCalled();
  });
});

// ── 8. Export ───────────────────────────────────────────────────────────────

describe('Export: restoring a backup file', () => {
  it('acknowledges a restore with the shared success state', async () => {
    vi.spyOn(snapshots, 'listSnapshots').mockResolvedValue([]);
    await mount(<Export />);
    const file = new File([JSON.stringify(backupOf(seen))], 'backup.json', { type: 'application/json' });
    const input = [...host.querySelectorAll<HTMLInputElement>('input[type="file"]')].find((i) => i.accept.includes('json'))!;
    await act(async () => pick(input, [file]));
    await flush();
    await press('Replace and restore');
    const done = host.querySelector('.state-success')!;
    expect(done.getAttribute('role')).toBe('status');
    expect(done.querySelector('.state-title')!.textContent).toContain('Restored');
    expect(done.textContent).toContain('Everything in the file is in place.');
  });
});

// ── 9. Snapshots ────────────────────────────────────────────────────────────

describe('Snapshots: going back a day', () => {
  it('acknowledges the restore with the shared success state, keeping the way back', async () => {
    const snap: Snapshot = { id: 's1', at: Date.now() - 86_400_000, reason: 'asked' as Snapshot['reason'], bytes: 1000, counts: {} };
    vi.spyOn(snapshots, 'listSnapshots').mockResolvedValue([snap]);
    vi.spyOn(snapshots, 'takeSnapshot').mockResolvedValue(true as never);
    await mount(<Snapshots />);
    vi.spyOn(snapshots, 'readSnapshot').mockResolvedValue(backupOf(seen) as never);
    await flush();
    const row = buttons().find((b) => b.textContent && !/Take a copy now/.test(b.textContent) && b.closest('.state-success') === null && b.style.minHeight === '44px')!;
    await act(async () => row.click());
    await press('Go back to this');
    await flush();
    const done = host.querySelector('.state-success')!;
    expect(done.querySelector('.state-title')!.textContent).toContain('Restored');
    expect(done.textContent).toContain(RESTORED_LINE.replace(/^Restored\.\s*/, ''));
  });
});

// ── 10. Toolkit ─────────────────────────────────────────────────────────────

describe('Toolkit: the assignment workspace and a library that cannot save', () => {
  const ALL_ON = toolkitFlags({ VITE_AI_TOOLKIT: 'preview' });
  const show = () =>
    mount(<Toolkit courses={[{ code: 'PSCI 1104', name: 'Intro' }]} flags={ALL_ON} now={new Date('2026-09-27T12:00:00')} onOpen={() => {}} onClose={() => {}} />, false);

  it('heads an open workspace with the context bar, and keeps the stage count', async () => {
    await show();
    await act(async () => ([...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === 'Assignments') as HTMLElement).click());
    await press(/^Start a essay workspace/);
    const bar = host.querySelector('section.context-bar')!;
    expect(bar.querySelector('h3.context-bar-title')).not.toBeNull();
    expect(bar.querySelector('.kicker')!.textContent).toContain('PSCI 1104');
    expect(bar.textContent).toContain('Yours');
    expect(bar.querySelector('.save-state')!.textContent).toContain('Saved');
    expect(text()).toContain('0 of 7 stages done');
    expect(host.querySelector('progress[aria-label="Stages done"]')).not.toBeNull();
    // Provenance moved into Source & details rather than being said twice.
    expect(text()).not.toContain('The toolkit generated none of it.');
    await press('← All workspaces');
    expect(host.querySelector('section.context-bar')).toBeNull();
  });

  it('says a failed save as an error state whose way out is the recovery copy', async () => {
    const created = vi.fn(() => 'blob:test');
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: () => {} });
    // Bytes this device cannot read: the library refuses to write over them.
    localStorage.setItem(toolkitKey(), '{not json');
    await show();
    const alert = host.querySelector('.state-error')!;
    expect(alert.textContent).toContain('Could not save on this device');
    await press('Download recovery copy');
    expect(created).toHaveBeenCalled();
  });
});

// ── 11. TravelPack ──────────────────────────────────────────────────────────

describe('TravelPack: the download', () => {
  const EVENT: AthleticEvent = {
    id: 'e1', title: 'Away game', team: 'Rowing', kind: 'competition' as AthleticEvent['kind'],
    start: '2026-10-01T08:00', end: '2026-10-02T20:00', where: 'Elsewhere', notes: '', steps: [],
  };
  const FILES = [
    { path: '/a.mp3', label: 'Unit 1', kind: 'audio', course: 'c1' },
    { path: '/b.pdf', label: 'Reading', kind: 'document', course: 'c1' },
  ];

  it('shows the shared progress while it runs, with Cancel as the stop', async () => {
    let finish!: (r: unknown) => void;
    vi.spyOn(travelpack, 'packFor').mockReturnValue(FILES as PackFile[]);
    vi.spyOn(travelpack, 'fetchPack').mockImplementation((_files, opts) => {
      opts?.onDone?.(1, 2);
      return new Promise((r) => (finish = r as (r: unknown) => void));
    });
    await mount(<TravelPack event={EVENT} />);
    await press('Download for this trip');
    const bar = host.querySelector('.state-progress progress') as HTMLProgressElement;
    expect(bar.getAttribute('aria-label')).toBe('Downloading for this trip');
    expect(bar.value).toBe(1);
    expect(bar.max).toBe(2);
    expect(text()).toContain('50%');
    expect(button('Cancel')).toBeTruthy();
    expect(buttons().some((b) => b.textContent === 'Stop')).toBe(false);
    await act(async () => finish({ got: FILES, missed: [], bytes: 2048 }));
    expect(host.querySelector('.state-progress')).toBeNull();
    expect(text()).toContain('2 of 2 on this device');
  });

  it('turns a run that got nothing into the reason, with one way to try again', async () => {
    let runs = 0;
    vi.spyOn(travelpack, 'packFor').mockReturnValue(FILES as PackFile[]);
    vi.spyOn(travelpack, 'fetchPack').mockImplementation(async () => {
      runs += 1;
      return { got: [], missed: [], bytes: 0 } as PackResult;
    });
    await mount(<TravelPack event={EVENT} />);
    await press('Download for this trip');
    const failed = host.querySelector('.state-progress [role="alert"]')!;
    expect(failed.textContent).toContain('Nothing was downloaded.');
    // The download button is the retry; the bar does not offer a second one.
    expect([...host.querySelectorAll('button')].filter((b) => /^retry$/i.test(b.textContent ?? ''))).toHaveLength(0);
    await press('Download for this trip');
    expect(runs).toBe(2);
  });
});

// ── 12. Import ──────────────────────────────────────────────────────────────

describe('Import: reading files and a failed build', () => {
  const read = (name: string) => ({ ...intake.intakeText('Week 1: intro. Final exam December 12.', 'paste')!, name });

  it('shows the shared progress while several files are read', async () => {
    let finish!: (r: unknown) => void;
    vi.spyOn(intake, 'intakeFiles').mockImplementation((_list, onProgress) => {
      onProgress?.(1, 3);
      return new Promise((r) => (finish = r as (r: unknown) => void));
    });
    await mount(<Import />);
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => pick(input, [new File(['a'], 'a.txt'), new File(['b'], 'b.txt'), new File(['c'], 'c.txt')]));
    const bar = host.querySelector('.state-progress progress') as HTMLProgressElement;
    expect(bar.getAttribute('aria-label')).toBe('Reading your files');
    expect(bar.value).toBe(1);
    expect(bar.max).toBe(3);
    // The busy text on the picker is kept.
    expect(text()).toContain('Reading 2 of 3…');
    await act(async () => finish({ read: [read('a.txt')], refused: [] }));
    expect(host.querySelector('.state-progress')).toBeNull();
  });

  it('draws a failed build as an error state whose recovery builds again', async () => {
    vi.spyOn(assistant, 'configured').mockReturnValue(true);
    vi.spyOn(intake, 'intakeFiles').mockResolvedValue({ read: [read('syllabus.txt')], refused: [] } as IntakeResult);
    let builds = 0;
    vi.spyOn(generate, 'generateCourse').mockImplementation(async () => {
      builds += 1;
      throw new Error('network error: failed to fetch');
    });
    await mount(<Import />);
    await act(async () => pick(host.querySelector<HTMLInputElement>('input[type="file"]')!, [new File(['a'], 'syllabus.txt')]));
    await flush();
    await press(/^Build the course from/);
    await flush();
    const alert = host.querySelector('.state-error')!;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('The course was not built');
    await press('Try building it again');
    await flush();
    expect(builds).toBe(2);
  });

  it('keeps Trouble for a failure there is nothing to retry', async () => {
    vi.spyOn(intake, 'intakeFiles').mockResolvedValue({ read: [], refused: [{ name: 'x.pages', why: 'not a format this reads' }] });
    await mount(<Import />);
    await act(async () => pick(host.querySelector<HTMLInputElement>('input[type="file"]')!, [new File(['a'], 'x.pages')]));
    await flush();
    expect(host.querySelector('.state-error')).toBeNull();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('Left out: x.pages');
  });
});
