import { neon } from '@neondatabase/serverless';
import { CO_ROLE_STATEMENTS } from '../src/lib/coRoles';
import { MKT_MIGRATION } from '../src/lib/mktMigration';

// Marketing Admin "Campaigns" and Campaign Reviewer "Content, approval and rejection". One rolled-back transaction; the
// role rows exist only inside it. Nothing here can send: sending is a CHECK-constrained 'disabled' column.
// Run with the one-off runner on app sbjuykr2qw: import { run } from './dbchecks/campaigns'; await run();
export const CHECKS = `DO $$
DECLARE r jsonb; v_id text; got boolean; h text; v int;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO co_roles (tenant_id, user_id, role, granted_by) VALUES ('semester-company', 'zz_mk1', 'marketer', 'dbcheck'),
    ('semester-company', 'zz_mk1', 'marketing_approver', 'dbcheck'), ('semester-company', 'zz_ap1', 'marketing_approver', 'dbcheck');

  r := mkt_cmd('zz_ap1', 'c0', 'h0', 'create', NULL, '{"name":"Fall open house","channel":"email"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_AUTHORIZED', 'K1 creating needs the marketer role');
  r := mkt_cmd('zz_mk1', 'c1', 'h1', 'create', NULL, '{"name":"Fa","channel":"email"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'K2 name under 3 characters refused');
  r := mkt_cmd('zz_mk1', 'c2', 'h2', 'create', NULL, '{"name":"Fall open house","channel":"fax"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'K3 unknown channel refused');
  r := mkt_cmd('zz_mk1', 'c3', 'h3', 'create', NULL, '{"name":"Fall open house","channel":"email"}');
  v_id := r->>'id';
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT state FROM mkt_campaigns WHERE id = v_id) = 'draft', 'K4 marketer creates a draft');
  r := mkt_cmd('zz_mk1', 'c3', 'h3', 'create', NULL, '{"name":"Fall open house","channel":"email"}');
  INSERT INTO rr VALUES ((r->>'replay')::boolean AND (SELECT count(*) FROM mkt_campaigns WHERE author_id = 'zz_mk1') = 1, 'K5 a retry replays');
  r := mkt_cmd('zz_mk1', 'c3', 'h3x', 'create', NULL, '{"name":"Other","channel":"email"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'IDEMPOTENCY_CONFLICT', 'K6 reused key with new details conflicts');

  r := mkt_cmd('zz_mk1', 'c4', 'h4', 'edit', v_id, '{"version":1,"subject":"Visit us","body":"Come to the fall open house on campus and meet faculty. Details inside."}');
  r := mkt_cmd('zz_mk1', 'c5', 'h5', 'submit', v_id, '{"version":2,"audienceSize":40}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'K7 email without the unsubscribe link is refused ' || coalesce(r->>'message',''));
  r := mkt_cmd('zz_mk1', 'c6', 'h6', 'edit', v_id, '{"version":2,"body":"Come to the fall open house on campus and meet faculty. {{unsubscribe}}"}');
  r := mkt_cmd('zz_mk1', 'c7', 'h7', 'submit', v_id, '{"version":3,"audienceSize":0}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'NO_AUDIENCE', 'K8 no consented audience, no submission');
  r := mkt_cmd('zz_ap1', 'c8', 'h8', 'submit', v_id, '{"version":3,"audienceSize":40}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_AUTHORIZED', 'K9 only the author submits');
  r := mkt_cmd('zz_mk1', 'c9', 'h9', 'submit', v_id, '{"version":3,"audienceSize":40}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT state FROM mkt_campaigns WHERE id = v_id) = 'in_review', 'K10 submitted for review');
  r := mkt_cmd('zz_mk1', 'c10', 'h10', 'edit', v_id, '{"version":4,"subject":"Changed"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_STATE', 'K11 no edits while in review');

  SELECT mkt_hash(c), c.version INTO h, v FROM mkt_campaigns c WHERE id = v_id;
  r := mkt_cmd('zz_mk1', 'c11', 'h11', 'approve', v_id, jsonb_build_object('version', v, 'seenHash', h));
  INSERT INTO rr VALUES (r->>'resultCode' = 'SEPARATION_OF_DUTIES', 'K12 an author holding the approver role still cannot approve their own');
  r := mkt_cmd('zz_out', 'c12', 'h12', 'approve', v_id, jsonb_build_object('version', v, 'seenHash', h));
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_AUTHORIZED', 'K13 approval needs the approver role');
  r := mkt_cmd('zz_ap1', 'c13', 'h13', 'approve', v_id, jsonb_build_object('version', v, 'seenHash', 'not-what-is-stored'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'CONTENT_CHANGED', 'K14 approval is bound to the content the reviewer saw');
  r := mkt_cmd('zz_ap1', 'c14', 'h14', 'reject', v_id, jsonb_build_object('version', v, 'seenHash', h, 'note', 'no'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'K15 a rejection needs a reason');
  r := mkt_cmd('zz_ap1', 'c15', 'h15', 'reject', v_id, jsonb_build_object('version', v, 'seenHash', h, 'note', 'Date is wrong'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT state FROM mkt_campaigns WHERE id = v_id) = 'rejected', 'K16 reviewer rejects with a reason');

  SELECT version INTO v FROM mkt_campaigns WHERE id = v_id;
  r := mkt_cmd('zz_mk1', 'c16', 'h16', 'submit', v_id, jsonb_build_object('version', v, 'audienceSize', 40));
  SELECT mkt_hash(c), c.version INTO h, v FROM mkt_campaigns c WHERE id = v_id;
  r := mkt_cmd('zz_ap1', 'c17', 'h17', 'approve', v_id, jsonb_build_object('version', v, 'seenHash', h, 'note', 'Looks right', 'a11yReviewed', true));
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK', 'K17 a different approver approves ' || coalesce(r->>'message',''));
  INSERT INTO rr VALUES ((SELECT state = 'approved' AND approved_by = 'zz_ap1' AND approved_hash = h AND sending = 'disabled' FROM mkt_campaigns WHERE id = v_id), 'K18 approved with the exact hash; sending stays disabled');
  SELECT version INTO v FROM mkt_campaigns WHERE id = v_id;
  r := mkt_cmd('zz_mk1', 'c18', 'h18', 'edit', v_id, jsonb_build_object('version', v, 'spendMinor', 5000));
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT state = 'draft' AND approved_by IS NULL AND approved_hash IS NULL FROM mkt_campaigns WHERE id = v_id), 'K19 any edit voids the approval');
  r := mkt_cmd('zz_mk1', 'c19', 'h19', 'edit', v_id, jsonb_build_object('version', v, 'subject', 'stale'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'STALE', 'K20 stale version refused');
  got := false; BEGIN UPDATE mkt_campaigns SET sending = 'enabled' WHERE id = v_id; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'K21 nothing can enable sending');
  got := false; BEGIN UPDATE mkt_campaigns SET approved_by = author_id WHERE id = v_id; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'K22 the table refuses self-approval');
  got := false; BEGIN UPDATE mkt_campaigns SET audience_rule = 'all_students' WHERE id = v_id; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'K23 education records can never be the audience');
  got := false; BEGIN DELETE FROM mkt_timeline WHERE campaign_id = v_id; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'K24 timeline is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...CO_ROLE_STATEMENTS, ...MKT_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 900)); } };
  await go('real:', base);
  const m1 = base.map((q) => q.replace(`ELSIF p_actor = m.author_id THEN v_code := 'SEPARATION_OF_DUTIES'`, () => `ELSIF false THEN v_code := 'SEPARATION_OF_DUTIES'`));
  console.log('self-review mutant applied:', m1.join('') !== base.join(''));
  await go('mutant self-review (K12; constraint must still stop it):', m1);
  const m2 = base.map((q) => q.replace(`ELSIF p->>'seenHash' IS DISTINCT FROM mkt_hash(m) THEN`, () => `ELSIF false THEN`));
  console.log('seen-hash mutant applied:', m2.join('') !== base.join(''));
  await go('mutant approve unseen content (K14):', m2);
  const m3 = base.map((q) => q.replace(`state = 'draft', approved_by = NULL, approved_hash = NULL, approved_at = NULL WHERE id = m.id`, () => `approved_at = approved_at WHERE id = m.id`));
  console.log('void-on-edit mutant applied:', m3.join('') !== base.join(''));
  await go('mutant edit keeps approval (K19):', m3);
}
