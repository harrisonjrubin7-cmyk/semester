import { describe, expect, it } from 'vitest';
import type { Reminder } from '../notify';
import { present } from './envelope';
import { feedItems, notificationsEnvelope, type FeedInput } from './notifications';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const r = (id: string, rule: Reminder['rule'], title = id): Reminder => ({ id, rule, title, body: '' });
const input = (over: Partial<FeedInput> = {}): FeedInput => ({
  ready: true,
  reminders: [r('a', 'sun'), r('b', 'bill'), r('c', 'class')],
  dismissed: new Set(),
  online: true,
  permission: 'granted',
  now: NOW,
  ...over,
});
const surface = (i: FeedInput) => present(notificationsEnvelope(i), NOW);

describe('notifications envelope', () => {
  it('is loading — not empty — until the store is ready', () => {
    expect(surface(input({ ready: false, reminders: [] })).surface).toBe('loading');
    // Control: ready with nothing due is a different answer.
    expect(surface(input({ reminders: [] })).surface).toBe('empty');
  });

  it('orders critical before important before helpful, keeping rule order within a tier', () => {
    expect(feedItems([r('a', 'sun'), r('b', 'class'), r('c', 'bill'), r('d', 'today')]).map((i) => i.id)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('every item carries a why-line', () => {
    const p = surface(input());
    expect(p.data?.every((i) => i.why.startsWith('Why:'))).toBe(true);
  });

  it('is derived and estimated, never institution-verified', () => {
    const env = notificationsEnvelope(input());
    expect(env.authority).toBe('derived');
    expect(env.source.kind).toBe('estimated');
    expect(present(env, NOW).state).toBe('connected');
  });

  it('putting everything away is empty, says so, and offers to bring it back', () => {
    const env = notificationsEnvelope(input({ dismissed: new Set(['a', 'b', 'c']) }));
    const p = present(env, NOW);
    expect(p.surface).toBe('empty');
    expect(p.limitations[0]).toMatch(/put everything away/);
    expect(p.recovery[0].action).toBe('restore');
  });

  it('putting one away leaves the others', () => {
    expect(surface(input({ dismissed: new Set(['b']) })).data?.map((i) => i.id)).toEqual(['c', 'a']);
  });

  it('offline keeps the list and says nothing external can arrive', () => {
    const p = surface(input({ online: false }));
    expect(p.surface).toBe('offline');
    expect(p.data).toHaveLength(3);
    expect(p.limitations.join(' ')).toMatch(/offline/i);
  });

  it('a blocked browser permission is stated, because the pop-up will not come', () => {
    expect(surface(input({ permission: 'denied' })).limitations.join(' ')).toMatch(/blocking pop-ups/);
    expect(surface(input({ permission: 'granted' })).limitations.join(' ')).not.toMatch(/pop-up/);
  });
});
