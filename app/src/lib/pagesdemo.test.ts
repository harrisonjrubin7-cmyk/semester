import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The Pages site is the product, never the demo.
 *
 * It is where the company site's Log in button goes. With
 * `VITE_INSTITUTIONAL_PREVIEW=true` left set as a repository variable, every
 * deploy wore "Demo environment · No real student data", swapped in the
 * Northstar University fixtures and a persona switcher, and put somebody
 * arriving to sign in inside a fictional account. The run printed a warning;
 * the run succeeded, so nobody read it.
 *
 * This runs the workflow's own "Check the build inputs" script, as written,
 * with the switch set, and reads what it hands the build through
 * `$GITHUB_ENV`. A test of the text ("does the file mention the name?") would
 * pass against a script that carries it anyway. The control is a setting the
 * same loop must still carry, so a script that crashed or carried nothing
 * cannot pass as one that refused the switch.
 */

const PAGES = join(process.cwd(), '..', '.github', 'workflows', 'pages.yml');

function checkInputsScript(): string {
  const lines = readFileSync(PAGES, 'utf8').split('\n');
  const step = lines.findIndex((l) => /-\s+name:\s+Check the build inputs\s*$/.test(l));
  expect(step, 'pages.yml has a "Check the build inputs" step').toBeGreaterThan(-1);
  const run = lines.findIndex((l, i) => i > step && /^\s+run:\s*\|\s*$/.test(l));
  const runIndent = lines[run].search(/\S/);
  const body: string[] = [];
  for (const line of lines.slice(run + 1)) {
    if (line.trim() && line.search(/\S/) <= runIndent) break;
    body.push(line);
  }
  return body.join('\n');
}

function carried(env: Record<string, string>): { status: number | null; exported: string; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'pages-inputs-'));
  const file = join(dir, 'github_env');
  writeFileSync(file, '');
  try {
    const run = spawnSync('bash', ['-e', '-c', checkInputsScript()], {
      env: { PATH: process.env.PATH ?? '', GITHUB_ENV: file, ...env },
      encoding: 'utf8',
    });
    return { status: run.status, exported: readFileSync(file, 'utf8'), out: run.stdout + run.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('the Pages deploy and the demo switch', () => {
  it('never hands VITE_INSTITUTIONAL_PREVIEW to the build, and says it ignored it', () => {
    const run = carried({ VITE_INSTITUTIONAL_PREVIEW: 'true', VITE_VAPID_PUBLIC_KEY: 'control-key' });
    expect(run.status, run.out).toBe(0);
    expect(run.exported).not.toMatch(/VITE_INSTITUTIONAL_PREVIEW/);
    expect(run.out).toMatch(/Demo switch ignored/);
  });

  it('still carries every other setting it is given (control)', () => {
    const run = carried({ VITE_INSTITUTIONAL_PREVIEW: 'true', VITE_VAPID_PUBLIC_KEY: 'control-key' });
    expect(run.exported).toContain('VITE_VAPID_PUBLIC_KEY=control-key');
  });
});
