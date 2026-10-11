import { loadRegistry } from './registry-io.ts';
import { validateSnapshot } from './validation.ts';

const issues = await validateSnapshot(await loadRegistry());
if (issues.length) {
  console.error(JSON.stringify({ valid: false, issues }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ valid: true, issues: [] }, null, 2));
}
