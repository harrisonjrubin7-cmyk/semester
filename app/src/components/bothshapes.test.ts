import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A module written in two shapes has both shapes on screen.
 *
 * `components/Clashes.tsx` and `components/StartToday.tsx` are each one
 * question answered at two lengths, and each says so at the top of itself:
 *
 * > Two shapes from one source. On Today it is a single line about the
 * > nearest hard day, because a screen that opens with four warnings is a
 * > screen people learn to scroll past. In the week ahead it is the full
 * > list, where somebody has already come to look at the shape of a
 * > fortnight.
 *
 * The short forms — `WorstDay`, `StartToday` — are sections of Today's feed.
 * The long forms — `ClashList`, `StartList` — were rendered by
 * `screens/Ahead.tsx`, and `80fbc5c` merged that screen into Today's *This
 * week* tab.
 *
 * ## What the merge carried, and what it did not
 *
 * That commit has a heading of its own — *What the merge had to carry* — and
 * under it the keywords, the `taskTags`, the assistant's context provider and
 * the header hero. `Ahead.tsx` rendered four things. `Capacity` and
 * `DayBudget` are controls and both went to Settings → Workload. `ClashList`
 * and `StartList` are the content, and both went nowhere: from that merge
 * until the twenty-sixth simplify pass, neither was drawn on any screen in
 * the app.
 *
 * It is the third merge in this file's history to lose something while
 * auditing itself in prose — `4eb1044` listed what it carried and missed the
 * reveal gate, `80fbc5c` listed what it carried and missed these two — which
 * is the argument for asking it here instead. A prose list of what a merge
 * carried is a claim; this is a check.
 *
 * ## Why the pairing is the test rather than the two names
 *
 * Naming `ClashList` would guard today's instance and nothing else. The fault
 * is structural: a module that answers one question at two lengths can lose
 * either length to a merge of the screen that held it, and the short form
 * surviving is exactly what makes the loss invisible — Today still warned
 * about the nearest hard day, so nothing looked broken.
 */
const SRC = new URL('..', import.meta.url).pathname;

/** Every module that draws one question at two lengths, and both its shapes. */
const PAIRS: { file: string; short: string; long: string }[] = [
  { file: 'components/Clashes.tsx', short: 'WorstDay', long: 'ClashList' },
  { file: 'components/StartToday.tsx', short: 'StartToday', long: 'StartList' },
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    return [full];
  });
}

/** The screens and components that pull a name out of that module. */
function drawnBy(file: string, name: string): string[] {
  const mod = file.replace(/^components\//, '').replace(/\.tsx?$/, '');
  const from = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'[^']*${mod}'`);
  return sources(SRC)
    .filter((f) => !f.endsWith(join(SRC, file)))
    .filter((f) => {
      const code = readFileSync(f, 'utf8');
      const m = from.exec(code);
      if (!m || !new RegExp(`\\b${name}\\b`).test(m[1])) return false;
      /*
       * Imported is not drawn, so the name has to appear again outside its
       * own import — but not necessarily as `<Name />`. `WorstDay` and
       * `StartToday` are entries in Today's section registry (`clash:
       * WorstDay`), which is a render and does not look like a tag. The
       * first version of this required the tag and failed on both short
       * forms, which are the two halves that were never in doubt.
       */
      const rest = code.replace(m[0], ' ');
      return new RegExp(`\\b${name}\\b`).test(rest);
    })
    .map((f) => f.slice(SRC.length));
}

describe('a question written at two lengths', () => {
  it('found the modules, or the rest of this proves nothing', () => {
    for (const p of PAIRS) {
      const code = readFileSync(join(SRC, p.file), 'utf8');
      expect(code, p.file).toContain(`export function ${p.short}`);
      expect(code, p.file).toContain(`export function ${p.long}`);
    }
    // The probe, pointed at its own failure: a name nothing renders must
    // come back empty, which is the state both long forms were in.
    expect(drawnBy('components/Clashes.tsx', 'NotAComponent')).toEqual([]);
  });

  it.each(PAIRS)('draws the short form of $file', ({ file, short }) => {
    expect(drawnBy(file, short)).not.toEqual([]);
  });

  it.each(PAIRS)('draws the long form of $file too', ({ file, long }) => {
    // The half that went missing. `Ahead.tsx` held both of these and was
    // merged away; the short forms stayed on Today's feed, so the app went
    // on warning about the nearest hard day and stopped showing the week.
    expect(drawnBy(file, long)).not.toEqual([]);
  });
});
