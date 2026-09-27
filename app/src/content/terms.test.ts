import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { countsByFile, find, overLedger, prose } from './terms';
import { LEDGER } from './ledger';

/**
 * The vocabulary rule, from the test suite's side.
 *
 * `npm run lint` runs the same functions through `scripts/terms.mjs`. What
 * this adds is the edges of the "is this user-facing?" heuristic, shown on
 * snippets, and a proof that the ledger actually holds a line: a rule that
 * has never failed is not known to be a rule.
 */

const src = join(process.cwd(), 'src');

function withFile(name: string, text: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'terms-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', name), text);
  return join(dir, 'src');
}

const ids = (dir: string) => find(dir).map((h) => h.id);

describe('the vocabulary rule', () => {
  it('passes on the app as it stands', () => {
    expect(overLedger(src, LEDGER).map((p) => `${p.file}:${p.line} ${p.found}`)).toEqual([]);
  });

  it('has a ledger that matches the tree, so a fix is recorded rather than banked', () => {
    // A stale ledger lets a file drift back up to its old number unnoticed.
    // `npm run lint:terms -- --fix` rewrites it.
    expect(countsByFile(src)).toEqual(LEDGER);
  });

  it('fails when a retired word is added to a file the ledger does not list', () => {
    const dir = withFile('One.tsx', `export const A = () => <button>Add to your to-do list</button>;`);
    const problems = overLedger(dir, {});
    expect(problems).toHaveLength(1);
    expect(problems[0].says).toContain('use action');
  });

  it('fails when a listed file goes one over', () => {
    const dir = withFile(
      'One.tsx',
      `export const A = () => (<><p>Your task</p><p>Another task</p></>);`,
    );
    expect(overLedger(dir, { 'One.tsx': { task: 2 } })).toEqual([]);
    expect(overLedger(dir, { 'One.tsx': { task: 1 } })).toHaveLength(2);
  });

  it('reads prose in string literals and templates, not keys or class names', () => {
    const dir = withFile(
      'One.tsx',
      `type K = 'task' | 'deadline';
export const A = ({ n }: { n: number }) => (
  <div className="bare tappable task-clear" title="Make a task from this">
    {say(\`\${n} tasks added\`)}
  </div>
);`,
    );
    expect(ids(dir)).toEqual(['task', 'task']);
  });

  it('ignores comments, arrow functions, and other products’ names', () => {
    const dir = withFile(
      'One.tsx',
      `// Something went wrong here once, see the task list.
export const A = () => (
  <button onClick={() => go('x')}>Send to Google Tasks</button>
);`,
    );
    expect(ids(dir)).toEqual([]);
  });

  it('does not count "to do" as a verb', () => {
    expect(prose(`<p>There is nothing else to do.</p>`)).toHaveLength(1);
    const dir = withFile('One.tsx', `export const A = () => <p>There is nothing else to do.</p>;`);
    expect(ids(dir)).toEqual([]);
  });

  it('reads labels in .ts files too, where most of the app\u2019s words live', () => {
    const dir = withFile('undo.ts', `export const LABELS = { deleteTask: { label: 'Task deleted' } };`);
    expect(ids(dir)).toEqual(['task']);
  });

  it('leaves course material in data/ alone: those words are the author\u2019s', () => {
    const dir = mkdtempSync(join(tmpdir(), 'terms-'));
    mkdirSync(join(dir, 'src', 'data'), { recursive: true });
    writeFileSync(join(dir, 'src', 'data', 'guide.ts'), `export const G = 'The assignment of tasks by sex';`);
    writeFileSync(join(dir, 'src', 'One.tsx'), `export const A = () => <p>Your action</p>;`);
    expect(ids(join(dir, 'src'))).toEqual([]);
  });

  it('names the generic error message', () => {
    const dir = withFile('One.tsx', `export const A = () => <p>Something went wrong.</p>;`);
    expect(ids(dir)).toEqual(['something went wrong']);
  });
});
