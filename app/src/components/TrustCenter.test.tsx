// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import type { ShareRow } from '../lib/advisor-shares';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';

/**
 * Phase N on screen, with the share calls mocked (their rules are
 * `supabase/advisor.check.sql`). With `trust_center` off, Your data and Me are
 * unchanged (the controls have it on). With it on, the center says what is
 * connected and when it last synced, what each source label means, and which
 * materials AI may not use; and each of its three removals — revoking a
 * share, forgetting a line, deleting the saved conversation — happens only
 * after a confirmation that says exactly what goes, and does exactly that.
 * Export is one tap to the export screen.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const future = new Date(Date.now() + 20 * 86_400_000).toISOString();
let shares: ShareRow[] = [];
const revoked: string[] = [];
vi.mock('../lib/advisor-shares', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/advisor-shares')>();
  return {
    ...real,
    myShares: vi.fn(async () => ({ shares, events: [] })),
    revokeShare: vi.fn(async (id: string) => {
      revoked.push(id);
      shares = shares.map((s) => (s.id === id ? { ...s, revoked_at: new Date().toISOString() } : s));
    }),
  };
});

const { TrustCenter } = await import('./TrustCenter');
const { Privacy } = await import('../screens/Privacy');
const { Me } = await import('../screens/Me');

let host: HTMLDivElement;
let root: Root;
let seen: { aboutMe: { id: string }[]; screen: string } | null = null;
function Probe() {
  const { state } = useStore();
  useEffect(() => {
    seen = { aboutMe: state.aboutMe, screen: state.screen };
  });
  return null;
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 6,
      seenOnboarding: true,
      sample: false,
      term: '2026FA',
      courses: [],
      aboutMe: [
        { id: 'f1', text: 'I work twenty hours a week', at: 1 },
        { id: 'f2', text: 'I prefer mornings', at: 2 },
      ],
    }),
  );
  localStorage.setItem('semester.threads.v1', JSON.stringify({ threads: [{ id: 't1', turns: [{ role: 'user', content: 'Help me plan' }, { role: 'assistant', content: 'Sure.' }], at: Date.now() }], openId: 't1' }));
  localStorage.setItem('semester.threads.archive.v1', JSON.stringify([{ id: 't0', turns: [{ role: 'user', content: 'Older' }], at: 1 }]));
  localStorage.setItem('semester.source-locker.v1', JSON.stringify({ version: 1, aiBlocked: ['file:abc'], built: [] }));
  shares = [
    { id: 's1', title: 'Spring planning', created_at: new Date().toISOString(), expires_at: future, revoked_at: null },
    { id: 's2', title: 'Old agenda', created_at: '2026-01-01T00:00:00Z', expires_at: '2026-02-01T00:00:00Z', revoked_at: null },
  ];
  revoked.length = 0;
  seen = null;
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const settle = async (ready?: () => boolean) => {
  const until = Date.now() + 2000;
  for (let i = 0; ready ? !ready() && Date.now() < until : i < 3; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
};
const render = async (node: React.ReactNode) => {
  await act(async () => root.render(<StoreProvider>{node}<Probe /></StoreProvider>));
  await settle();
};
const text = (el: ParentNode = document.body) => (el.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp, within: ParentNode = document.body) => {
  const found = [...within.querySelectorAll('button')].find((b) => name.test((b.textContent ?? '').trim()));
  if (!found) throw new Error(`No button ${name}: ${[...within.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  return found;
};
const dialog = () => [...document.querySelectorAll('[role="dialog"]')].find((d) => d.classList.contains('dialog')) ?? null;
const section = (label: string) => host.querySelector(`[aria-label="${label}"]`)!;

describe('with trust_center off', () => {
  it('Your data and Me are unchanged', async () => {
    await render(<Privacy trustCenter={false} />);
    await settle(() => host.querySelector('.trust-center') !== null);
    expect(host.querySelector('.trust-center')).toBeNull();
    await act(async () => root.unmount());
    root = createRoot(host);
    await render(<Me trustCenter={false} semesterWrapped={false} />);
    expect(text()).not.toContain('Trust & data');
  });

  it('and with it on, both have it (the control)', async () => {
    await render(<Privacy trustCenter />);
    await settle(() => host.querySelector('.trust-center') !== null);
    expect(host.querySelector('.trust-center')).not.toBeNull();
    await act(async () => root.unmount());
    root = createRoot(host);
    await render(<Me trustCenter semesterWrapped={false} />);
    await act(async () => button(/^Trust & data/).click());
    expect(seen!.screen).toBe('privacy');
  });
});

describe('with trust_center on', () => {
  it('says what is connected, what the labels mean, and what AI may not use', async () => {
    await render(<TrustCenter accountId={null} />);
    expect(text(section('Connected sources'))).toContain('not signed in. Everything stays on this device.');
    expect(text(section('Source labels'))).toContain('Institution verified');
    expect(text(section('Source labels'))).toContain('Needs review');
    expect(text(section('Imported materials and AI'))).toContain('1 material is marked so AI never uses it.');
    expect(text(section('Shares and access'))).toContain('Nothing is shared: this device is not signed in.');
  });

  it('revokes a live share only after saying what happens, and shows it gone', async () => {
    await render(<TrustCenter accountId="u1" />);
    await settle(() => text().includes('Spring planning'));
    const shares = section('Shares and access');
    expect(text(shares)).toContain('Spring planning — shared with your advisor, until');
    expect(text(shares)).toContain('1 earlier share has expired or been revoked.');
    await act(async () => button(/^Revoke…$/, shares).click());
    expect(revoked).toEqual([]);
    expect(text(dialog()!)).toContain('Your advisor will no longer be able to open it.');
    expect(document.activeElement?.textContent).toBe('Cancel');
    await act(async () => button(/^Revoke$/, dialog()!).click());
    await settle(() => text().includes('No advisor can open'));
    expect(revoked).toEqual(['s1']);
    expect(text()).toContain('No advisor can open anything of yours right now.');
  });

  it('forgets one remembered line, and only after a confirmation', async () => {
    await render(<TrustCenter accountId={null} />);
    const remembered = section('What Semester remembers');
    expect(text(remembered)).toContain('“I work twenty hours a week”');
    await act(async () => button(/^Forget…$/, remembered).click());
    expect(seen!.aboutMe.map((f) => f.id)).toEqual(['f1', 'f2']);
    await act(async () => button(/^Forget$/, dialog()!).click());
    expect(seen!.aboutMe.map((f) => f.id)).toEqual(['f2']);
  });

  it('deletes the saved conversations, archive included and nothing else, only after a confirmation', async () => {
    await render(<TrustCenter accountId={null} />);
    const remembered = section('What Semester remembers');
    expect(text(remembered)).toContain('Your conversations with Semester: 2 conversations, 3 messages, saved on this device.');
    await act(async () => button(/^Delete it…$/, remembered).click());
    expect(localStorage.getItem('semester.threads.v1')).not.toBeNull();
    const preview = dialog()!.querySelector('.action-preview');
    expect(preview).not.toBeNull();
    expect(text(preview!)).toContain('Every conversation saved on this device is deleted, archived ones included.');
    expect(text(preview!)).toContain('What stays the same');
    expect(text(preview!)).toContain('What you told Semester about yourself, your notes and your plans stay.');
    expect(text(preview!)).toContain('This can’t be undone.');
    await act(async () => button(/^Delete$/, dialog()!).click());
    expect(localStorage.getItem('semester.threads.v1')).toBeNull();
    expect(localStorage.getItem('semester.threads.archive.v1')).toBeNull();
    expect(text(remembered)).toContain('No conversation with Semester is saved on this device.');
    expect(seen!.aboutMe).toHaveLength(2);
    expect(localStorage.getItem('semester.source-locker.v1')).not.toBeNull();
  });

  it('takes export one tap away', async () => {
    await render(<TrustCenter accountId={null} />);
    await act(async () => button(/^Export my data$/).click());
    expect(seen!.screen).toBe('export');
  });
});
