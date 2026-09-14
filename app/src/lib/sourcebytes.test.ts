import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * No source file carries a raw control byte.
 *
 * `workspace-backup.ts` held the check that stops a crafted backup writing
 * outside its own scope, and it was written `/[\x00-\x1f:]/` with the two
 * ends as *actual bytes* rather than as those eight characters. The regex
 * was right — it rejected what it was meant to reject — so nothing failed
 * and nothing looked wrong.
 *
 * What it cost was the review. A file containing a NUL is a binary file to
 * git and to grep, so:
 *
 *   * `git diff` said `Binary files differ`, and the stat line said
 *     `0 insertions, 0 deletions`, for any edit at all;
 *   * `grep -rn` reported `binary file matches` instead of the line, so the
 *     file was absent from every search anybody ran over the tree.
 *
 * A security check nobody can see the diff of is a security check on the
 * honour system. `docx.test.ts` had the same thing with a BEL.
 *
 * The bytes below are the ones no editor shows: NUL through backspace, the
 * vertical tab and form feed, and shift-out through unit separator. Tab,
 * newline and carriage return are left out because they are how text is
 * written. Nothing here objects to the *characters* — write them `\x00` and
 * the file stays text and stays reviewable, which is the whole ask.
 */
// eslint-disable-next-line no-control-regex -- the control characters are the subject
const FORBIDDEN = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;

/** Extensions that are text, so a control byte in one is a mistake. */
const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|html|md|sql|sh|py|yml|yaml|toml)$/;

const root = join(__dirname, '..', '..', '..');

const tracked = (): string[] =>
  execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })
    .split('\0')
    .filter((p) => p && TEXT.test(p));

describe('source files are text', () => {
  it('finds files to check, so a broken listing cannot pass as a clean one', () => {
    expect(tracked().length).toBeGreaterThan(500);
  });

  it('has no raw control bytes in any tracked text file', () => {
    const guilty = tracked().filter((p) => FORBIDDEN.test(readFileSync(join(root, p), 'latin1')));
    // Named rather than counted: the failure should say which file to open.
    expect(guilty).toEqual([]);
  });
});
