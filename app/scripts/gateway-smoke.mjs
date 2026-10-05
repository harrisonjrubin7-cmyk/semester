import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Boot the university gateway with the sandbox on, and check what comes up.
 *
 * `sandbox.test.ts` proves the adapters, and drives the whole vertical through
 * `createGateway` in memory. What neither of them touches is `start.ts`: the
 * configuration it refuses to start without, the directories it makes, the
 * umask, and the line it prints. That file had never been run with the sandbox
 * switched on, and the first time it was, it said
 *
 *   SANDBOX INSTITUTION IS ON: 4 demonstration adapters are installed
 *
 * with five installed — the "4" was a literal, in an expression reading the
 * *arity* of `sandboxAdapters` rather than the length of what it returned. A
 * unit test could not have caught it because no unit imports that line.
 *
 * So this is the boot, written down so it can be taken again:
 *
 *   npm run smoke:gateway
 *
 * It is deliberately not part of `npm test`. It binds a port and spawns a
 * process, and a suite that does either is a suite that fails on somebody
 * else's machine for reasons that are not about the code.
 *
 * ## What it can and cannot check
 *
 * With no Auth project configured the gateway answers 401 to everything that
 * needs an identity, which is the correct unconfigured behaviour and is
 * checked here as such. It therefore cannot drive the loop over real HTTP —
 * that is what the gateway tests do in process, with a stub identity. What is
 * left for this to prove is the part those cannot reach: that the thing starts
 * at all, says something true about itself, and leaves its files where only
 * this user can read them.
 */
const PORT = Number(process.env.SMOKE_PORT || 8793);
const dir = mkdtempSync(join(tmpdir(), 'gateway-smoke-'));
const problems = [];
const check = (ok, said) => {
  console.log(`${ok ? '  ok  ' : '  NO  '} ${said}`);
  if (!ok) problems.push(said);
};

const server = spawn(
  process.execPath,
  ['server/institution/start.ts'],
  {
    env: {
      ...process.env,
      SEMESTER_APP_ORIGIN: 'http://localhost:5173',
      SEMESTER_JOURNAL_KEY: 'ab'.repeat(32),
      SEMESTER_JOURNAL_PATH: join(dir, 'actions.sqlite'),
      SEMESTER_SANDBOX_PATH: join(dir, 'deeper', 'sandbox.sqlite'),
      SEMESTER_SANDBOX_INSTITUTION: '1',
      SEMESTER_GATEWAY_PORT: String(PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let said = '';
server.stdout.on('data', (b) => { said += String(b); });
server.stderr.on('data', (b) => { said += String(b); });

/** Wait for the port, rather than sleeping and hoping. */
async function up(within = 15_000) {
  const until = Date.now() + within;
  while (Date.now() < until) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (r.ok) return true;
    } catch {
      /* not yet */
    }
    if (server.exitCode !== null) return false;
    await new Promise((go) => setTimeout(go, 200));
  }
  return false;
}

try {
  check(await up(), 'it starts and answers /health');

  const health = await fetch(`http://127.0.0.1:${PORT}/health`).then((r) => r.json()).catch(() => null);
  check(health?.version === 1, `/health names the contract version (got ${health?.version})`);
  check(
    health?.intelligence === 'policy-disabled',
    `intelligence reports its unconfigured policy truthfully (got ${health?.intelligence})`,
  );

  /*
   * The count in the startup line, which is the thing that was wrong.
   *
   * Sixteen with Phase 4 complete as a demonstration: career, advising, the
   * alumni network, athletics, clubs, housing and dining on top of Phase 3's
   * four. The number is
   * asserted rather than merely printed because the line is what somebody
   * reads to know what a booted gateway is carrying, and a line that said five
   * while six were installed is exactly the fault this check was written for.
   */
  const count = /SANDBOX INSTITUTION IS ON: (\d+) demonstration adapters/.exec(said);
  check(count?.[1] === '16', `the startup line counts the adapters it installed (said ${count?.[1] ?? 'nothing'})`);
  check(/0 approved adapters registered/.test(said), 'and still reports no approved adapters');
  check(/nothing they report is real/.test(said), 'and says the sandbox is not real');

  // No Auth project configured: refusing is the correct answer, not trusting.
  const status = await fetch(`http://127.0.0.1:${PORT}/status`, {
    headers: { origin: 'http://localhost:5173' },
  });
  check(status.status === 401, `/status without a token is refused (got ${status.status})`);

  const elsewhere = await fetch(`http://127.0.0.1:${PORT}/status`, {
    headers: { origin: 'https://elsewhere.test', authorization: 'Bearer x' },
  });
  check(elsewhere.status === 403, `another origin is refused (got ${elsewhere.status})`);

  // The store, in a directory of its own that nothing else had made.
  const mode = (p) => (statSync(p).mode & 0o777).toString(8);
  check(mode(join(dir, 'deeper', 'sandbox.sqlite')) === '600', 'the sandbox store is readable by this user only');
  check(mode(join(dir, 'deeper')) === '700', 'and sits in a directory this user only can open');
} finally {
  server.kill('SIGTERM');
  await new Promise((go) => setTimeout(go, 400));
  server.kill('SIGKILL');
  rmSync(dir, { recursive: true, force: true });
}

if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? '' : 's'} with the gateway as it boots.`);
  process.exit(1);
}
console.log('\nThe gateway boots, says something true about itself, and refuses what it should.');
