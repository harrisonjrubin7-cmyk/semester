/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { queueFor } from './push';
import type { NotifKey } from '../data/misc';
import type { DatedItem } from './types';

/**
 * The five hops a reminder makes, and the two places it lost its destination.
 *
 * `queueFor` works out where a reminder should land, and `land.test.ts` proves
 * that. What no test covered was everything after: the upload wrote a hardcoded
 * empty string over the answer, and the Edge Function did not select the column
 * at all. Both were invisible because each end was correct on its own.
 *
 * So this reads the actual files. It is a coarse instrument — a string search
 * over source — and it is the right one here, because the failure mode is a
 * field silently missing from one of five hops written in three languages, and
 * no amount of unit testing either end catches that.
 *
 * The hops:
 *   1. `queueFor`            works out screen and item
 *   2. `saveQueue`           writes them to the row
 *   3. `push_queue`          has columns to hold them
 *   4. the Edge Function     selects them and puts them in the payload
 *   5. `sw.js`               reads them onto the notification and its click
 */

const repo = join(process.cwd(), '..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const ALL_ON: Record<NotifKey, boolean> = {
  class: true,
  today: true,
  free: true,
  two: true,
  term: true,
  exam: true,
  sun: true,
};

const soon = {
  id: 'econ-ps4',
  courseId: 'econ',
  title: 'Problem Set 4',
  kind: 'problem set',
  dueShort: 'Thu 11:59 PM',
  weight: '5%',
  daysAway: 2,
  isToday: false,
} as unknown as DatedItem;

describe('a reminder keeps its destination all the way to the phone', () => {
  it('1. is worked out when the week is queued', () => {
    const queue = queueFor(new Date(2026, 8, 8, 8, 0), ALL_ON, () => ({
      items: [soon],
      classes: [],
    }));
    const two = queue.find((r) => r.id.startsWith('two:'));
    expect(two?.screen).toBe('item');
    expect(two?.item).toBe('econ-ps4');
  });

  it('2. is written to the row rather than overwritten with a blank', () => {
    // It was `screen: ''` — the answer thrown away one line before it left the
    // device, which made every tap open the app at home.
    const src = read('app/src/lib/cloud.ts');
    const insert = src.slice(src.indexOf('push_queue').valueOf());
    expect(src).toContain('screen: r.screen ?? ');
    expect(src).toContain('item: r.item ?? ');
    expect(insert).not.toContain("screen: ''");
  });

  it('3. has somewhere to be stored', () => {
    const sql = read('supabase/push.sql');
    expect(sql).toMatch(/screen\s+text/);
    expect(sql).toMatch(/item\s+text/);
    // An existing project must be able to gain the column without a rebuild.
    expect(sql).toContain('add column if not exists item');
  });

  it('4. is selected and sent by the function that delivers it', () => {
    const fn = read('supabase/functions/push/index.ts');
    expect(fn).toContain('screen, item');
    expect(fn).toContain('screen: row.screen');
    expect(fn).toContain('item: row.item');
  });

  it('5. reaches the notification, and its tap', () => {
    const sw = read('app/public/sw.js');
    // On the notification's data…
    expect(sw).toContain("screen: said.screen || ''");
    expect(sw).toContain("item: said.item || ''");
    // …and read back out of it when tapped, for both an open tab and a cold
    // start.
    expect(sw).toContain('event.notification.data?.item');
    expect(sw).toContain('postMessage({ type: \'go\', screen, item })');
    expect(sw).toContain('item=');
  });

  it('and the app is listening at the other end', () => {
    // The worker posted a destination for months and nothing read it.
    const tapped = read('app/src/components/Tapped.tsx');
    expect(tapped).toContain("addEventListener('message'");
    expect(tapped).toContain('landingFrom');
  });
});
