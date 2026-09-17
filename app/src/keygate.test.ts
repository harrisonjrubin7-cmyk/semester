/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * A screen gated on a key says so with a button, not with a paragraph.
 *
 * `components/NeedsKey.tsx` exists because eight screens had written the same
 * sentence by hand — *"Sign in to use the shared key, or add your own under
 * Settings → The assistant"* — and not one of them was a link. Its own
 * docstring names the shape: a dead end with directions printed on it, drawn
 * in the one place on the screen where an action belongs.
 *
 * Nine call sites took the component. **Three gates did not**, and survived it
 * for long enough that their directions went stale underneath them:
 *
 *   - `components/mail/Compose.tsx` drew a disabled *Draft it* and a line of
 *     dim prose under it reading "Ask Claude → Settings".
 *   - `screens/Update.tsx`, twice, sent you to "Connect → Claude" — a screen
 *     that had already moved the key field out to Settings and kept only a
 *     signpost row, whose own subtitle then says "Set one in Settings". A
 *     signpost to a signpost.
 *
 * Three screens, three wordings, one destination — which is the thing the
 * component was written to make impossible, and which no test could see,
 * because every screen rendered exactly what its author intended.
 *
 * ## What this reads, and why it is not a grep for "shared key"
 *
 * Plenty of places in the app discuss the shared key on purpose and must stay
 * green: `screens/settings/Assistant.tsx` explains in JSX text that "There is
 * no shared key on this side" of the OpenAI route, and `screens/Data.tsx` and
 * `screens/Import.tsx` quote the old sentence in comments about why it went.
 * A string test would fail on all of them, so this keys on the shape instead.
 *
 * A gate is two halves in one **rendered run of text**: it names what the
 * screen cannot do without the assistant, and then says where the key lives.
 * The `[^<]` between them is the structural part and is doing the real work —
 * a run with no tag in it can hold no button, so matching it *is* the finding
 * "dim prose standing where the action belongs". Prose that merely mentions
 * the shared key has no gating clause; prose that gates has a button, and a
 * button is a tag.
 *
 * A screen that merely *explains* the shared key keeps saying so and stays
 * green, because explaining is not gating. One screen writes the whole
 * sentence and is still not a gate, and it is exempted below rather than
 * silently — see `BESIDE_A_DOOR`, whose entry has to keep earning itself.
 *
 * What the wording costs when it is retyped is the reason any of this is
 * worth a test: the three said "Ask Claude → Settings", "Connect → Claude"
 * and "Connect → Claude" for one place that `lib/settings.ts` calls "The
 * assistant" — and Update's two named a screen that had already moved the
 * key field out to Settings, so following them landed on a signpost.
 *
 * It reads source rather than rendering anything, so like `rootunmount.test.ts`
 * it is a heuristic and can be wrong in both directions — a gate split across
 * two elements would slip past, and comment stripping is regex-deep rather
 * than parser-deep. It is the cheap check that catches the shape that actually
 * happened. `screens/deadends.test.tsx` is the expensive one: it mounts Import
 * cold with no key and counts what can be pressed.
 */

const ROOT = new URL('.', import.meta.url);

/** The component that owns the sentence, and the only place it may be written. */
const OWNER = 'components/NeedsKey.tsx';

/**
 * The screens that say it beside a control rather than instead of one.
 *
 * An exemption that has to keep earning itself: the value is what makes the
 * file *not* a gate, and the entry only covers it while that is still there.
 *
 * `screens/FirstRun.tsx` is the whole list. It draws two working routes —
 * "Add your first course" and "Add a course by hand" — and then a footnote
 * saying which of the two needs a key, which is explanatory prose next to
 * live buttons rather than prose standing where a button should be. It is a
 * fourth copy of the sentence and that is a real cost, but it cannot be the
 * component's copy: `NeedsKey` deliberately does *not* name a destination,
 * because it is the way there, and a footnote with no button has to say
 * "Settings" out loud. It names the right one.
 *
 * If those doors ever go, the footnote is the shape after all, the pattern
 * stops matching and this file goes red for it.
 */
const BESIDE_A_DOOR: Record<string, RegExp> = {
  'screens/FirstRun.tsx': /<Door\b[\s\S]*?onClick=\{go\}/,
};

/** Exempt, and still earning it. */
const excused = (path: string, source: string) =>
  path in BESIDE_A_DOOR && BESIDE_A_DOOR[path].test(source);

function sources(dir = ROOT, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const at = new URL(entry, dir);
    if (statSync(at).isDirectory()) sources(new URL(`${entry}/`, dir), found);
    // Tests quote what the screens render, and the screens are what this reads.
    else if (/\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry)) {
      found.push(at.pathname.slice(ROOT.pathname.length));
    }
  }
  return found;
}

const read = (path: string) => readFileSync(new URL(path, ROOT), 'utf8');

/**
 * The source with its comments blanked, so only what a screen renders is left.
 *
 * Blanked rather than removed, so the line numbers a failure prints still find
 * the thing on the screen. `//` after a colon is left alone — that is a URL.
 */
