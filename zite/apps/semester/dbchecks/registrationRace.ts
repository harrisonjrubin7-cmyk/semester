import { neon } from '@neondatabase/serverless';
import { MIGRATION_001 } from '../src/lib/pgMigration';

// Spec §3.6 critical invariant: two requests for the last seat must not both succeed.
// Runs the real reg_decide from migrations/001 in a throwaway schema (dropped afterwards), with N truly concurrent
// transactions over separate HTTP requests. Then replays one request (same key) and reuses a key with a different payload.
// Control: the same race with the section row lock removed, to show the test can see a double booking.
export async function run(n = 20) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const race = async (label: string, mig: string[]) => {
    const schema = `race_${Math.random().toString(36).slice(2, 10)}`;
    const sp = sql.query(`SET LOCAL search_path TO ${schema}, public`);
    try {
      await sql.query(`CREATE SCHEMA ${schema}`);
      await sql.transaction([sql.query(`SET LOCAL search_path TO ${schema}, public`), ...mig.map((q) => sql.query(q))]);
      const results = await Promise.allSettled(Array.from({ length: n }, (_, i) => sql.transaction([
        sql.query(`SET LOCAL search_path TO ${schema}, public`),
        sql.query(`SELECT reg_decide('t-race', $1, $2, 'registrar-1', 'approve', 'sec-last', $3, $4, 1, '') AS r`, [`key-${i}`, `hash-${i}`, `stu-${i}`, `req-${i}`]),
      ])));
      const outs = results.map((r) => (r.status === 'fulfilled' ? JSON.stringify((r.value[1] as { r: unknown }[])[0].r) : `error:${String((r as PromiseRejectedResult).reason?.message ?? '').slice(0, 60)}`));
      const [seats] = (await sql.transaction([sp, sql.query(`SELECT count(*)::int AS n FROM reg_seats WHERE tenant_id = 't-race' AND section_id = 'sec-last'`)]))[1] as { n: number }[];
      const committed = outs.filter((o) => o.includes('"Committed"')).length;
      const full = outs.filter((o) => o.includes('SECTION_FULL')).length;
      const errors = outs.filter((o) => o.startsWith('error')).length;
      let replay = '', conflict = '';
      if (label === 'real') {
        const winner = outs.findIndex((o) => o.includes('"Committed"'));
        const rp = (await sql.transaction([sql.query(`SET LOCAL search_path TO ${schema}, public`), sql.query(`SELECT reg_decide('t-race', $1, $2, 'registrar-1', 'approve', 'sec-last', $3, $4, 1, '') AS r`, [`key-${winner}`, `hash-${winner}`, `stu-${winner}`, `req-${winner}`])]))[1] as { r: Record<string, unknown> }[];
        replay = JSON.stringify(rp[0].r);
        const cf = (await sql.transaction([sql.query(`SET LOCAL search_path TO ${schema}, public`), sql.query(`SELECT reg_decide('t-race', $1, 'different-hash', 'registrar-1', 'approve', 'sec-last', 'stu-x', 'req-x', 1, '') AS r`, [`key-${winner}`])]))[1] as { r: Record<string, unknown> }[];
        conflict = JSON.stringify(cf[0].r);
      }
      console.log(`${label}: ${n} concurrent claims → seats=${seats.n} committed=${committed} full=${full} errors=${errors}${replay ? ` | replay=${replay} | reused-key=${conflict}` : ''}`);
      return { seats: seats.n, committed, full, errors };
    } finally {
      await sql.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      const left = (await sql.query(`SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name = $1`, [schema])) as { n: number }[];
      console.log(`${label}: schema ${schema} dropped=${left[0].n === 0}`);
    }
  };
  const real = await race('real', MIGRATION_001);
  // The upsert on reg_section_locks also takes the row lock, so the control removes both the upsert and the explicit lock,
  // and widens the check-then-insert window with a short sleep so concurrent requests can overlap.
  const unlocked = await race('control-no-row-lock', MIGRATION_001.map((q) => q
    .replace(/\s*INSERT INTO reg_section_locks \(tenant_id, section_id, capacity\) VALUES \(p_tenant, p_section, p_capacity\)\s*ON CONFLICT \(tenant_id, section_id\) DO UPDATE SET capacity = EXCLUDED.capacity;/, () => '')
    .replace(/\s*PERFORM 1 FROM reg_section_locks WHERE tenant_id = p_tenant AND section_id = p_section FOR UPDATE;/, () => '')
    .replace('SELECT count(*) INTO v_taken FROM reg_seats WHERE tenant_id = p_tenant AND section_id = p_section;', () => 'SELECT count(*) INTO v_taken FROM reg_seats WHERE tenant_id = p_tenant AND section_id = p_section; PERFORM pg_sleep(0.3);')));
  // The real code with the same sleep: still exactly one seat.
  const realSlow = await race('real-with-delay', MIGRATION_001.map((q) => q.replace('SELECT count(*) INTO v_taken FROM reg_seats WHERE tenant_id = p_tenant AND section_id = p_section;', () => 'SELECT count(*) INTO v_taken FROM reg_seats WHERE tenant_id = p_tenant AND section_id = p_section; PERFORM pg_sleep(0.3);')));
  console.log(`RESULT real_ok=${real.seats === 1 && real.committed === 1} real_with_delay_ok=${realSlow.seats === 1} control_double_booked=${unlocked.seats > 1}`);
}
