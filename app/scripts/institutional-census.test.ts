// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { census, writeCensus } from './institutional-census.mjs';

const made: string[] = [];

afterEach(() => {
  for (const path of made.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('institutional census', () => {
  it('finds every registered destination and every accounted screen', async () => {
    const result = await census(new URL('../src/', import.meta.url));

    expect(result.destinations.count).toBe(59);
    expect(result.screens.unaccounted).toEqual([]);
    expect(result.migrations.duplicateVersions).toEqual([]);
    expect(result.evidence.every((row) => row.path && row.sha256)).toBe(true);
  });

  it('writes matching deterministic JSON and Markdown evidence', async () => {
    const output = mkdtempSync(join(tmpdir(), 'semester-census-'));
    made.push(output);

    const result = await writeCensus(new URL('../../', import.meta.url), output);
    const json = JSON.parse(readFileSync(join(output, 'current-state.json'), 'utf8'));
    const markdown = readFileSync(join(output, 'current-state.md'), 'utf8');

    expect(json.commit).toBe(result.commit);
    expect(markdown).toContain(`Commit: \`${result.commit}\``);
    expect(markdown).toContain('[app/src/lib/nav.ts]');
    expect(markdown).not.toMatch(/node_modules|\.env/);
  });
});
