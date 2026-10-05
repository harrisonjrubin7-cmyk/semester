import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { arrayOf, assertProperty, int, record, runProperty } from '../src/lib/verify/property';

/**
 * The soak's drift check, run as the shell script it is.
 *
 * `supabase/load/drift.sh` is arithmetic on latency numbers, and it is bash and
 * awk on purpose so the database job needs nothing installed to run it. So it
 * is tested as that file, by feeding it numbers, and not through a copy. Each
 * rule is checked on hand-made series and then over generated ones, and each
 * was also broken in the script itself to see the test go red.
 */

const script = join(import.meta.dirname, '../../supabase/load/drift.sh');

type Series = Record<string, number[]>;

function drift(series: Series, env: Record<string, string> = {}, budget?: number, background: Record<string, number[]> = {}): { code: number; out: string } {
  const lines = Object.entries(series).flatMap(([name, xs]) => xs.map((x, i) => {
    const bg = background[name]?.[i];
    return `${name} ${i + 1} ${x}${budget === undefined ? '' : ` ${budget}`}${bg === undefined ? '' : ` ${bg}`}`;
  })).join('\n');
  const r = spawnSync('bash', [script], { input: lines + '\n', encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status ?? -1, out: r.stdout };
}

describe('drift.sh', () => {
  it('passes a scenario whose latency is flat', () => {
    const r = drift({ flags: [10, 10, 10, 10, 10, 10] });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/✓ flags: .* no drift/);
  });

  it('fails a scenario that gets slower, and says from what to what', () => {
    const r = drift({ plans: [10, 12, 20, 30, 45, 60, 80, 90] });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/✗ plans: p95 drifted from 10\.0 ms to 80\.0 ms over 8 windows/);
  });

  it('judges each scenario on its own, and fails the run if any one drifts', () => {
    const r = drift({ steady: [5, 5, 5, 5, 5, 5], leaking: [10, 10, 20, 30, 40, 50] });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/✓ steady/);
    expect(r.out).toMatch(/✗ leaking/);
  });

  it('is not moved by one noisy window in the middle, or at either end: a leak lifts the floor, a spike only a ceiling', () => {
    expect(drift({ a: [10, 10, 10, 90, 10, 10, 10, 10] }).code).toBe(0);
    expect(drift({ a: [90, 10, 10, 10, 10, 10, 10, 10] }).code).toBe(0);
    expect(drift({ a: [10, 10, 10, 10, 10, 10, 10, 90] }).code).toBe(0);
  });

  it('is not moved by a slow first window while caches warm', () => {
    expect(drift({ a: [60, 10, 10, 10, 10, 10, 10, 10] }).code).toBe(0);
  });

  it('sees a leak that raises every window, even with noise on top', () => {
    expect(drift({ a: [10, 12, 9, 30, 35, 20, 28, 40] }).code).toBe(1);
  });

  it('ignores a rise that is large in proportion and small in milliseconds', () => {
    expect(drift({ fast: [0.3, 0.3, 0.3, 0.4, 0.9, 0.9, 0.9, 0.9] }).code).toBe(0);
    expect(drift({ slow: [20, 20, 20, 20, 60, 60, 60, 60] }).code).toBe(1);
  });

  it('ignores a rise that is large in milliseconds and under the ratio', () => {
    expect(drift({ big: [100, 100, 100, 100, 150, 150, 150, 150] }).code).toBe(0);
    expect(drift({ big: [100, 100, 100, 100, 210, 210, 210, 210] }).code).toBe(1);
  });

  it('will not call a trend from fewer than four windows, and says so', () => {
    const r = drift({ a: [10, 100, 1000] });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/3 windows, too few to see a trend/);
    expect(drift({ a: [10] }).out).toMatch(/1 window, too few/);
  });

  it('fails when there is nothing to compare, rather than passing an empty run', () => {
    const r = spawnSync('bash', [script], { input: '', encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/no samples were recorded/);
  });

  it('reads windows by their number, not the order the lines arrive in, and skips junk lines', () => {
    const lines = ['a 4 40', 'junk', 'a 1 10', 'a 3 30', '', 'a 2 20', 'a x 9', 'a 5 50', 'a 6 60'].join('\n');
    const r = spawnSync('bash', [script], { input: lines, encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/drifted from 10\.0 ms to 50\.0 ms over 6 windows/);
    expect(r.stdout.trim().split('\n')).toHaveLength(1);
    expect(r.stdout).not.toMatch(/junk/);
  });

  it('takes its limits from the environment', () => {
    const s = { a: [10, 10, 10, 10, 15, 15, 15, 15] };
    expect(drift(s).code).toBe(0);
    expect(drift(s, { SOAK_RATIO: '1.2', SOAK_MIN_DELTA_MS: '1' }).code).toBe(1);
  });
});

