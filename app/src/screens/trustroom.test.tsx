// @vitest-environment jsdom
/**
 * The reviewer's page, as the reviewer meets it. The client is faked (no
 * function behind a test); the page, its copy and its timings are the
 * shipping code.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const COMMIT = 'e5fc11d979a962275044cc91393c6186c6b65285';
const TOKEN = 'c'.repeat(64);
const URL_OK = 'https://lzrqvlugnawcgywkhqlz.supabase.co/storage/v1/object/sign/trust-packet/hecvat/hecvat-1.0.pdf?token=x';

const world = vi.hoisted(() => ({
  listed: null as unknown,
  opened: null as unknown,
  calls: [] as string[],
}));

vi.mock('../lib/trustroom', () => ({
  listRoom: vi.fn(async () => world.listed),
  openDocument: vi.fn(async (_t: string, a: string) => {
    world.calls.push(a);
    return world.opened;
  }),
}));

import TrustRoom from './TrustRoom';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  world.calls = [];
  world.listed = {
    kind: 'ok', packetCommit: COMMIT, expiresAt: '2026-10-04T12:00:00Z',
    items: [{ artifact: 'hecvat', title: 'HECVAT readiness register', version: '1.0', sourceCommit: COMMIT }],
  };
  world.opened = { kind: 'ok', url: URL_OK, title: 'HECVAT readiness register', version: '1.0', seconds: 60 };
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

async function mount() {
  await act(async () => {
    root.render(<TrustRoom token={TOKEN} />);
  });
}

const button = (name: RegExp) =>
  [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? '')) as HTMLButtonElement;

describe('the procurement room page', () => {
  it('lists the granted versions under one heading, inside one main', async () => {
    await mount();
    expect(host.querySelectorAll('main')).toHaveLength(1);
    expect(host.querySelectorAll('h1')).toHaveLength(1);
    expect(host.textContent).toContain('Documents shared with you');
    expect(host.textContent).toContain('HECVAT readiness register');
    expect(host.textContent).toContain('Version 1.0');
    expect(host.textContent).toContain(COMMIT.slice(0, 12));
    expect(host.textContent).not.toContain(TOKEN);
  });

  it("draws its button in the page's own colour, since the app's theme never reaches this page", async () => {
    await mount();
    const b = button(/Get a link to HECVAT/);
    expect(b.style.color).toBe('inherit');
    expect(b.style.borderColor).toBe('currentcolor');
  });

  it('asks for a document only when the reviewer does, and hands it over as a link they follow', async () => {
    await mount();
    expect(world.calls).toEqual([]);
    await act(async () => button(/Get a link to HECVAT/).click());
    expect(world.calls).toEqual(['hecvat']);
    const a = host.querySelector('a') as HTMLAnchorElement;
    expect(a.href).toBe(URL_OK);
    expect(a.target).toBe('_blank');
    expect(a.rel.split(' ').sort()).toEqual(['noopener', 'noreferrer']);
  });

  it('takes the link away when it expires', async () => {
    vi.useFakeTimers();
    await mount();
    await act(async () => button(/Get a link to HECVAT/).click());
    expect(host.querySelector('a')).not.toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(host.querySelector('a')).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toMatch(/expired/);
    expect(button(/Get a link to HECVAT/)).toBeTruthy();
  });

  it('says one thing for a link that is wrong, expired or withdrawn', async () => {
    world.listed = { kind: 'not_found' };
    await mount();
    expect(host.querySelector('h1')?.textContent).toBe('This link is not working');
    expect(host.textContent).toMatch(/expired or been withdrawn/);
  });

  it('says something different when the room cannot be reached at all', async () => {
    world.listed = { kind: 'offline' };
    await mount();
    expect(host.querySelector('h1')?.textContent).toBe('The documents could not be reached');
  });

  it('explains a document that is not uploaded yet, and keeps the button', async () => {
    world.opened = { kind: 'unavailable' };
    await mount();
    await act(async () => button(/Get a link to HECVAT/).click());
    expect(host.querySelector('a')).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toMatch(/not in place yet/);
  });
});
