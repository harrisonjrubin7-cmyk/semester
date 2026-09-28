import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHANNELS, EMPTY_PREFS, admit, digestGroups, inQuietHours, visible, type Message } from './comms';

/**
 * The hub's rules, as `comms.ts` states them: every message carries its
 * source, required is official-only and current-only, nothing sponsored,
 * no escalation (there is no send function here), and required notices
 * ignore mute and quiet hours.
 */

const at = (h: number) => `2026-09-28T${String(h).padStart(2, '0')}:00:00Z`;
const msg = (over: Partial<Message>): Message => ({ id: over.id ?? 'm', channel: 'semester', source: 'Launchpad', title: 'A note', at: at(9), priority: 'normal', ...over });

describe('the hub', () => {
  it('has no send function: it shows, and never emails, texts or pushes', () => {
    const src = readFileSync(join(import.meta.dirname, 'comms.ts'), 'utf8');
    for (const name of ['send', 'email', 'push', 'text', 'notify', 'fetch']) expect(src, `exports ${name}`).not.toMatch(new RegExp(`export (async )?function ${name}\\b`));
    expect(src).not.toMatch(/\bfetch\(|navigator\.sendBeacon|new Notification\(/);
  });

  it('drops a message with no source, no title, or a sponsor', () => {
    const { shown, refused } = admit([
      msg({ id: 'a' }),
      msg({ id: 'b', source: '  ' }),
      msg({ id: 'c', title: '' }),
      msg({ id: 'd', sponsored: true }),
    ]);
    expect(shown.map((m) => m.id)).toEqual(['a']);
    expect(refused).toBe(3);
  });

  it('lets only a current official message be required, and downgrades the rest to soon', () => {
    const { shown } = admit([
      msg({ id: 'hold', channel: 'official', source: 'Registrar', priority: 'required', current: true }),
      msg({ id: 'stale', channel: 'official', source: 'Registrar', priority: 'required', current: false }),
      msg({ id: 'ours', channel: 'semester', priority: 'required' }),
    ]);
    const by = Object.fromEntries(shown.map((m) => [m.id, m.priority]));
    expect(by).toEqual({ hold: 'required', stale: 'high', ours: 'high' });
  });

  it('keeps only an https link, and sorts required first then by time', () => {
    const { shown } = admit([
      msg({ id: 'later', at: at(12), url: 'http://example.edu/x' }),
      msg({ id: 'earlier', at: at(8), url: 'https://example.edu/y' }),
      msg({ id: 'hold', channel: 'official', source: 'Registrar', priority: 'required', current: true, at: at(15) }),
    ]);
    expect(shown.map((m) => m.id)).toEqual(['hold', 'earlier', 'later']);
    expect(shown.find((m) => m.id === 'later')!.url).toBeUndefined();
    expect(shown.find((m) => m.id === 'earlier')!.url).toBe('https://example.edu/y');
  });

  it('shows a required notice through mute and quiet hours, and holds the optional ones', () => {
    const prefs = { ...EMPTY_PREFS, muted: ['official' as const], quietFrom: 22 * 60, quietTo: 7 * 60 };
    const messages = [
      msg({ id: 'hold', channel: 'official', source: 'Registrar', priority: 'required' }),
      msg({ id: 'official-fyi', channel: 'official', source: 'Registrar', priority: 'normal' }),
      msg({ id: 'ours' }),
    ];
    const night = visible(messages, prefs, 23 * 60);
    expect(night.now.map((m) => m.id)).toEqual(['hold']);
    expect(night.held).toBe(1);
    const day = visible(messages, prefs, 10 * 60);
    expect(day.now.map((m) => m.id)).toEqual(['hold', 'ours']);
    expect(day.held).toBe(0);
  });

  it('knows quiet hours that wrap midnight, and none when from equals to', () => {
    expect(inQuietHours(23 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(inQuietHours(3 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(inQuietHours(12 * 60, 22 * 60, 7 * 60)).toBe(false);
    expect(inQuietHours(12 * 60, 9 * 60, 17 * 60)).toBe(true);
    expect(inQuietHours(12 * 60, 8 * 60, 8 * 60)).toBe(false);
  });

  it('groups a digest by day, and by week for weekly', () => {
    const messages = [msg({ id: 'mon', at: '2026-09-28T09:00:00Z' }), msg({ id: 'tue', at: '2026-09-29T09:00:00Z' }), msg({ id: 'next', at: '2026-10-06T09:00:00Z' })];
    expect(digestGroups(messages, 'daily').map((g) => g.items.map((m) => m.id))).toEqual([['mon'], ['tue'], ['next']]);
    expect(digestGroups(messages, 'weekly').map((g) => g.items.map((m) => m.id))).toEqual([['mon', 'tue'], ['next']]);
    expect(CHANNELS.map((c) => c.id)).toEqual(['official', 'course', 'semester']);
  });
});