function rendered(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(?<!:)\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

/**
 * One run of text that says the screen needs the assistant, and then says
 * where the key is instead of taking you there.
 *
 * `[^<]` holds it to a single run: no element between the two halves, so no
 * button in it either. "needs no key at all" is the `also` half several
 * screens legitimately carry and does not match — `a key` is not `no key`.
 */
const GATE =
  /needs?\s+(?:\{\s*provider\(\)\s*\}|a key\b|the assistant\b)[^<]*?(?:shared key|add your own)/i;

/** Every gate in one file, as somewhere a failure can be opened. */
function gatesIn(path: string, source: string): string[] {
  const all = new RegExp(GATE.source, 'gi');
  return [...source.matchAll(all)].map(
    (m) => `${path}:${source.slice(0, m.index).split('\n').length}`,
  );
}

describe('a screen that needs a key', () => {
  it('draws the gate that takes you there, rather than a paragraph naming it', () => {
    const files = sources();

    // If this is ever empty the walk has stopped matching and the test has
    // stopped testing anything, which is the one way a guard fails silently.
    expect(files.length).toBeGreaterThan(100);

    // And a clean reading is a claim about the probe too: the files that talk
    // about the shared key on purpose must actually be among the ones read,
    // or "clean" only means the scan never looked.
    expect(files, 'the prose this has to leave alone was not scanned').toEqual(
      expect.arrayContaining(['screens/settings/Assistant.tsx', OWNER]),
    );

    const gates = files
      .filter((f) => f !== OWNER && !excused(f, read(f)))
      .flatMap((f) => gatesIn(f, rendered(read(f))));
    expect(
      gates,
      'a hand-written key gate — use <NeedsKey/>, see the note at the top of this file',
    ).toEqual([]);
  });

  /*
   * The probe, against work it has already done and work it must not do.
   *
   * A guard that has never failed is not known to be a guard, and this one
   * reads for an absence, so once the three gates are gone there is nothing
   * left in the tree to prove it still sees them. These fixtures are the three
   * sentences it was written for, verbatim, and the prose it has to walk past.
   */
  it('sees the three sentences it was written for', () => {
    for (const said of [
      'Drafting it for you needs {provider()} — sign in to use the shared key, or add\n' +
        'your own under <strong>Ask Claude &rarr; Settings</strong>.',
      'Turning a reading into cards needs {provider()}. Sign in to use the shared key, or add\n' +
        "your own under Connect → Claude. The text is still kept as the unit's notes.",
      'Reading a photograph needs {provider()}. Sign in to use the shared key, or add your own under\n' +
        'Connect → Claude. You can still attach the photo as a file below.',
    ]) {
      expect(GATE.test(rendered(said)), said).toBe(true);
    }
  });

  it('walks past the prose that discusses the shared key without gating on it', () => {
    for (const fine of [
      // settings/Assistant.tsx, in JSX text — no gating clause before it.
      'There is no shared key on this side — the server function holds an Anthropic key\n' +
        'and nothing else.',
      // The call sites, whose local half is about what needs *no* key.
      '<NeedsKey also="A paper from your cards needs no key at all." />',
      '<NeedsKey also="Building a deck from a unit needs no key at all." />',
      // A comment quoting the sentence to say why it went — Import.tsx does this.
      '{/* answers "No key yet. Sign in to use the shared one, or add your own under\n' +
        'Settings" (`lib/claude.ts`) — directions, in an error card, after the work. */}',
      // The shape done right: the two halves are there, but a button is between
      // them, so this is not prose standing in for an action.
      'Needs {provider()}.<ActionButton onClick={go}>Set up the assistant</ActionButton>\n' +
        'Sign in to use the shared key, or add your own.',
    ]) {
      expect(GATE.test(rendered(fine)), fine).toBe(false);
    }
  });

  /*
   * The control: the screens that already took the component.
   *
   * Nine call sites across eight files. A probe that flagged them too would
   * still make the test above go green once they were "fixed", and measuring
   * eight suspects and finding eight problems is also what a broken probe
   * looks like.
   */
  it('leaves the screens that already use it alone', () => {
    const took = sources().filter((f) => read(f).includes('<NeedsKey'));
    expect(took.length, 'nobody uses <NeedsKey/> — the filter has rotted').toBeGreaterThan(5);
    expect(took.flatMap((f) => gatesIn(f, rendered(read(f))))).toEqual([]);
  });

  /*
   * And the exemption, from both ends.
   *
   * An allowlist entry is a claim about a file, and a claim nothing checks is
   * how one outlives its reason. So: the file is still there, it still writes
   * the sentence (or the entry is spent and should go), and the thing that
   * excuses it is still on the screen.
   */
  it('excuses the one screen that says it beside a door, and only while the door is there', () => {
    for (const [path, door] of Object.entries(BESIDE_A_DOOR)) {
      const source = read(path);
      expect(
        gatesIn(path, rendered(source)),
        `${path} no longer writes the sentence — drop its entry`,
      ).not.toEqual([]);
      expect(door.test(source), `${path} lost the control the exemption is for`).toBe(true);
    }

    // And the exemption is a named file, not a hole: nothing else may use it.
    expect(Object.keys(BESIDE_A_DOOR)).toEqual(['screens/FirstRun.tsx']);
  });
});