describe('drift.sh, the budget', () => {
  // The numbers of the CI run that failed on one window: 19.8, 30.3, 99.4 and 50.4 ms against 60.
  it('passes a scenario whose typical window is within budget, though one window was not, and says so', () => {
    const r = drift({ plans: [19.8, 99.4, 30.3, 50.4] }, {}, 60);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/· plans: 1 of 4 windows over the 60 ms budget \(worst 99\.4 ms\); the typical window, 40\.4 ms, is within it/);
  });

  it('fails a scenario whose typical window is over budget', () => {
    const r = drift({ plans: [70, 80, 90, 20] }, {}, 60);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/✗ plans: the typical p95 is 75\.0 ms, over its budget of 60 ms \(3 of 4 windows over it\)/);
  });

  it('fails when every window is over, and when the middle pair of an even run averages above it', () => {
    expect(drift({ a: [70, 71, 72, 73] }, {}, 60).code).toBe(1);
    expect(drift({ a: [55, 64, 66, 58] }, {}, 60).code).toBe(1);
    expect(drift({ a: [55, 62, 64, 58] }, {}, 60).code).toBe(0); // a median of exactly the budget is within it
  });

  it('is the old rule for one pass: one window, judged on itself', () => {
    expect(drift({ a: [70] }, {}, 60).code).toBe(1);
    expect(drift({ a: [50] }, {}, 60).code).toBe(0);
  });

  it('says nothing about a budget when it is not given one, and the other verdicts are unchanged', () => {
    const r = drift({ a: [200, 200, 200, 200] });
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/budget/);
  });

  it('judges each scenario on its own budget', () => {
    const lines = ['a 1 50 60', 'a 2 50 60', 'a 3 50 60', 'a 4 50 60', 'b 1 50 40', 'b 2 50 40', 'b 3 50 40', 'b 4 50 40'].join('\n');
    const r = spawnSync('bash', [script], { input: lines + '\n', encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/✗ b: the typical p95/);
    expect(r.stdout).not.toMatch(/✗ a:/);
  });
});

