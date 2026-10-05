import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adHocFieldErrors, OWNER } from './fielderror';

/**
 * The field-error rule, held to the tree — see `fielderror.ts` for why.
 *
 * The controls matter as much as the pass: a scan that finds nothing in the
 * app is also what a scan that reads nothing looks like, so each shape it
 * exists to catch is fed to it on its own and must come back caught.
 */

const src = join(process.cwd(), 'src');

function withFiles(files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'fielderror-')), 'src');
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

describe('the field-error rule', () => {
  it('passes on the app as it stands', () => {
    expect(adHocFieldErrors(src).map((f) => `${f.file}:${f.line} ${f.found}`)).toEqual([]);
  });

  it('catches aria-invalid written by hand', () => {
    const found = adHocFieldErrors(
      withFiles({
        'screens/One.tsx': `export const A = () => (\n  <input aria-label="URL" aria-invalid={bad ? true : undefined} />\n);`,
      }),
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ file: 'screens/One.tsx', line: 2, found: 'aria-invalid' });
  });

  it('catches the old hand-rolled validation state beside an input', () => {
    // The exact shape Meals, Housing, Costs and Bill had.
    const found = adHocFieldErrors(
      withFiles({
        'screens/Two.tsx': `export function A() {\n  const [bad, setBad] = useState('');\n  return (<><input aria-label="Amount" />{bad ? <div>{bad}</div> : null}</>);\n}`,
      }),
    );
    expect(found.map((f) => f.found)).toEqual(['const [bad, …] = useState']);
    expect(found[0].line).toBe(2);
  });

  it('leaves the owner, comments, and a same-named state with no form control alone', () => {
    const found = adHocFieldErrors(
      withFiles({
        [OWNER]: `export const x = { 'aria-invalid': true };`,
        'screens/Three.tsx': `// aria-invalid is set by FieldMessage\n/* aria-invalid={x} */\nexport const A = () => <p />;`,
        'screens/Four.tsx': `export function A() {\n  const [bad, setBad] = useState('');\n  return <p>{bad}</p>;\n}`,
        // A boolean called `bad` beside a checkbox — the bad-weather toggle on
        // the support screen, which the first version of this rule flagged.
        'screens/Five.tsx': `export function A() {\n  const [bad, setBad] = useState(false);\n  return <input type="checkbox" aria-label="Bad weather" checked={bad} />;\n}`,
      }),
    );
    expect(found).toEqual([]);
  });

  it('keeps every form that was migrated on the shared component', () => {
    // Pinned by name as well as by shape: reverting one of these to a
    // `refused` or `oops` state would pass the name list above.
    const migrated = [
      'screens/Meals.tsx',
      'screens/Housing.tsx',
      'screens/Costs.tsx',
      'screens/Bill.tsx',
      'screens/Clocks.tsx',
      'screens/settings/Assistant.tsx',
    ];
    const off = migrated.filter(
      (f) => !/<FieldMessage\b/.test(readFileSync(join(src, f), 'utf8')),
    );
    expect(off).toEqual([]);
  });
});
