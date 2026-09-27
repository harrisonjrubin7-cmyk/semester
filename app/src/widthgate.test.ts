/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every file that asks how wide the window is, and what it does with the answer.
 *
 * The rule `docs/ADAPTIVE-DEVICE-EXPERIENCE.md` sets down is that the width of
 * a window may change *how* something is reached and never *whether* it can
 * be. It is easy to agree with and easy to break without noticing, because a
 * capability that a narrow window loses is an absence: it does not show up in
 * a screenshot of the wide layout, which is the one the author was looking at.
 *
 * Two had been broken that way when this was written, and both were found by
 * reading the files below, not by any test:
 *
 *   - Mail sliced its list to fifty at every width and drew the arrows to the
 *     next fifty only in the wide toolbar. On a phone, the fifty-first
 *     conversation in a folder could be searched for and not browsed to.
 *     (`screens/mailpaging.test.tsx`.)
 *   - The keyboard shortcuts listened only on a wide window, so a laptop
 *     browser dragged to half its screen had no `?`, `/` or `n`. Width was
 *     standing in for "has a keyboard", and answering it worse.
 *     (`components/keysnarrow.test.tsx`.)
 *
 * So this is the structural half, in the manner of `rootunmount.test.ts`: it
 * cannot tell whether a width check is safe, but it can make sure nobody adds
 * one without writing down, here, what the narrow window gets instead. A new
 * file that reads `WIDE`, `DESKTOP`, `HANDHELD` or `useTier()` fails until it
 * has a row; a row whose file has stopped asking fails too, so the table does
 * not go stale.
 *
 * What a row must say is the narrow window's route to the same thing. "It is
 * hidden" is not a row.
 */
const ASKS: Record<string, string> = {
  'App.tsx':
    'Picks the frame: tab bar under a phone, rail beside a tablet or desktop. Every screen is reachable from both — lib/chrome.ts and chrome.test.ts hold that rule.',
  'ai/Assistant.tsx':
    'Where the assistant button sits (clear of the tab bar on a phone, a corner on a wide window). The assistant itself opens at every width.',
  'ai/Chat.tsx':
    'Conversation history beside the chat when wide; behind a History button as an overlay (ThreadsOver) when narrow.',
  'ai/Panel.tsx':
    'Padding, and a drag handle to expand the sheet that only a narrow sheet has. Same panel, same controls.',
  'components/Adopting.tsx':
    'Whether the first-sign-in question is fixed to the window or the column. Same question, same answers.',
  'components/Bench.tsx':
    'Menus as one sheet of rows on a phone and a menubar on a wide window — the file says "the phone gets all of them".',
  'components/Command.tsx':
    'Sizes of the search palette. The same palette, the same results.',
  'components/Keys.tsx':
    'Asks WIDE together with FINE: shortcuts listen wherever there is probably a keyboard, not only where the window is wide. Every shortcut has a visible control too.',
  'components/QuickAdd.tsx':
    'Whether the capture box is fixed to the window or the column. Same box.',
  'screens/Calendar.tsx':
    'Seven days a row when wide, three when narrow — the arrows step through every day either way, and Month and Agenda are the same at both widths.',
  'screens/Classmates.tsx':
    'Thread list beside the conversation when wide; the list in place of it, one tap back, when narrow.',
  'screens/Mail.tsx':
    'Folder rail beside the list when wide, behind a Folders button when narrow; compose in the rail or as a floating button; the pager in the toolbar or in a row under it. The reading-pane toggle is wide-only because a phone has no pane: the message replaces the list.',
  'screens/deck/Edit.tsx':
    'Slide list and editor side by side, or stacked. Same editor.',
  'screens/mine/Drive.tsx':
    'Folders and files side by side, or stacked. Same files.',
};

const ROOT = new URL('.', import.meta.url).pathname;
const ASK = /useTier\(|useMedia\((WIDE|DESKTOP|HANDHELD)\)/;

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const asking = sources(ROOT)
  .filter((path) => ASK.test(readFileSync(path, 'utf8')))
  .map((path) => relative(ROOT, path))
  // Where the queries are defined, not where they are asked.
  .filter((path) => path !== 'lib/media.ts')
  .sort();

describe('every width check says what the narrow window gets', () => {
  it('finds the checks at all — a control against a broken scan', () => {
    expect(asking).toContain('App.tsx');
    expect(asking.length).toBeGreaterThan(5);
  });

  it.each(asking)('%s has a row', (path) => {
    expect(ASKS[path], `${path} reads the window width — add a row to ASKS saying what a narrow window gets instead`).toBeTruthy();
  });

  it('has no rows for files that no longer ask', () => {
    expect(Object.keys(ASKS).filter((path) => !asking.includes(path))).toEqual([]);
  });
});
