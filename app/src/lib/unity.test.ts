// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { STATUS_KEYS, statusOf, syncStatusKey } from './status';
import { SYNC_WORDS } from './syncstatus';
import type { SyncStatus } from '../state/store';
import { TRUST, aboutWhere, saysWhere, type Where } from './where';
import { DEFAULT_PINS, MAX_PINS, WIDGETS, movePin, readPins, togglePin, writePins } from './widgets';
import { explain, explainedByHand } from './explain';
import { GOALS, goalOf } from './goals';
import { PALETTE, shortcutFor } from './keys';
import { WORKSPACE_MODES, readLook, workspaceModeOf } from './look';
import { sources } from '../styles/rules';
import { destination } from './nav';

/**
 * The one status vocabulary, and the small libraries the shared components
 * stand on.
 */

describe('the status vocabulary', () => {
  it('reads provenance from lib/where.ts rather than a second list', () => {
    for (const w of Object.keys(TRUST) as Where[]) {
      expect(statusOf(w).label).toBe(saysWhere(w));
      expect(statusOf(w).about).toBe(aboutWhere(w));
    }
  });

  it('gives every state a word, a sentence and a glyph — never colour alone', () => {
    for (const k of STATUS_KEYS) {
      const s = statusOf(k);
      expect(s.label.length, k).toBeGreaterThan(0);
      expect(s.about.length, k).toBeGreaterThan(10);
      expect(s.glyph.length, k).toBeGreaterThan(0);
    }
  });

  it('has one wording per state', () => {
    const labels = STATUS_KEYS.map((k) => statusOf(k).label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('names the brief’s states in its words', () => {
    expect(statusOf('ai-assisted').label).toBe('AI-assisted, source-linked');
    expect(statusOf('needs-confirmation').label).toBe('Needs confirmation');
    expect(statusOf('conflict').label).toBe('Conflict needs review');
    expect(statusOf('queued').label).toBe('Queued');
  });

  it('maps the store’s sync state the one way, with offline outranking it', () => {
    expect(syncStatusKey('synced')).toBe('synced');
    expect(syncStatusKey('error')).toBe('sync-error');
    expect(syncStatusKey('off')).toBe('device-only');
    expect(syncStatusKey('synced', true)).toBe('offline');
    // Nothing to sync, so no connection changes nothing.
    expect(syncStatusKey('signed-out', true)).toBe('signed-out');
  });

  it('keeps the two sync readouts on the shared words they used before', () => {
    // The settings screen's long forms and the soft card's one-word forms.
    expect(statusOf(syncStatusKey('error')).label).toBe('Sync trouble');
    expect(statusOf(syncStatusKey('error')).short).toBe('Trouble');
    expect(statusOf(syncStatusKey('signed-out')).label).toBe('Not signed in');
    expect(statusOf(syncStatusKey('signed-out')).short).toBe('None');
    expect(statusOf(syncStatusKey('off')).label).toBe('On this device only');
    expect(statusOf(syncStatusKey('off')).short).toBe('Local');
  });

  it('agrees with SYNC_WORDS, the table the sync readouts read', () => {
    // Two tables name sync states: `lib/syncstatus.ts` for the store's own
    // states (the soft card, Settings, Account), and this one for chips and
    // save lines. Where both name a state, they must name it the same way.
    const same: SyncStatus[] = ['off', 'signed-out', 'syncing', 'synced', 'offline', 'error'];
    for (const s of same) {
      expect(statusOf(syncStatusKey(s)).label, s).toBe(SYNC_WORDS[s].standing);
      expect(statusOf(syncStatusKey(s)).short, s).toBe(SYNC_WORDS[s].short);
    }
    // Every store state maps to something, including the two conflict kinds.
    for (const s of Object.keys(SYNC_WORDS) as SyncStatus[]) expect(STATUS_KEYS).toContain(syncStatusKey(s));
    expect(syncStatusKey('queued')).toBe('queued');
    expect(syncStatusKey('review')).toBe('conflict');
  });

  it('leaves the readouts on the one table rather than a chain of their own', () => {
    const settings = readFileSync('src/screens/settings/Index.tsx', 'utf8');
    const soft = readFileSync('src/components/soft/SoftTopBody.tsx', 'utf8');
    expect(settings).toContain('SYNC_WORDS[');
    expect(soft).toContain('SYNC_WORDS');
    expect(settings).not.toMatch(/'Sync trouble'/);
    expect(soft).not.toMatch(/'Trouble'/);
  });
});

describe('the command centre pins', () => {
  it('starts on the defaults when nobody has chosen', () => {
    expect(readPins('')).toEqual(DEFAULT_PINS);
    expect(readPins(undefined)).toEqual(DEFAULT_PINS);
  });

  it('keeps an emptied list empty rather than bringing the defaults back', () => {
    expect(readPins(writePins([]))).toEqual([]);
  });

  it('drops what it does not know and caps the list', () => {
    expect(readPins('week,gone,week,study')).toEqual(['week', 'study']);
    expect(readPins(WIDGETS.map((w) => w.id).join(',') + ',extra').length).toBeLessThanOrEqual(MAX_PINS);
  });

  it('moves by a step and not past either end', () => {
    expect(movePin(['week', 'study'], 'study', -1)).toEqual(['study', 'week']);
    expect(movePin(['week', 'study'], 'week', -1)).toEqual(['week', 'study']);
    expect(movePin(['week', 'study'], 'study', 1)).toEqual(['week', 'study']);
  });

  it('will not pin past the cap', () => {
    const full = WIDGETS.map((w) => w.id).slice(0, MAX_PINS);
    expect(togglePin(full, 'week')).not.toContain('week');
    expect(togglePin(full.filter((x) => x !== 'week'), 'week')).toContain('week');
  });
});

describe('About this screen', () => {
  it('answers all four questions for every screen with a registry entry', () => {
    const types = readFileSync('src/lib/types.ts', 'utf8');
    const union = /export type Screen =([\s\S]*?);\n/.exec(types)![1].replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    const screens = [...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
    expect(screens.length).toBeGreaterThan(50);
    for (const s of screens) {
      const e = explain(s as never);
      for (const part of [e.what, e.why, e.from, e.next]) expect(part.length, s).toBeGreaterThan(10);
    }
  });

  it('writes its own answers for the screens students land on', () => {
    for (const s of ['home', 'courses', 'calendar', 'study', 'pathway'] as const) expect(explainedByHand(s), s).toBe(true);
  });

  it('uses the directory’s own sentence where it has no written answer', () => {
    const e = explain('clocks');
    expect(e.what).toBe(destination('clocks')!.blurb);
  });
});

describe('first-session goals', () => {
  it('each go somewhere real', () => {
    for (const g of GOALS) expect(destination(g.screen) ?? g.screen, g.id).toBeTruthy();
    expect(goalOf('study')?.screen).toBe('study');
    expect(goalOf('nope')).toBeNull();
  });
});

describe('workspace modes', () => {
  it('fall back to Guided and survive a stored value from nowhere', () => {
    expect(workspaceModeOf(undefined)).toBe('guided');
    expect(workspaceModeOf('gone')).toBe('guided');
    expect(readLook({ workspaceMode: 'focused' } as never).workspaceMode).toBe('focused');
    expect(WORKSPACE_MODES.map((m) => m.id)).toEqual(['guided', 'focused', 'detailed', 'access']);
  });

  /*
   * Presentation only. A mode may decide what is drawn first; it may never
   * decide what somebody is allowed to do. So nothing that answers a
   * permission or capability question reads it.
   */
  it('are read by nothing that decides access', () => {
    const decides = sources('src', { ext: ['.ts', '.tsx'], tests: false }).filter(({ text }) =>
      /\b(allowed|forRole|capabilit(?:y|ies)|REQUIRES)\b/.test(text) && /export function (allowed|forRole|can[A-Z])/.test(text),
    );
    expect(decides.length).toBeGreaterThan(0);
    for (const { path, text } of decides) expect(text, path).not.toMatch(/workspaceMode|data-workspace/);
  });
});

describe('⌘K / Ctrl+K', () => {
  it('opens the search, with either modifier', () => {
    expect(shortcutFor({ key: 'k', metaKey: true }, document)).toBe(PALETTE);
    expect(shortcutFor({ key: 'K', ctrlKey: true }, document)).toBe(PALETTE);
    expect(PALETTE.action).toBe('search');
  });

  it('leaves every other modified key to the browser', () => {
    expect(shortcutFor({ key: 'l', metaKey: true }, document)).toBeNull();
    expect(shortcutFor({ key: 'k', ctrlKey: true, altKey: true }, document)).toBeNull();
  });

  it('does not fire while typing', () => {
    const input = document.createElement('input');
    expect(shortcutFor({ key: 'k', metaKey: true, target: input }, document)).toBeNull();
  });

  it('leaves bare k to the calendar', () => {
    expect(shortcutFor({ key: 'k' }, document)?.screen).toBe('calendar');
  });
});

// The launcher's destinations must cover the PDF's seven starting intentions.
it('starts meeting preparation, weekly planning and privacy without setup', () => {
  expect(GOALS.some(goal => goal.screen === 'meet')).toBe(true);
  expect(GOALS.some(goal => goal.screen === 'calendar')).toBe(true);
  expect(GOALS.some(goal => goal.screen === 'privacy')).toBe(true);
});
