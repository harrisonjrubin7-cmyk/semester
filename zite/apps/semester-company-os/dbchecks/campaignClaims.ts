import { neon } from '@neondatabase/serverless';
import { CO_ROLE_STATEMENTS } from '../src/lib/coRoles';
import { MKT_MIGRATION } from '../src/lib/mktMigration';

// Campaign Reviewer "claims", "accessibility" and "launch gating" (mkt-002). One rolled-back transaction; the role rows and
// sources exist only inside it. Nothing here sends anything: a clean launch check only records that sending is disabled.
// Run with the one-off runner on app sbjuykr2qw: import { run } from './dbchecks/campaignClaims'; await run();
export const CHECKS = `DO $$
DECLARE r jsonb; v_id text; got boolean; h text; v int; t text; s_ok text; s_old text; s_own text; k_id bigint;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO co_roles (tenant_id, user_id, role, granted_by) VALUES ('semester-company', 'zz_mk1', 'marketer', 'dbcheck'),
    ('semester-company', 'zz_ap1', 'marketing_approver', 'dbcheck'), ('semester-company', 'zz_ap2', 'marketing_approver', 'dbcheck');

  -- Source register
  t := mkt_source('zz_out', 'propose', '{"kind":"outcome","title":"Pilot report","reference":"docs/pilot-report.pdf"}');
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'C1 proposing a source needs a marketing role');
  t := mkt_source('zz_mk1', 'propose', '{"kind":"outcome","title":"Pilot report","reference":"short"}');
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'C2 a source must say where the evidence is kept');
  t := mkt_source('zz_mk1', 'propose', '{"kind":"outcome","title":"Pilot outcome report","reference":"docs/pilot-report.pdf section 3"}');
  s_ok := substr(t, 4);
  INSERT INTO rr VALUES (t LIKE 'ok:%' AND (SELECT state FROM mkt_sources WHERE id = s_ok) = 'proposed', 'C3 marketer proposes a source ' || t);
  t := mkt_source('zz_mk1', 'approve', jsonb_build_object('sourceId', s_ok, 'permissionNote', 'Signed permission letter on file'));
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'C4 approving needs the approver role');
  t := mkt_source('zz_ap1', 'approve', jsonb_build_object('sourceId', s_ok, 'permissionNote', 'ok'));
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'C5 approval must record publication permission');
  t := mkt_source('zz_ap1', 'approve', jsonb_build_object('sourceId', s_ok, 'permissionNote', 'Customer letter of 12 Oct, legal folder'));
  INSERT INTO rr VALUES (t LIKE 'ok:%' AND mkt_source_ok(s_ok, 'outcome'), 'C6 another person approves with permission ' || t);
  t := mkt_source('zz_ap1', 'propose', '{"kind":"price","title":"Price list","reference":"finance/price-list-2026"}');
  s_own := substr(t, 4);
  t := mkt_source('zz_ap1', 'approve', jsonb_build_object('sourceId', s_own, 'permissionNote', 'Approved price list, finance folder'));
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'C7 nobody approves a source they proposed');
  got := false; BEGIN UPDATE mkt_sources SET state = 'approved', approved_by = proposed_by, permission_note = 'forced by hand' WHERE id = s_own; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'C8 the table refuses self-approved sources');
  t := mkt_source('zz_mk1', 'propose', '{"kind":"metric","title":"Old usage study","reference":"docs/usage-2024.pdf","expiresOn":"2030-01-01"}');
  s_old := substr(t, 4);
  t := mkt_source('zz_ap1', 'approve', jsonb_build_object('sourceId', s_old, 'permissionNote', 'Internal study, publishable per CEO note'));
  UPDATE mkt_sources SET expires_on = current_date - 1 WHERE id = s_old;   -- time passes
  INSERT INTO rr VALUES (NOT mkt_source_ok(s_old, 'metric'), 'C9 an expired source no longer counts');
  INSERT INTO rr VALUES (NOT mkt_source_ok(s_ok, 'price'), 'C10 a source only supports its own kind of claim');

  -- A campaign with claim-like wording
  r := mkt_cmd('zz_mk1', 'k1', 'h1', 'create', NULL, '{"name":"Results campaign","channel":"email"}');
  v_id := r->>'id';
  r := mkt_cmd('zz_mk1', 'k2', 'h2', 'edit', v_id, '{"version":1,"subject":"Pilot results","body":"Students in the pilot finished 30% more assignments on time. See the report for details. {{unsubscribe}}"}');
  r := mkt_cmd('zz_mk1', 'k3', 'h3', 'submit', v_id, '{"version":2,"audienceSize":5}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'UNDECLARED_CLAIM', 'C11 claim-like wording with no declared claim is refused ' || coalesce(r->>'message',''));
  r := mkt_cmd('zz_mk1', 'k4', 'h4', 'claim_add', v_id, '{"version":2,"kind":"outcome","text":"30% more assignments on time"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK', 'C12 author declares the claim');
  r := mkt_cmd('zz_ap1', 'k5', 'h5', 'claim_add', v_id, '{"version":3,"kind":"price","text":"Free for students"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_AUTHORIZED', 'C13 only the author changes claims');
  r := mkt_cmd('zz_mk1', 'k6', 'h6', 'submit', v_id, '{"version":3,"audienceSize":5}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'UNSOURCED_CLAIM', 'C14 a claim with no source blocks submission');
  SELECT id INTO k_id FROM mkt_claims WHERE campaign_id = v_id;
  r := mkt_cmd('zz_mk1', 'k7', 'h7', 'claim_remove', v_id, jsonb_build_object('version', 3, 'claimId', k_id));
  r := mkt_cmd('zz_mk1', 'k8', 'h8', 'claim_add', v_id, jsonb_build_object('version', 4, 'kind', 'metric', 'text', '30% more assignments on time', 'sourceId', s_old));
  r := mkt_cmd('zz_mk1', 'k9', 'h9', 'submit', v_id, '{"version":5,"audienceSize":5}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'UNSOURCED_CLAIM', 'C15 an expired source blocks submission');
  SELECT id INTO k_id FROM mkt_claims WHERE campaign_id = v_id;
  r := mkt_cmd('zz_mk1', 'k10', 'h10', 'claim_remove', v_id, jsonb_build_object('version', 5, 'claimId', k_id));
  r := mkt_cmd('zz_mk1', 'k11', 'h11', 'claim_add', v_id, jsonb_build_object('version', 6, 'kind', 'outcome', 'text', '30% more assignments on time', 'sourceId', s_ok));
  r := mkt_cmd('zz_mk1', 'k12', 'h12', 'edit', v_id, '{"version":7,"body":"Students in the pilot finished 30% more assignments on time. Click here for the report. {{unsubscribe}}"}');
  r := mkt_cmd('zz_mk1', 'k13', 'h13', 'submit', v_id, '{"version":8,"audienceSize":5}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'ACCESSIBILITY', 'C16 vague link text blocks submission ' || coalesce(r->>'message',''));
  r := mkt_cmd('zz_mk1', 'k14', 'h14', 'edit', v_id, '{"version":8,"body":"Students in the pilot finished 30% more assignments on time. Read the pilot outcome report. {{unsubscribe}}"}');
  r := mkt_cmd('zz_mk1', 'k15', 'h15', 'submit', v_id, '{"version":9,"audienceSize":5}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK', 'C17 sourced, accessible campaign is submitted ' || coalesce(r->>'message',''));

  SELECT mkt_hash(c), c.version INTO h, v FROM mkt_campaigns c WHERE id = v_id;
  INSERT INTO rr VALUES (h IS DISTINCT FROM (SELECT md5(concat_ws('|', c.name, c.channel, c.subject, c.body, c.audience_rule, coalesce(c.audience_size, -1), c.spend_minor)) FROM mkt_campaigns c WHERE id = v_id),
    'C18 the approval hash covers the claims');
  r := mkt_cmd('zz_ap1', 'k16', 'h16', 'approve', v_id, jsonb_build_object('version', v, 'seenHash', h));
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'C19 approval needs the accessibility confirmation');
  r := mkt_cmd('zz_mk1', 'k17', 'h17', 'launch_check', v_id, jsonb_build_object('version', v, 'audienceNow', 5));
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT outcome FROM mkt_launch_checks WHERE campaign_id = v_id ORDER BY id DESC LIMIT 1) = 'blocked', 'C20 an unapproved campaign is blocked at launch');
  INSERT INTO rr VALUES ((SELECT version FROM mkt_campaigns WHERE id = v_id) = v, 'C21 a launch check does not change the version');
  r := mkt_cmd('zz_ap1', 'k18', 'h18', 'approve', v_id, jsonb_build_object('version', v, 'seenHash', h, 'a11yReviewed', true));
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK', 'C22 approver approves ' || coalesce(r->>'message',''));
  SELECT version INTO v FROM mkt_campaigns WHERE id = v_id;
  r := mkt_cmd('zz_mk1', 'k19', 'h19', 'launch_check', v_id, jsonb_build_object('version', v, 'audienceNow', 3));
  INSERT INTO rr VALUES ((SELECT outcome FROM mkt_launch_checks WHERE campaign_id = v_id ORDER BY id DESC LIMIT 1) = 'blocked', 'C23 consent withdrawn since approval blocks launch ' || coalesce(r->>'message',''));
  r := mkt_cmd('zz_ap2', 'k20', 'h20', 'launch_check', v_id, jsonb_build_object('version', v, 'audienceNow', 5));
  INSERT INTO rr VALUES ((SELECT outcome FROM mkt_launch_checks WHERE campaign_id = v_id ORDER BY id DESC LIMIT 1) = 'ready_sending_disabled'
    AND (SELECT sending FROM mkt_campaigns WHERE id = v_id) = 'disabled', 'C24 a clean check is recorded; sending stays disabled ' || coalesce(r->>'message',''));

  -- A source expires while a campaign waits for review
  t := mkt_source('zz_mk1', 'propose', '{"kind":"customer","title":"Northgate pilot agreement","reference":"contracts/northgate-pilot clause 9"}');
  s_own := substr(t, 4);
  t := mkt_source('zz_ap1', 'approve', jsonb_build_object('sourceId', s_own, 'permissionNote', 'Clause 9 grants naming rights in marketing'));
  r := mkt_cmd('zz_mk1', 'q1', 'hq1', 'create', NULL, '{"name":"Partner story","channel":"social"}');
  t := r->>'id';
  r := mkt_cmd('zz_mk1', 'q2', 'hq2', 'edit', t, '{"version":1,"subject":"Partner story","body":"A partner college is piloting Semester this term with its first-year students."}');
  r := mkt_cmd('zz_mk1', 'q3', 'hq3', 'claim_add', t, jsonb_build_object('version', 2, 'kind', 'customer', 'text', 'A partner college is piloting Semester', 'sourceId', s_own));
  r := mkt_cmd('zz_mk1', 'q4', 'hq4', 'submit', t, '{"version":3,"audienceSize":5}');
  UPDATE mkt_sources SET expires_on = current_date - 1 WHERE id = s_own;
  SELECT mkt_hash(c), c.version INTO h, v FROM mkt_campaigns c WHERE id = t;
  got := false;
  BEGIN r := mkt_cmd('zz_ap1', 'q5', 'hq5', 'approve', t, jsonb_build_object('version', v, 'seenHash', h, 'a11yReviewed', true));
    got := r->>'resultCode' = 'UNSOURCED_CLAIM';
  EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got AND (SELECT state FROM mkt_campaigns WHERE id = t) = 'in_review', 'C30 a source that expired during review blocks approval');

  -- Revocation voids the approval
  t := mkt_source('zz_ap2', 'revoke', jsonb_build_object('sourceId', s_ok, 'reason', 'Customer withdrew permission'));
  INSERT INTO rr VALUES (t LIKE 'ok:%' AND (SELECT state = 'draft' AND approved_by IS NULL FROM mkt_campaigns WHERE id = v_id), 'C25 revoking a source returns citing campaigns to draft');
  got := false; BEGIN UPDATE mkt_campaigns SET state = 'approved', approved_by = 'zz_ap1' WHERE id = v_id; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'C26 the table refuses approval while a claim is unsourced');
  got := false; BEGIN DELETE FROM mkt_launch_checks WHERE campaign_id = v_id; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'C27 launch checks are append-only');
  got := false; BEGIN INSERT INTO mkt_launch_checks (campaign_id, actor_id, hash, blockers, outcome) VALUES (v_id, 'x', 'x', '{}', 'blocked'); EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'C28 a blocked outcome must list its blockers');
  INSERT INTO rr VALUES (cardinality(mkt_hints('Meet faculty at the open house on campus.')) = 0, 'C29 ordinary wording is not flagged');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run(only?: string) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...CO_ROLE_STATEMENTS, ...MKT_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 1200)); } };
  const mutants: [string, string, string][] = [
    ['approve-unsourced (C26 trigger must still hold; C22 path unchanged)', `ELSIF p_action = 'approve' AND cardinality(mkt_claim_blockers(m.id)) > 0 THEN`, `ELSIF false THEN`],
    ['expired source counts (C9, C15)', `AND (s.expires_on IS NULL OR s.expires_on >= current_date)`, ``],
    ['revoke keeps approvals (C25)', `WHERE c.state IN ('approved', 'in_review') AND EXISTS`, `WHERE false AND EXISTS`],
    ['self-approved source (C7)', `IF p_actor = s.proposed_by THEN RETURN`, `IF false THEN RETURN`],
  ];
  if (!only || only === 'real') await go('real:', base);
  for (const [label, from, to] of mutants) {
    if (only && only !== 'mutants' && !label.startsWith(only)) continue;
    const m = base.map((q) => q.replace(from, () => to));
    console.log(label, 'applied:', m.join('') !== base.join(''));
    await go('mutant ' + label + ':', m);
  }
}
