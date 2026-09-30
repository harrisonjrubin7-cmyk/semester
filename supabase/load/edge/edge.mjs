#!/usr/bin/env node
/**
 * Load on what sits in front of the database: GoTrue (sign-in), PostgREST
 * (the pull and the push, exactly as lib/cloud.ts makes them) and an edge
 * function (the calendar feed). `../run.sh` measures the database alone, as
 * the student it belongs to; this measures the same paths through the real
 * stack, over the network, with the real pooler in between.
 *
 * Against a Supabase preview branch, never production. It writes to the
 * rows it signs in as and nothing else, and those are seed.sql's.
 *
 *     psql "$BRANCH_DB" -v students=200 -f supabase/load/edge/seed.sql
 *     SUPABASE_URL=https://<branch-ref>.supabase.co SUPABASE_KEY=<publishable> \
 *       LOAD_STUDENTS=200 LOAD_CLIENTS=8 LOAD_SECONDS=30 node supabase/load/edge/edge.mjs
 *     psql "$BRANCH_DB" -f supabase/load/edge/teardown.sql
 *
 * Sign-in is measured first and on its own, because GoTrue limits sign-ins
 * per client IP: from one machine it reports where that limit sits, not how
 * many students GoTrue can serve. The other scenarios reuse the sessions it
 * got, round robin.
 *
 * Needs Node 20 or later (global fetch). Prints one line a scenario and a
 * JSON summary last.
 */

const URL_ = process.env.SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.SUPABASE_KEY;
if (!URL_ || !KEY) {
  console.error('SUPABASE_URL and SUPABASE_KEY (the branch\'s publishable key) are required.');
  process.exit(2);
}
if (/lzrqvlugnawcgywkhqlz/.test(URL_)) {
  console.error('That is production. This runs against a preview branch only.');
  process.exit(2);
}
const STUDENTS = Number(process.env.LOAD_STUDENTS ?? 200);
const CLIENTS = Number(process.env.LOAD_CLIENTS ?? 8);
const SECONDS = Number(process.env.LOAD_SECONDS ?? 30);
const SIGNINS = Number(process.env.LOAD_SIGNINS ?? 60);

