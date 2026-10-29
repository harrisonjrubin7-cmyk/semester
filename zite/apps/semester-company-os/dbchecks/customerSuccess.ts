import { neon } from '@neondatabase/serverless';
import { CO_ROLE_STATEMENTS } from '../src/lib/coRoles';
import { CSX_MIGRATION } from '../src/lib/csxMigration';

// Customer Success (lib/csxMigration.ts). One rolled-back transaction; role rows exist only inside it.
// Run on app sbjuykr2qw: import { run } from './dbchecks/customerSuccess'; await run();
export const CHECKS = `DO $$
DECLARE x text; g bigint; q bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO co_roles (tenant_id, user_id, role, granted_by) VALUES ('semester-company', 'zz_cs1', 'customer_success', 'dbcheck'),
    ('semester-company', 'zz_cs1', 'platform_admin', 'dbcheck'), ('semester-company', 'zz_pa1', 'platform_admin', 'dbcheck');

  -- Account ↔ institution link
  x := csx_link('zz_pa1', 'propose', 'acc_zz1', 'inst_zz1', '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'S1 proposing a link needs the customer success role');
  x := csx_link('zz_cs1', 'propose', 'acc_zz1', 'inst_zz1', 'Signed order form names this campus');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND csx_tenant('acc_zz1') IS NULL, 'S2 a proposed link shows no adoption yet');
  x := csx_link('zz_cs1', 'confirm', 'acc_zz1', 'inst_zz1', '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'S3 the proposer cannot confirm, even holding platform admin');
  x := csx_link('zz_pa1', 'confirm', 'acc_zz1', 'inst_other', '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'S4 confirmation is bound to the institution that was proposed');
  x := csx_link('zz_pa1', 'confirm', 'acc_zz1', 'inst_zz1', '');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND csx_tenant('acc_zz1') = 'inst_zz1', 'S5 another platform admin confirms');
  x := csx_link('zz_cs1', 'propose', 'acc_zz2', 'inst_zz1', 'Second account');
  x := csx_link('zz_pa1', 'confirm', 'acc_zz2', 'inst_zz1', '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%' OR csx_tenant('acc_zz2') IS NULL, 'S6 one institution links to one account at a time');
  got := false; BEGIN UPDATE csx_links SET confirmed_by = proposed_by WHERE account_id = 'acc_zz1'; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'S7 the table refuses self-confirmation');

  -- Success plan
  x := csx_goal('zz_pa1', 'add', '{"accountId":"acc_zz1","goal":"Advisors use degree plans","measure":"Plans created per month","target":"40","dueOn":"2030-01-01"}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'G1 goals need the customer success role');
  x := csx_goal('zz_cs1', 'add', '{"accountId":"acc_zz1","goal":"Advisors use degree plans","measure":"Plans created per month","target":"40","dueOn":"2001-01-01"}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'G2 a goal cannot be due in the past');
  x := csx_goal('zz_cs1', 'add', '{"accountId":"acc_zz1","goal":"Advisors use degree plans","measure":"Plans created per month","target":"40","dueOn":"2030-01-01"}');
  g := substr(x, 4)::bigint;
  x := csx_goal('zz_cs1', 'achieved', jsonb_build_object('goalId', g, 'version', 1, 'evidence', 'yes'));
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'G3 an outcome needs evidence');
  x := csx_goal('zz_cs1', 'achieved', jsonb_build_object('goalId', g, 'version', 9, 'evidence', 'October: 52 plans created'));
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'G4 stale goal edits are refused');
  x := csx_goal('zz_cs1', 'achieved', jsonb_build_object('goalId', g, 'version', 1, 'evidence', 'October: 52 plans created'));
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'G5 achieved with evidence');
  got := false; BEGIN UPDATE csx_goals SET evidence = '' WHERE id = g; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'G6 the table keeps the evidence on an outcome');

  -- QBR
  x := csx_qbr('zz_cs1', 'plan', '{"accountId":"acc_zz1","scheduledFor":"2030-02-01"}');
  q := substr(x, 4)::bigint;
  x := csx_qbr('zz_cs1', 'plan', '{"accountId":"acc_zz1","scheduledFor":"2030-03-01"}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'Q1 one open review per account');
  x := csx_qbr('zz_cs1', 'hold', jsonb_build_object('qbrId', q, 'version', 1, 'notes', 'Discussed adoption and next steps for spring term.'));
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'Q2 a review must be prepared before it is held');
  x := csx_qbr('zz_cs1', 'prepare', jsonb_build_object('qbrId', q, 'version', 1, 'snapshot', jsonb_build_object('activeMembers', 120, 'goals', 1)));
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT snapshot_hash = md5(snapshot::text) FROM csx_qbrs WHERE id = q), 'Q3 preparing freezes a hashed snapshot');
  got := false; BEGIN UPDATE csx_qbrs SET snapshot = '{"activeMembers":999}', snapshot_hash = md5('{"activeMembers": 999}') WHERE id = q; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'Q4 a frozen snapshot cannot be changed');
  x := csx_qbr('zz_cs1', 'hold', jsonb_build_object('qbrId', q, 'version', 2, 'notes', 'short'));
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'Q5 holding needs real notes');
  x := csx_qbr('zz_cs1', 'action', jsonb_build_object('qbrId', q, 'version', 2, 'title', 'Train advisors', 'owner', 'Registrar', 'dueOn', '2030-02-15'));
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'Q6 follow-ups come after the review is held');
  x := csx_qbr('zz_cs1', 'hold', jsonb_build_object('qbrId', q, 'version', 2, 'notes', 'Discussed adoption and next steps for spring term.', 'attendees', 'Provost office, IT'));
  x := csx_qbr('zz_cs1', 'action', jsonb_build_object('qbrId', q, 'version', 3, 'title', 'Train advisors on plans', 'owner', 'Registrar', 'dueOn', '2030-02-15'));
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT count(*) FROM csx_actions WHERE qbr_id = q) = 1, 'Q7 follow-up recorded after the review');
  got := false; BEGIN UPDATE csx_qbrs SET state = 'planned' WHERE id = q; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'Q8 a held review cannot be reopened');
  got := false; BEGIN DELETE FROM csx_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'Q9 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run(only?: string) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...CO_ROLE_STATEMENTS, ...CSX_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 1200)); } };
  const muts: [string, string, string][] = [
    ['proposer confirms (S3; S7 backstop)', `IF l.proposed_by = p_actor THEN RETURN`, `IF false THEN RETURN`],
    ['confirm any institution (S4)', `IF l.tenant_id IS DISTINCT FROM p_tenant THEN RETURN`, `IF false THEN RETURN`],
    ['hold without prepare (Q2)', `IF q.state <> 'prepared' THEN RETURN 'Prepare the review`, `IF q.state NOT IN ('prepared', 'planned') THEN RETURN 'Prepare the review`],
  ];
  if (!only || only === 'real') await go('real:', base);
  for (const [label, from, to] of muts) {
    if (only && only !== 'mutants' && !label.startsWith(only)) continue;
    const m = base.map((s) => s.replace(from, () => to));
    console.log(label, 'applied:', m.join('') !== base.join(''));
    await go('mutant ' + label + ':', m);
  }
}
