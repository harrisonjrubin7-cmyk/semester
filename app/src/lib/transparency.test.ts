import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SYNC_GROUPS } from './privacy';
import { AI_SHOWS, ARTIFACT_WORD, CATEGORIES, CONTACTS, CONTROLS, NEVER, artifacts, inventoryPhrases } from './transparency';

const root = join(import.meta.dirname, '../../..');
const exists = (p: string) => existsSync(join(root, p));

describe('the Data & AI Transparency page', () => {
  it('maps every synced group onto exactly one category, so the table matches the inventory', () => {
    const seen = CATEGORIES.flatMap((c) => c.groups);
    expect(new Set(seen).size).toBe(seen.length);
    expect([...seen].sort((a, b) => a - b)).toEqual(SYNC_GROUPS.map((_, i) => i));
    for (const c of CATEGORIES) {
      if (c.groups.length === 0) expect(c.note, c.category).toBeTruthy();
      expect(inventoryPhrases(c)).toEqual(c.groups.map((i) => SYNC_GROUPS[i].says));
    }
  });

  it('answers the six things the brief says to show when AI is used, each at a place on screen', () => {
    expect(AI_SHOWS).toHaveLength(6);
    for (const s of AI_SHOWS) expect(s.where.length, s.what).toBeGreaterThan(40);
    expect(AI_SHOWS[5].where).toContain('accessibility issue');
  });

  it('lists the controls as the rows under Me, not a second list', () => {
    expect(CONTROLS.map((c) => c.id)).toContain('export');
    expect(CONTROLS.map((c) => c.id)).toContain('deletion');
    expect(CONTROLS.map((c) => c.id)).toContain('sharing');
    expect(CONTROLS.map((c) => c.id)).toContain('connected');
    expect(CONTROLS.map((c) => c.id)).toContain('notifications');
    expect(CONTROLS.map((c) => c.id)).toContain('ai');
  });

  it('holds every “never” to a path in the tree', () => {
    expect(NEVER).toHaveLength(6);
    for (const n of NEVER) expect(exists(n.path), n.path).toBe(true);
  });

  it('gives every required artifact a status, and a path unless it is not started', () => {
    const list = artifacts();
    expect(list).toHaveLength(13);
    for (const a of list) {
      expect(ARTIFACT_WORD[a.status], a.title).toBeTruthy();
      if (a.status === 'not-started') expect(a.path, a.title).toBeNull();
      else expect(exists(a.path!), `${a.title} cites ${a.path}`).toBe(true);
    }
    expect(list.filter((a) => a.status === 'in-force')).toHaveLength(0);
  });

  it('routes every question to a seat by subject', () => {
    for (const c of CONTACTS) expect(c.subject.length).toBeGreaterThan(2);
    expect(CONTACTS.map((c) => c.seat)).toContain('the privacy seat');
  });
});