const pick = (n) => 1 + Math.floor(Math.random() * n);
const pct = (xs, p) => (xs.length ? xs[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : NaN);

/** One request, timed. Never throws: a network failure is status 0. */
async function timed(url, init = {}) {
  const t = performance.now();
  try {
    const res = await fetch(url, init);
    const body = await res.text();
    return { ms: performance.now() - t, status: res.status, body };
  } catch (e) {
    return { ms: performance.now() - t, status: 0, body: String(e) };
  }
}

function tally(name, samples, seconds, extra = {}) {
  const ok = samples.filter((s) => s.ok).map((s) => s.ms).sort((a, b) => a - b);
  const codes = {};
  for (const s of samples) if (!s.ok) codes[s.why] = (codes[s.why] ?? 0) + 1;
  const r = {
    scenario: name,
    requests: samples.length,
    ok: ok.length,
    per_second: +(ok.length / seconds).toFixed(1),
    p50_ms: +pct(ok, 50).toFixed(0),
    p95_ms: +pct(ok, 95).toFixed(0),
    p99_ms: +pct(ok, 99).toFixed(0),
    failed: codes,
    ...extra,
  };
  const bad = Object.entries(codes).map(([k, v]) => `${v}×${k}`).join(' ');
  console.log(
    `  ${bad ? '✗' : '✓'} ${name}: ${r.ok}/${r.requests} ok, ${r.per_second}/s, p50 ${r.p50_ms}ms p95 ${r.p95_ms}ms p99 ${r.p99_ms}ms${bad ? `, failed ${bad}` : ''}`,
  );
  return r;
}

/** `clients` loops, each running `step` until `seconds` have passed. */
async function flat(seconds, clients, step) {
  const until = performance.now() + seconds * 1000;
  const samples = [];
  await Promise.all(
    Array.from({ length: clients }, async () => {
      while (performance.now() < until) samples.push(...(await step()));
    }),
  );
  return samples;
}

const base = { apikey: KEY };
const as = (s) => ({ ...base, Authorization: `Bearer ${s.token}` });

// ── Sign-in ──────────────────────────────────────────────────────────────
// At most SIGNINS attempts, four at a time; a 429 is GoTrue's rate limit, and
// the count before the first one is where it sits for one IP.
console.log(`· edge load against ${new URL(URL_).host}: ${STUDENTS} students, ${CLIENTS} clients, ${SECONDS}s a scenario`);
const sessions = [];
const signins = [];
let firstLimited = null;
{
  const started = performance.now();
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < SIGNINS) {
        const n = (next++ % STUDENTS) + 1;
        const r = await timed(`${URL_}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { ...base, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: `student${n}@edge-load.example`, password: `edge-load-${n}` }),
        });
        const ok = r.status === 200;
        if (r.status === 429 && firstLimited === null) firstLimited = signins.filter((s) => s.ok).length;
        signins.push({ ok, ms: r.ms, why: String(r.status) });
        if (ok) {
          const j = JSON.parse(r.body);
          sessions.push({ n, token: j.access_token, user: j.user.id });
        }
      }
    }),
  );
  var signinResult = tally('sign-in', signins, (performance.now() - started) / 1000, {
    first_rate_limited_after: firstLimited,
  });
}
if (sessions.length === 0) {
  console.error('No session: nothing else can run. Is the branch seeded (seed.sql)?');
  process.exit(1);
}
const any = () => sessions[Math.floor(Math.random() * sessions.length)];

// ── Open: the pull (lib/cloud.ts pull), both requests at once ─────────────
const open = await flat(SECONDS, CLIENTS, async () => {
  const s = any();
  const [a, b] = await Promise.all([
    timed(`${URL_}/rest/v1/state?select=data,updated_at&user_id=eq.${s.user}`, { headers: as(s) }),
    timed(`${URL_}/rest/v1/courses?select=id,data,updated_at&user_id=eq.${s.user}`, { headers: as(s) }),
  ]);
  const rows = a.status === 200 && b.status === 200 ? JSON.parse(b.body).length : 0;
  const ok = rows === 4 && JSON.parse(a.body).length === 1;
  return [{ ok, ms: Math.max(a.ms, b.ms), why: ok ? '' : `${a.status}/${b.status}/rows=${rows}` }];
});
const openResult = tally('open (pull)', open, SECONDS);

// ── Push: state and the one course edited, each by compare-and-swap ───────
// As lib/cloud.ts does it since D-1027. A compare-and-swap that matches
// nothing is a 200 with no rows, so the rows are counted. Two clients can pick
// the same student; the loser's empty answer is a Stale the app would recover
// from, and is counted as such rather than as a failure.
let stale = 0;
const push = await flat(SECONDS, CLIENTS, async () => {
  const s = any();
  const k = pick(4);
  const t0 = performance.now();
  const [st, co] = await Promise.all([
    timed(`${URL_}/rest/v1/state?select=updated_at&user_id=eq.${s.user}`, { headers: as(s) }),
    timed(`${URL_}/rest/v1/courses?select=updated_at&user_id=eq.${s.user}&id=eq.course-${k}`, { headers: as(s) }),
  ]);
  if (st.status !== 200 || co.status !== 200) return [{ ok: false, ms: 0, why: `read ${st.status}/${co.status}` }];
  const sAt = encodeURIComponent(JSON.parse(st.body)[0].updated_at);
  const cAt = encodeURIComponent(JSON.parse(co.body)[0].updated_at);
  const write = { ...as(s), 'Content-Type': 'application/json', Prefer: 'return=representation' };
  const a = await timed(`${URL_}/rest/v1/state?user_id=eq.${s.user}&updated_at=eq.${sAt}&select=updated_at`, {
    method: 'PATCH',
    headers: write,
    body: JSON.stringify({ data: { version: Date.now(), pad: 's'.repeat(27000) } }),
  });
  if (a.status === 200 && JSON.parse(a.body).length === 0) {
    stale++;
    return [];
  }
  const b = await timed(
    `${URL_}/rest/v1/courses?user_id=eq.${s.user}&id=eq.course-${k}&updated_at=eq.${cAt}&select=id,updated_at`,
    { method: 'PATCH', headers: write, body: JSON.stringify({ data: { version: Date.now(), pad: 'c'.repeat(42000) } }) },
  );
  if (b.status === 200 && JSON.parse(b.body).length === 0) {
    stale++;
    return [];
  }
  const ok = a.status === 200 && b.status === 200;
  // What the student waits for: the push, not the reads a real device already holds.
  return [{ ok, ms: performance.now() - t0 - Math.max(st.ms, co.ms), why: ok ? '' : `${a.status}/${b.status}` }];
});
const pushResult = tally('push (state + one course)', push, SECONDS, { stale });

// ── Edge function: the calendar feed a calendar app polls ─────────────────
const feed = await flat(SECONDS, CLIENTS, async () => {
  const n = pick(STUDENTS);
  const r = await timed(`${URL_}/functions/v1/calendar/${String(n).padStart(48, '0')}`);
  const ok = r.status === 200 && r.body.startsWith('BEGIN:VCALENDAR');
  return [{ ok, ms: r.ms, why: ok ? '' : String(r.status) }];
});
const feedResult = tally('edge function (calendar feed)', feed, SECONDS);

console.log(JSON.stringify({ at: new Date().toISOString(), host: new URL(URL_).host, STUDENTS, CLIENTS, SECONDS,
  results: [signinResult, openResult, pushResult, feedResult] }));
const failed = [openResult, pushResult, feedResult].some((r) => Object.keys(r.failed).length > 0);
process.exit(failed ? 1 : 0);
