import { neon } from '@neondatabase/serverless';
import { CO_ROLE_STATEMENTS } from '../src/lib/coRoles';
import { HKB_MIGRATION } from '../src/lib/hkbMigration';

// Support Agent "help articles" (lib/hkbMigration.ts). One rolled-back transaction; role rows exist only inside it.
// Run on app sbjuykr2qw: import { run } from './dbchecks/helpArticles'; await run();
export const CHECKS = `DO $$
DECLARE r jsonb; a1 text; a2 text; a3 text; h text; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO co_roles (tenant_id, user_id, role, granted_by) VALUES ('semester-company', 'zz_sa1', 'support_agent', 'dbcheck'), ('semester-company', 'zz_sa2', 'support_agent', 'dbcheck');
  INSERT INTO co_roles (tenant_id, user_id, role, granted_by, revoked_at) VALUES ('semester-company', 'zz_sa3', 'support_agent', 'dbcheck', now());
  r := hkb_cmd('zz_out', 'h0', 'x0', 'draft', NULL, '{"title":"Resetting a password","body":"Open Settings, choose Security, then Reset password and follow the email.","audience":"internal"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_AUTHORIZED', 'H1 writing needs the support agent role');
  r := hkb_cmd('zz_sa3', 'h0', 'x0', 'draft', NULL, '{"title":"Resetting a password","body":"Open Settings, choose Security, then Reset password and follow the email.","audience":"internal"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_AUTHORIZED', 'H2 a revoked role is refused');
  r := hkb_cmd('zz_sa1', 'h1', 'x1', 'draft', NULL, '{"title":"Short","body":"too short","audience":"internal"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'H3 title and body length enforced');
  r := hkb_cmd('zz_sa1', 'h2', 'x2', 'draft', NULL, '{"title":"Resetting a password","body":"Open Settings, choose Security, then Reset password and follow the email.","audience":"internal"}'); a1 := r->>'id';
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK', 'H4 an agent drafts');
  r := hkb_cmd('zz_sa1', 'h2', 'x2', 'draft', NULL, '{}');
  INSERT INTO rr VALUES ((r->>'replay')::boolean AND (SELECT count(*) FROM hkb_articles WHERE author_id = 'zz_sa1') = 1, 'H5 a retry replays');
  r := hkb_cmd('zz_sa1', 'h2', 'x2-changed', 'draft', NULL, '{}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'IDEMPOTENCY_CONFLICT', 'H6 reused key with new details conflicts');
  r := hkb_cmd('zz_sa2', 'h3', 'x3', 'edit', a1, '{"version":1,"title":"Taken over"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_AUTHORIZED', 'H7 only the author edits a draft');
  r := hkb_cmd('zz_sa1', 'h4', 'x4', 'submit', a1, '{"version":1}');
  SELECT hkb_hash(x), x.version INTO h, v FROM hkb_articles x WHERE id = a1;
  r := hkb_cmd('zz_sa1', 'h5', 'x5', 'publish', a1, jsonb_build_object('version', v, 'seenHash', h));
  INSERT INTO rr VALUES (r->>'resultCode' = 'SEPARATION_OF_DUTIES', 'H8 the author cannot publish their own');
  r := hkb_cmd('zz_sa2', 'h6', 'x6', 'publish', a1, jsonb_build_object('version', v, 'seenHash', 'stale'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'CONTENT_CHANGED', 'H9 publishing is bound to the text the reviewer saw');
  r := hkb_cmd('zz_sa2', 'h7', 'x7', 'publish', a1, jsonb_build_object('version', v, 'seenHash', h, 'note', 'Matches current settings screen'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT state = 'published' AND reviewer_id = 'zz_sa2' FROM hkb_articles WHERE id = a1), 'H10 another agent publishes');

  r := hkb_cmd('zz_sa1', 'h8', 'x8', 'draft', NULL, '{"title":"Is Semester certified?","body":"Semester holds a certification for student data protection and passed an audit.","audience":"customer","claimTypes":["certification"]}'); a2 := r->>'id';
  INSERT INTO rr VALUES (r->>'resultCode' = 'NEEDS_SOURCE', 'H11 a claim without a cited source cannot be saved ' || coalesce(r->>'resultCode', ''));
  r := hkb_cmd('zz_sa1', 'h9', 'x9', 'draft', NULL, '{"title":"Is Semester certified?","body":"Semester does not hold any certification yet; see the Trust Center for current status.","audience":"customer","claimTypes":["certification"],"claimSources":"Trust Center control list, reviewed 2026-10-22"}'); a2 := r->>'id';
  PERFORM hkb_cmd('zz_sa1', 'h10', 'x10', 'submit', a2, '{"version":1}');
  SELECT hkb_hash(x), x.version INTO h, v FROM hkb_articles x WHERE id = a2;
  r := hkb_cmd('zz_sa2', 'h11', 'x11', 'publish', a2, jsonb_build_object('version', v, 'seenHash', h));
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT delivery FROM hkb_articles WHERE id = a2) = 'disabled' AND r->>'message' LIKE '%delivery is disabled%', 'H12 a customer article is approved but not delivered');
  got := false; BEGIN UPDATE hkb_articles SET delivery = 'enabled' WHERE id = a2; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'H13 nothing can turn customer delivery on');

  SELECT version INTO v FROM hkb_articles WHERE id = a1;
  r := hkb_cmd('zz_sa1', 'h12', 'x12', 'edit', a1, jsonb_build_object('version', v, 'body', 'Changed text that is definitely long enough to be an answer here.'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_STATE', 'H14 published text is never edited in place');
  r := hkb_cmd('zz_sa2', 'h13', 'x13', 'revise', a1, jsonb_build_object('version', v)); a3 := r->>'id';
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT supersedes = a1 AND state = 'draft' AND author_id = 'zz_sa2' FROM hkb_articles WHERE id = a3), 'H15 a revision is a new draft by the reviser');
  PERFORM hkb_cmd('zz_sa2', 'h14', 'x14', 'submit', a3, '{"version":1}');
  SELECT hkb_hash(x), x.version INTO h, v FROM hkb_articles x WHERE id = a3;
  r := hkb_cmd('zz_sa1', 'h15', 'x15', 'publish', a3, jsonb_build_object('version', v, 'seenHash', h));
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT state FROM hkb_articles WHERE id = a1) = 'retired', 'H16 publishing the revision retires the old version');
  got := false; BEGIN UPDATE hkb_articles SET reviewer_id = author_id WHERE id = a3; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'H17 the table refuses self-review');
  got := false; BEGIN DELETE FROM hkb_events WHERE article_id = a1; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'H18 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...CO_ROLE_STATEMENTS, ...HKB_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', base);
  const muts: [string, string, string][] = [
    ['self-publish (H8; constraint must still stop it)', `IF a.author_id = p_actor THEN v_code := 'SEPARATION_OF_DUTIES'`, `IF false THEN v_code := 'SEPARATION_OF_DUTIES'`],
    ['unseen text (H9)', `ELSIF p->>'seenHash' IS DISTINCT FROM hkb_hash(a) THEN`, `ELSIF false THEN`],
    ['claim source (H11; table rule must still stop it)', `ELSIF cardinality(v_claims) > 0 AND length(trim(coalesce(p->>'claimSources', ''))) < 10 THEN`, `ELSIF false THEN`],
    ['edit published (H14)', `ELSIF a.state <> 'draft' THEN v_code := 'BAD_STATE'; v_msg := 'Only drafts can be edited.`, `ELSIF false THEN v_code := 'BAD_STATE'; v_msg := 'Only drafts can be edited.`],
  ];
  for (const [name, from, to] of muts) { const m = base.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== base.join('')); await go(`mutant ${name}:`, m); }
}
