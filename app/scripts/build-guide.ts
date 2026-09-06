/**
 * Build the guide, and fail the build if the guide and the app disagree.
 *
 * The markdown file is the by-product. The point is the check: a screen added
 * to the registry and not to the guide stops the build here, and so does a
 * screen named in the guide that no longer exists. A guide that can go stale
 * silently is worse than no guide at all, because somebody follows it and
 * concludes the app is broken.
 *
 * ## Where it runs, and why not where the spec said
 *
 * The spec asked for a script run at build time. This repository has no
 * TypeScript runner — no tsx, no ts-node, no vite-node — and the obvious
 * alternative, a Vite plugin, means `vite.config.ts` importing from `src/`.
 * That config is compiled under `moduleResolution: nodenext`, which would
 * force explicit `.js` extensions on every relative import in the source tree
 * it reaches. A guide check is not worth rewriting the imports of the app.
 *
 * So the check runs in `guidebook.test.ts`, under the suite CI already runs.
 * That is the enforcement the spec actually wanted — a registry/guide
 * mismatch fails CI — and it arrives in a second rather than at the end of a
 * build.
 *
 * The markdown is not written to disk at all. It is produced in the browser
 * from this same module and handed to the existing download mechanism, so
 * there is no generated file that can be stale with respect to the code that
 * generated it.
 */

import { build, check, toMarkdown } from '../src/lib/guidebook';
import { DESTINATIONS } from '../src/lib/nav';

export interface Built {
  markdown: string;
  problems: string[];
  screens: number;
  sections: number;
}

/** Assemble the guide and check it. Pure — writes nothing. */
export function buildGuide(): Built {
  const book = build();
  return {
    markdown: toMarkdown(book),
    problems: check(book),
    screens: DESTINATIONS.length,
    sections: book.sections.length,
  };
}

/** What a failure reads like, in one place so the plugin and the test agree. */
export function complaint(problems: string[]): string {
  return [
    'The guide and the app disagree:',
    '',
    ...problems.map((p) => `  - ${p}`),
    '',
    `${problems.length} problem${problems.length === 1 ? '' : 's'}. Edit src/lib/guidebook.ts, or the registry, until they agree.`,
  ].join('\n');
}

