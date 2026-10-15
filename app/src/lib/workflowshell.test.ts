import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A step that pipes a measurement through `tee` must be able to fail.
 *
 * GitHub runs a `run:` step with no `shell:` as `bash -e {0}`, which has no
 * `pipefail`: the pipeline's status is `tee`'s, so a measurement that exits
 * non-zero is reported as a green step. `contrast.yml` was written to fail
 * on a finding ("the script exits non-zero on a finding") and did not: the
 * run of 3 October 2026 printed `FINDINGS: 159` and concluded `success`, as
 * did every nightly run before it. `shell: bash` is the one-line cure, since
 * GitHub then runs `bash --noprofile --norc -eo pipefail {0}`.
 *
 * The check reads the workflow text, so it needs no YAML parser and cannot
 * be satisfied by a comment: a step is only exempt if the words are in its
 * `shell:` line or a `set -o pipefail` of its own.
 */

const root = join(import.meta.dirname, '../../..');
const dir = join(root, '.github/workflows');

/** The text of each step: from one `- name:` / `- uses:` / `- run:` list item to the next at the same indent. */
export function steps(workflow: string): string[] {
  const lines = workflow.split('\n');
  const out: string[] = [];
  let current: string[] = [];
  let indent = -1;
  for (const line of lines) {
    const m = /^(\s*)- (name|uses|run|id|if|with|env):/.exec(line);
    if (m && (indent === -1 || m[1].length === indent)) {
      if (current.length) out.push(current.join('\n'));
      current = [line];
      indent = m[1].length;
    } else if (current.length) {
      current.push(line);
    }
  }
  if (current.length) out.push(current.join('\n'));
  return out;
}

const withoutComments = (s: string) =>
  s
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

/** The steps of `workflow` that pipe into `tee` and could therefore hide a failure. */
export function maskedPipelines(workflow: string): string[] {
  return steps(workflow)
    .map(withoutComments)
    .filter((step) => /\|\s*tee\b/.test(step))
    .filter((step) => !/^\s*shell:\s*bash\s*$/m.test(step) && !/set\s+-[a-z]*o\s+pipefail|set\s+-o\s+pipefail/.test(step));
}

describe('a pipeline through tee can fail the step', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml'));

  it('reads the workflows it is meant to guard', () => {
    expect(files).toContain('contrast.yml');
    expect(files).toContain('ci.yml');
  });

  for (const file of files) {
    it(`${file}: no step hides its status behind tee`, () => {
      const masked = maskedPipelines(readFileSync(join(dir, file), 'utf8'));
      expect(masked.map((s) => s.split('\n').find((l) => /\|\s*tee\b/.test(l))?.trim())).toEqual([]);
    });
  }

  // The controls: the checker is shown the failure and the cure, so a green
  // run above means the workflows are right and not that the checker is blind.
  it('flags the shape contrast.yml had', () => {
    const bad = [
      'jobs:',
      '  sweep:',
      '    steps:',
      '      - name: Sweep',
      '        working-directory: app',
      '        run: npm run sweep:contrast 2>&1 | tee /tmp/contrast.txt',
      '      - name: Keep',
      '        run: echo done',
    ].join('\n');
    expect(maskedPipelines(bad)).toHaveLength(1);
  });

  it('accepts shell: bash and an explicit pipefail, and is not satisfied by a comment', () => {
    const shell = ['    steps:', '      - name: Sweep', '        shell: bash', '        run: a | tee /tmp/x'].join('\n');
    const set = ['    steps:', '      - name: Sweep', '        run: |', '          set -o pipefail', '          a | tee /tmp/x'].join('\n');
    const comment = ['    steps:', '      - name: Sweep', '        # shell: bash', '        run: a | tee /tmp/x'].join('\n');
    expect(maskedPipelines(shell)).toHaveLength(0);
    expect(maskedPipelines(set)).toHaveLength(0);
    expect(maskedPipelines(comment)).toHaveLength(1);
  });

  it('does not take another step\'s shell for its own', () => {
    const two = [
      '    steps:',
      '      - name: Fine',
      '        shell: bash',
      '        run: a | tee /tmp/x',
      '      - name: Bad',
      '        run: b | tee /tmp/y',
    ].join('\n');
    expect(maskedPipelines(two)).toHaveLength(1);
  });
});
