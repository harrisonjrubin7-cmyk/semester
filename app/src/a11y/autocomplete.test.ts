import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inputTags, unstatedAutocomplete } from './autocomplete';

/**
 * The input-purpose rule, held to the tree — see `autocomplete.ts` for why.
 *
 * Each shape it exists to catch is fed to it alone and must come back caught,
 * because a scan that finds nothing in the app is also what a scan that reads
 * nothing looks like.
 */

const src = join(process.cwd(), 'src');

function withFiles(files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'autocomplete-')), 'src');
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

describe('the input-purpose rule', () => {
  it('passes on the app as it stands', () => {
    expect(unstatedAutocomplete(src).map((f) => `${f.file}:${f.line} ${f.why}`)).toEqual([]);
  });

  it('catches an email, password and tel input that say nothing', () => {
    const found = unstatedAutocomplete(
      withFiles({
        'screens/A.tsx': [
          'export const A = () => (',
          '  <>',
          '    <input type="email" aria-label="To" />',
          '    <input type="password" aria-label="Key" />',
          '    <input type="tel" aria-label="Number" />',
          '  </>',
          ');',
        ].join('\n'),
      }),
    );
    expect(found.map((f) => [f.line, f.why])).toEqual([
      [3, 'type="email"'],
      [4, 'type="password"'],
      [5, 'type="tel"'],
    ]);
  });

  it('catches an input labelled as about the person typing, whatever its type', () => {
    const found = unstatedAutocomplete(withFiles({ 'screens/B.tsx': `export const B = () => <input aria-label="Your name" />;` }));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ file: 'screens/B.tsx', line: 1, why: 'labelled as about the person typing' });
  });

  it('accepts a token or off, and leaves every other input alone', () => {
    const found = unstatedAutocomplete(
      withFiles({
        'screens/C.tsx': [
          'export const C = () => (',
          '  <>',
          '    <input type="email" autoComplete="email" aria-label="Your email" />',
          '    <input type="email" autoComplete="off" aria-label="Their email" />',
          '    <input aria-label="Your name" autoComplete="nickname" />',
          '    <input aria-label="Amount" />',
          '    <input type="number" aria-label="Your credits" />',
          '  </>',
          ');',
        ].join('\n'),
      }),
    );
    expect(found).toEqual([]);
  });

  it('reads past an arrow function in a handler instead of stopping at its `>`', () => {
    const text = `<input onChange={(e) => set(e.target.value)} type="email" aria-label="Who" />`;
    expect(inputTags(text)).toHaveLength(1);
    expect(inputTags(text)[0]!.tag.endsWith('/>')).toBe(true);
    const found = unstatedAutocomplete(withFiles({ 'screens/D.tsx': `export const D = () => (\n  ${text}\n);` }));
    expect(found).toHaveLength(1);
  });

  it('does not read a test file', () => {
    // A second, clean file: `sources()` refuses an empty list on purpose.
    const dir = withFiles({ 'screens/E.test.tsx': `const x = <input type="email" />;`, 'screens/F.tsx': `export const F = () => <p />;` });
    expect(unstatedAutocomplete(dir)).toEqual([]);
  });
});