describe('drift.sh, attributing a window over budget', () => {
  const series = { plans: [19.8, 99.4, 30.3, 50.4] };

  it('says when the window over budget had a checkpoint, an autovacuum pass or CPU steal', () => {
    const r = drift(series, {}, 60, { plans: [0, 1, 0, 0] });
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/\(worst 99\.4 ms, 1 of them with a checkpoint, an autovacuum pass or CPU steal\)/);
  });

  it('says when it had none, so a stall nobody can name stays unnamed', () => {
    const r = drift(series, {}, 60, { plans: [1, 0, 1, 0] });
    expect(r.out).toMatch(/\(worst 99\.4 ms, none with a checkpoint, an autovacuum pass or CPU steal\)/);
  });

  it('counts only the windows that were over budget', () => {
    const r = drift({ plans: [70, 99, 30, 20, 25] }, {}, 60, { plans: [1, 0, 1, 1, 1] });
    expect(r.out).toMatch(/2 of 5 windows over the 60 ms budget \(worst 99\.0 ms, 1 of them with/);
  });

  it('keeps its claim to windows it was told about, and to a run that has a budget', () => {
    expect(drift(series, {}, 60).out).not.toMatch(/checkpoint/);
    expect(drift({ plans: [19.8, 30.3, 35, 40] }, {}, 60, { plans: [1, 1, 1, 1] }).out).not.toMatch(/checkpoint/);
  });

  it('reads windows by their number, not their position, when one went missing', () => {
    // Window 3 has no line (it was lost), so the third sample is window 4, and it is the one that had a checkpoint.
    const lines = 'plans 4 99 60 1\nplans 1 20 60 0\nplans 2 25 60 0\n';
    const r = spawnSync('bash', [script], { input: lines, encoding: 'utf8' });
    expect(r.stdout).toMatch(/1 of 3 windows over the 60 ms budget \(worst 99\.0 ms, 1 of them with/);
  });
});

describe('drift.sh, for every series', () => {
  const series = arrayOf(int(1, 500), 14);
  const DEEP = { runs: 120 };

  it('never flags a flat scenario, however long', () => {
    assertProperty('flat is flat', record({ level: int(1, 500), n: int(1, 16) }), ({ level, n }) => drift({ s: Array(n).fill(level) as number[] }).code === 0, DEEP);
  });

  it('flags a scenario whose whole second half is many times and many milliseconds slower', () => {
    assertProperty('a shift is seen', record({ base: int(10, 50), n: int(8, 14) }), ({ base, n }) => {
      const xs = Array.from({ length: n }, (_, i) => (i < n / 2 ? base : base * 4 + 20));
      return drift({ s: xs }).code === 1;
    }, DEEP);
  });

  it('does not depend on the windows between the two ends', () => {
    assertProperty('the middle does not matter', record({ xs: series }), ({ xs }) => {
      if (xs.length < 8) return true;
      const edge = Math.max(2, Math.floor(xs.length / 4));
      const middle = xs.slice(edge, xs.length - edge);
      const shuffled = [...middle].reverse().map((_, i, a) => a[(i * 3) % a.length]!);
      const again = [...xs.slice(0, edge), ...shuffled, ...xs.slice(xs.length - edge)];
      return drift({ s: xs }).code === drift({ s: again }).code;
    }, DEEP);
  });

  it('gives the same verdict when every figure is scaled, when only proportion is asked', () => {
    assertProperty('scale', record({ xs: series, k: int(2, 9) }), ({ xs, k }) => {
      const env = { SOAK_MIN_DELTA_MS: '0' };
      return drift({ s: xs }, env).code === drift({ s: xs.map((x) => x * k) }, env).code;
    }, DEEP);
  });

  it('reaches both verdicts, so the properties above are not vacuous', () => {
    let drifted = 0; let flat = 0;
    runProperty(series, (xs) => { if (drift({ s: xs }).code === 1) drifted++; else flat++; }, { runs: 150 });
    expect(drifted).toBeGreaterThan(0);
    expect(flat).toBeGreaterThan(0);
  });
});

describe('the runner', () => {
  const run = readFileSync(join(import.meta.dirname, '../../supabase/load/run.sh'), 'utf8');

  it('is bash that parses, and is off unless asked', () => {
    expect(spawnSync('bash', ['-n', join(import.meta.dirname, '../../supabase/load/run.sh')]).status).toBe(0);
    expect(run).toContain('soak=${LOAD_SOAK_WINDOWS:-0}');
  });

  it('records one sample per scenario per window, checks the invariants and the connections after each, and hands the samples to drift.sh', () => {
    expect(run).toContain(`printf '%s %s %s %s %s\\n' "$name" "$window" "$p95" "$budget" "$bg" >> "$windows"`);
    expect(run).toMatch(/run_pass\n\s+run_invariants\n\s+now=\$\(clients\)/);
    expect(run).toContain('"$here_load/drift.sh" < "$windows"');
  });

  it('judges a budget on the typical window in a soak, and on the one window in a single pass', () => {
    const over = run.slice(run.indexOf("elif awk -v a=\"$p95\""), run.indexOf('else\n    echo "  ✓ $line"'));
    expect(over).toMatch(/if \[ "\$soak" -gt 0 \]; then[\s\S]*⚠[\s\S]*else\n\s+echo "  ✗ \$line — over budget"; failed=1/);
    // Errors still fail in every window.
    expect(run).toMatch(/if \[ "\$\{errs:-0\}" != 0 \]; then\n\s+echo "  ✗ \$line, \$errs failed:"[\s\S]*failed=1/);
  });

  it('reads what else was happening around every scenario, and says it after the verdict', () => {
    // Checkpoints from whichever view this Postgres has (16 and before, 17 and after), autovacuum passes, CPU steal.
    expect(run).toContain('pg_stat_checkpointer');
    expect(run).toContain('pg_stat_bgwriter');
    expect(run).toContain('autovacuum_count + autoanalyze_count');
    expect(run).toContain('/proc/stat');
    expect(run).toMatch(/read -r ck0 av0 st0 tot0 <<<"\$\(activity\)"\n\s+out=\$\( \(cd "\$logs" && bench/);
    expect(run).toMatch(/--verbose-errors\) 2>&1 \)\n\s+read -r ck1 av1 st1 tot1 <<<"\$\(activity\)"/);
    expect(run).toContain('echo "      ↳ while it ran: $bgnote"');
  });

  it('has a drift script that is executable', () => {
    expect(() => execFileSync('test', ['-x', script])).not.toThrow();
  });
});

describe('the document', () => {
  const doc = readFileSync(join(import.meta.dirname, '../../docs/LOAD-AND-SOAK.md'), 'utf8');
  const drift = readFileSync(script, 'utf8');

  it('states the thresholds the script uses', () => {
    expect(drift).toContain('ratio=${SOAK_RATIO:-2}');
    expect(drift).toContain('delta=${SOAK_MIN_DELTA_MS:-5}');
    expect(doc).toContain('**2 times**');
    expect(doc).toContain('**5 ms**');
  });

  it('names the switch, the comparison and what it does not show', () => {
    for (const phrase of ['LOAD_SOAK_WINDOWS', 'best** p95', 'No disk, bloat or memory reading', 'No browser soak', 'Not built']) expect(doc, phrase).toContain(phrase);
  });

  it('says how a budget is judged in a soak', () => {
    for (const phrase of ['Budgets in a soak', 'typical (median) window', 'LOAD-HARNESS-OPEN-ISSUE-PLANS-P95', 'What else was happening', 'CPU steal']) expect(doc, phrase).toContain(phrase);
  });

  it('is what CI runs', () => {
    const ci = readFileSync(join(import.meta.dirname, '../../.github/workflows/ci.yml'), 'utf8');
    expect(ci).toContain("LOAD_SOAK_WINDOWS: '4'");
    expect(doc).toMatch(/CI runs four windows of six seconds/);
    expect(ci).toContain("LOAD_SECONDS: '6'");
  });
});

describe('run.sh, confirming a drift before failing on it (D-1280)', () => {
  // The soak block of run.sh, lifted as it is and run with the database taken
  // out: `run_pass` writes one number per window from a series, and the rest of
  // the block (the window function, the confirmation loop, drift.sh) is the real
  // one. `plans` is the scenario; its budget is 60 ms.
  const runSh = readFileSync(join(import.meta.dirname, '../../supabase/load/run.sh'), 'utf8');
  const block = runSh.slice(runSh.indexOf('soak_window() {'), runSh.indexOf('\nelse\n  run_pass'));

  function soak(series: number[]): { failed: number; windows: number; out: string } {
    const harness = [
      'set -uo pipefail',
      `here_load=${JSON.stringify(join(import.meta.dirname, '../../supabase/load'))}`,
      `vals=(${series.join(' ')}); soak=4; seconds=1; failed=0; windows=$(mktemp); window=1`,
      'run_pass() { printf "plans %s %s 60 0\\n" "$window" "${vals[$((window-1))]}" >> "$windows"; }',
      'run_invariants() { :; }',
      'clients() { echo 0; }',
      block + '\nfi',
      'echo "failed=$failed"',
      'echo "windows=$(wc -l < "$windows" | tr -d " ")"',
    ].join('\n');
    const r = spawnSync('bash', ['-c', harness], { encoding: 'utf8' });
    return { failed: Number(/failed=(\d)/.exec(r.stdout)?.[1]), windows: Number(/windows=(\d+)/.exec(r.stdout)?.[1]), out: r.stdout };
  }

  it('does not run on when the first four windows show no drift', () => {
    const r = soak([30, 31, 29, 32, 99, 99, 99, 99]);
    expect(r.failed).toBe(0);
    expect(r.windows).toBe(4);
    expect(r.out).not.toMatch(/to see whether it persists/);
  });

  it('runs four more windows when drift is seen, and passes when it does not persist: a lucky early pair against a stall', () => {
    // The shape of the CI run that failed (17.4 ms early, then 131.2 and 52.8), with ordinary windows after.
    const r = soak([33, 17.4, 131.2, 52.8, 30, 28, 41, 30]);
    expect(r.out).toMatch(/drifted from 17\.4 ms to 52\.8 ms over 4 windows/);
    expect(r.out).toMatch(/running 4 more to see whether it persists/);
    expect(r.out).toMatch(/✓ plans: .* over 8 windows, no drift/);
    expect(r.windows).toBe(8);
    expect(r.failed).toBe(0);
  });

  it('still fails a scenario that keeps getting slower: a leak is there when the soak runs on', () => {
    const r = soak([10, 12, 25, 40, 55, 70, 90, 110]);
    expect(r.out).toMatch(/running 4 more to see whether it persists/);
    expect(r.out).toMatch(/✗ plans: p95 drifted from 10\.0 ms to 90\.0 ms over 8 windows/);
    expect(r.failed).toBe(1);
  });
});
