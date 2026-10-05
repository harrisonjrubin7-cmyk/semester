/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every screen sits in the one frame, or says why it does not.
 *
 * Rule 1 of the UI constitution (`docs/design/SEMESTER-UI-CONSTITUTION.md`)
 * is that every screen uses the same shell. The header, the tab bar and the
 * skip link are drawn once, by `App.tsx`, so no screen can leave those out.
 * The part a screen *can* leave out is `components/Page.tsx`: the gutter, the
 * purpose sentence, the screen's own action row and the space above the tab
 * bar. Fifty-nine screens hand-wrote that once, each slightly differently,
 * and `Page` is what they converged on. This is what keeps the next screen
 * from hand-writing it again.
 *
 * ## What counts, and what this cannot see
 *
 * It reads the modules `screens.tsx` loads screens from, and asks whether the
 * module renders `<Page` — or `<SettingsPage`, the settings pages' own frame,
 * which is accepted and is also the second frame the constitution records as
 * debt: two frames is one more than the rule allows, and converging them is
 * listed there, not done here.
 *
 * It is per module rather than per component, so it is a heuristic in the
 * same way `rootunmount.test.ts` is. `screens/Courses.tsx` exports three
 * screens and one `<Page` satisfies all three. A per-component check would be
 * wrong in the other direction — a screen that renders an inner view which
 * opens the frame would read as frameless — and the failure this exists for
 * is a *new file* with no frame at all, which per module catches.
 *
 * ## The list below only gets shorter
 *
 * Each entry is a screen that draws to its own edges for a stated reason. The
 * second test fails if one of them gains a frame and is not taken off, so the
 * list cannot quietly keep an exemption nobody needs.
 */

const ROOT = new URL('.', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), 'utf8');

/** A module that renders no frame, and the reason it is allowed not to. */
const FRAMELESS: Record<string, string> = {
  'ai/Chat.tsx':
    'A full-height chat with a pinned composer: the frame’s trailing space would sit between the composer and the tab bar.',
  'screens/Search.tsx':
    'The workspace shell’s own front door (`lib/desk.ts`) — the shell looking at itself, not a screen inside it.',
  'screens/Directory.tsx':
    'The workspace shell’s index of every app, drawn into the shell’s own columns (`lib/desk.ts`).',
  'screens/Mail.tsx': 'A two-pane reader that draws to its own edges, like the calendar grid.',
  'screens/call/Index.tsx': 'A video call: the video is the screen, edge to edge.',
  /*
   * The three below each carry a "No `<Page>` here, deliberately" note, and
   * each note's reason is the frame's search box above the content — which
   * `components/Page.tsx` has since removed. The reason is stale; the layout
   * (one card or slide filling the height) may still be. Candidates to adopt
   * `<Page wide bottom={0}>`, recorded in the constitution's debt list.
   */
  'screens/Gap.tsx': 'A timed window between classes: one card filling the height under a countdown.',
  'screens/Drill.tsx': 'A flashcard filling the height under a progress bar; the frame would move it mid-deck.',
  'screens/Slides.tsx': 'A presented slideshow, one slide filling the height.',
  'screens/settings/Index.tsx':
    'The settings index is grouped rows (`components/shell/Rows.tsx`) in every layout; the pages under it use `SettingsPage`.',
};

/** The module every screen in the `SCREENS` table is loaded from. */
function screenModules(): Map<string, string[]> {
  const source = read('screens.tsx');
  const moduleOf = new Map<string, string>();
  for (const m of source.matchAll(/const (\w+) = lazy\(\(\) =>\s*import\('\.\/([^']+)'\)/g)) {
    moduleOf.set(m[1], m[2]);
  }
  const table = /export const SCREENS[^=]*= \{([\s\S]*?)\n\};/.exec(source)?.[1] ?? '';
  const byModule = new Map<string, string[]>();
  for (const m of table.matchAll(/^\s*(\w+): (\w+),$/gm)) {
    const mod = moduleOf.get(m[2]);
    if (!mod) throw new Error(`screens.tsx: ${m[1]} renders ${m[2]}, which is not a lazy import this test can follow`);
    const file = /\.tsx?$/.test(mod) ? mod : `${mod}.tsx`;
    byModule.set(file, [...(byModule.get(file) ?? []), m[1]]);
  }
  return byModule;
}

/**
 * Comments removed first. Three screens say "No `<Page>` here, deliberately"
 * in a comment, and the first version of this read that sentence as a frame —
 * a clean reading that was a claim about the probe. Only comments that open a
 * line or a JSX expression are removed, so `accept="image/*"` in a string does
 * not swallow the code after it.
 */
const code = (source: string) =>
  source.replace(/(^|\{)[ \t]*\/\*[\s\S]*?\*\//gm, '$1').replace(/^[ \t]*\/\/.*$/gm, '');

const framed = (file: string) => /<(Settings)?Page\b/.test(code(read(file)));

describe('every screen module', () => {
  const modules = screenModules();

  it('renders inside the shared frame, or is on the list with a reason', () => {
    // If the parse stops matching, this empties and the check below passes
    // vacuously — the one way a structural guard fails silently.
    expect(modules.size).toBeGreaterThan(50);
    expect([...modules.values()].flat().length).toBeGreaterThan(80);

    const bare = [...modules.keys()].filter((f) => !framed(f) && !(f in FRAMELESS)).sort();
    expect(
      bare.map((f) => `${f} (${modules.get(f)!.join(', ')})`),
      'wrap the screen in <Page> from components/Page.tsx — see the note at the top of this file',
    ).toEqual([]);
  });

  it('and nothing on the list has since gained a frame or gone away', () => {
    const stale = Object.keys(FRAMELESS).filter((f) => !modules.has(f) || framed(f));
    expect(stale, 'take these off FRAMELESS in src/pageframe.test.ts').toEqual([]);
  });
});
