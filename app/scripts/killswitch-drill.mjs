/*
 * The kill-switch drill AI-012 owes: engage `kill.ai_generation` against the
 * live project once, watch the deployed runtime refuse, release it, and file
 * what happened with the times.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_PUBLISHABLE_KEY=sb_publishable_… \
 *   SEMESTER_SESSION=<the access token of a drill account, never a student's> \
 *   DRILL=write node scripts/killswitch-drill.mjs
 *
 * The switch is a row in `feature_kill_switch`, and only the database changes
 * it: this script never writes to production. It makes three calls to the
 * `claude` function — before, during and after — and between them prints the
 * SQL to run from the dashboard's SQL editor and waits for Enter. That keeps
 * the person engaging the switch the person watching it, which is what a
 * drill is for.
 *
 *   1. Before: one small request is answered (200). If it is not, stop: the
 *      drill has nothing to show and the function needs looking at first.
 *   2. Engage: the SQL below, then Enter. The call must be refused with 503
 *      and the exact sentence `KILLED_MESSAGE` in
 *      `supabase/functions/_shared/killswitch.ts` — read from that file here,
 *      so the script cannot drift from the runtime it is testing.
 *   3. Release: the SQL below, then Enter. The call is answered again (200).
 *
 * Each step is timed from the Enter to the answer, and with `DRILL=write` the
 * record goes to `docs/evidence/ai/killswitch-drill-<moment>.json`, never over
 * an earlier one — a failed drill is filed too, as FAILED. Once the switch is
 * engaged, every way out of the script asks for it to be released first. What it does not observe: the institution gateway, which is
 * not deployed; `app/src/lib/aikillswitch.test.ts` holds that runtime to the
 * same switch. The record says so.
 *
 * Each call costs the drill account one of its sixty for the month, except
 * the refused one, which the function does not count.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const URL_BASE = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const APIKEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
const SESSION = process.env.SEMESTER_SESSION ?? '';
if (!URL_BASE || !APIKEY || !SESSION) {
  console.error('Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SEMESTER_SESSION (a drill account\'s access token).');
  process.exit(2);
}

export const FUNCTION_PATH = '/functions/v1/claude';
export const SWITCH = 'kill.ai_generation';

/** The sentence the runtime says when engaged, read from the module it says it in. */
export function killedMessage(source) {
  const m = /export const KILLED_MESSAGE =\s*\n?\s*'([^']+)';/.exec(source);
  if (!m) throw new Error('KILLED_MESSAGE not found in killswitch.ts');
  return m[1];
}

const KILLED = killedMessage(readFileSync(new URL('../../supabase/functions/_shared/killswitch.ts', import.meta.url), 'utf8'));

const ENGAGE = `insert into public.feature_kill_switch (switch_key, tenant_id, engaged, reason, engaged_at)
values ('${SWITCH}', null, true, 'Kill-switch drill (docs/LAUNCH-DECISIONS.md item 15)', now())
on conflict ((coalesce(tenant_id, '')), switch_key) do update
  set engaged = true, reason = excluded.reason, engaged_at = now(), updated_at = now();
select public.kill_switch_engaged('${SWITCH}', null);  -- must answer true`;

const RELEASE = `update public.feature_kill_switch set engaged = false, updated_at = now()
where switch_key = '${SWITCH}' and tenant_id is null;
select public.kill_switch_engaged('${SWITCH}', null);  -- must answer false`;

async function call() {
  const started = Date.now();
  try {
    const res = await fetch(`${URL_BASE}${FUNCTION_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: APIKEY, authorization: `Bearer ${SESSION}` },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 16, messages: [{ role: 'user', content: 'Reply with the word ok.' }] }),
    });
    const text = await res.text();
    let message = null;
    try { message = JSON.parse(text)?.error?.message ?? null; } catch { /* not JSON: an answer, not a refusal */ }
    return { status: res.status, message, ms: Date.now() - started, at: new Date().toISOString() };
  } catch (e) {
    // A dropped connection is a step that did not go as expected, not a
    // crash: the drill records it and still reaches the release prompt below.
    return { status: 0, message: `fetch failed: ${e instanceof Error ? e.message : String(e)}`, ms: Date.now() - started, at: new Date().toISOString() };
  }
}

const rl = createInterface({ input: stdin, output: stdout });
const record = { at: new Date().toISOString(), switch: SWITCH, runtime: 'supabase/functions/claude (the deployed runtime)', notObserved: 'app/server/institution (the institution gateway) is not deployed; app/src/lib/aikillswitch.test.ts holds it to the same switch', steps: [] };
const step = (name, r, expected) => {
  const ok = r.status === expected.status && (expected.message === undefined || r.message === expected.message);
  record.steps.push({ name, ...r, expected, ok });
  console.log(`${ok ? 'ok ' : 'NOT'} ${name}: ${r.status}${r.message ? ` — ${r.message}` : ''} (${r.ms} ms)`);
  return ok;
};

/*
 * Once the operator has engaged the switch, the one thing this script must
 * not do is exit without asking for it to be released — a thrown probe, a
 * refused step or a Ctrl-C in the wrong place would otherwise leave AI
 * generation off for everyone. So `engaged` and `released` are tracked and
 * the release prompt sits in the `finally`, on every path out.
 */
let engaged = false;
let released = false;
const release = async (why) => {
  await rl.question(`\n${why}Release the switch. Run:\n\n${RELEASE}\n\nThen press Enter here. `);
  released = true;
  record.releasedAt = new Date().toISOString();
};

try {
  if (!step('before: answered', await call(), { status: 200 })) throw new Error('the function did not answer before the drill; nothing to show');
  await rl.question(`\nEngage the switch. In the dashboard's SQL editor run:\n\n${ENGAGE}\n\nThen press Enter here. `);
  engaged = true;
  record.engagedAt = new Date().toISOString();
  step("during: refused with the runtime's own sentence", await call(), { status: 503, message: KILLED });
  await release('');
  step('after: answered again', await call(), { status: 200 });
} catch (e) {
  record.error = e instanceof Error ? e.message : String(e);
  console.error(`\nstopped: ${record.error}`);
} finally {
  if (engaged && !released) {
    try {
      await release('The drill stopped with the switch ENGAGED. ');
    } catch (e) {
      // Even the prompt failing must not swallow the instruction.
      console.error(`\nTHE SWITCH IS STILL ENGAGED. Run this now:\n\n${RELEASE}\n`);
      record.error = `${record.error ? `${record.error}; ` : ''}release prompt failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  rl.close();
}

record.verdict = !record.error && record.steps.length === 3 && record.steps.every((s) => s.ok) ? 'held' : 'FAILED';
console.log(`\n${record.verdict}: ${record.steps.filter((s) => s.ok).length} of ${record.steps.length} steps as expected.`);
if (process.env.DRILL === 'write') {
  const dir = new URL('../../docs/evidence/ai/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  const file = new URL(`killswitch-drill-${record.at.replace(/[:.]/g, '-')}.json`, dir);
  if (existsSync(file)) throw new Error(`${file.pathname} already exists; a drill record is never overwritten`);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`filed ${file.pathname}`);
}
process.exit(record.verdict === 'held' ? 0 : 1);
