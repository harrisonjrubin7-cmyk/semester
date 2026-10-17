#!/usr/bin/env node
/**
 * Evidence census for every public export in the scoped Semester design system.
 *
 * This is deliberately a census, not a readiness assertion. A component is
 * complete only when each requirement from the design-system brief has a
 * repository evidence path. Missing evidence remains visible in the report.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { componentEvidence, publicComponents } from '../../packages/platform-control/src/design-system-component-evidence.ts';

export { componentEvidence, publicComponents };

if (process.argv[1]?.endsWith('design-system-component-evidence.mjs')) {
  const args = process.argv.slice(2);
  const rootArg = args.indexOf('--root');
  const result = componentEvidence(rootArg >= 0 ? { root: resolve(args[rootArg + 1]) } : {});
  const outArg = args.indexOf('--out');
  if (outArg >= 0) {
    const out = resolve(args[outArg + 1]);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${out}`);
  } else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
