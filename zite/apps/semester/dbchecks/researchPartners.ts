import { neon } from '@neondatabase/serverless';
import { DGV_MIGRATION } from '../src/lib/dgvMigration';
import { RSD_MIGRATION } from '../src/lib/rsdMigration';
import { RPP_MIGRATION } from '../src/lib/rppMigration';

// Research Partner: protocols, governance review, data-use agreements, approved datasets, secure analysis, output review
// (lib/rppMigration.ts). One rolled-back transaction with synthetic ids. Run on app jeabiv2536:
// import { run } from './dbchecks/researchPartners'; await run();
export const TERMS = "The partner uses the named aggregate snapshots only for the approved protocol, keeps them inside the Semester platform, makes no attempt to re-identify any person, does not combine them with other data about the institution's students, and submits every output for review before release.";
export const CHECKS = `DO $$
DECLARE x text; ds bigint; ds2 bigint; dX bigint; snap bigint; snapX bigint; p1 bigint; g1 bigint; o1 bigint; o2 bigint; h text; got boolean; terms text := '${TERMS.replace(/'/g, "''")}';
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO dgv_stewards (tenant_id, user_id, granted_by) VALUES ('t1', 'st1', 'adm'), ('t1', 'st2', 'adm'), ('t1', 'pa1', 'adm2');
  INSERT INTO rsd_defs (tenant_id, kind, lineage, title, purpose, spec, spec_hash, state, author_id, approver_id) VALUES ('t1', 'dataset', 'L1', 'Enrollment overview', 'Aggregate enrollment for partners', '{"metrics":["enrollments_by_status"]}', 'h1', 'approved', 'ir1', 'st1') RETURNING id INTO ds;
  INSERT INTO rsd_defs (tenant_id, kind, lineage, title, purpose, spec, spec_hash, state, author_id) VALUES ('t1', 'dataset', 'L2', 'Draft dataset', 'Not yet approved by a steward', '{"metrics":["payment_plans"]}', 'h2', 'draft', 'ir1') RETURNING id INTO ds2;
  INSERT INTO rsd_defs (tenant_id, kind, lineage, title, purpose, spec, spec_hash, state, author_id, approver_id) VALUES ('t2', 'dataset', 'L3', 'Other school', 'Another institution''s dataset', '{"metrics":["payment_plans"]}', 'h3', 'approved', 'irB', 'stB') RETURNING id INTO dX;
  INSERT INTO rsd_snapshots (tenant_id, def_id, spec_hash, code_version, min_cell, output, output_hash, run_by) VALUES ('t1', ds, 'h1', 'v1', 10, '{"tables":[]}', 'o1', 'ir1') RETURNING id INTO snap;
  INSERT INTO rsd_snapshots (tenant_id, def_id, spec_hash, code_version, min_cell, output, output_hash, run_by) VALUES ('t1', ds2, 'h2', 'v1', 10, '{"tables":[]}', 'o2', 'ir1') RETURNING id INTO snapX;

  x := rpp_submit('pa1', 'key-0001', 't1', 'Riverside Policy Lab', 'Enrollment patterns', 'Understand enrollment status mix across terms to inform advising policy.', 'IRB-2026-114', ARRAY[ds2], 365);
  INSERT INTO rr VALUES (x = 'Only that institution''s approved datasets can be requested.', 'P1 drafts cannot be requested');
  x := rpp_submit('pa1', 'key-0001', 't1', 'Riverside Policy Lab', 'Enrollment patterns', 'Understand enrollment status mix across terms to inform advising policy.', 'IRB-2026-114', ARRAY[dX], 365);
  INSERT INTO rr VALUES (x = 'Only that institution''s approved datasets can be requested.', 'P2 another institution''s dataset cannot be requested');
  x := rpp_submit('pa1', 'key-0001', 't1', 'Riverside Policy Lab', 'Enrollment patterns', 'Too short', 'IRB-2026-114', ARRAY[ds], 365);
  INSERT INTO rr VALUES (x = 'Describe the research aims (40+ characters).', 'P3 aims are required');
  x := rpp_submit('pa1', 'key-0001', 't1', 'Riverside Policy Lab', 'Enrollment patterns', 'Understand enrollment status mix across terms to inform advising policy.', 'IRB-2026-114', ARRAY[ds], 2000);
  INSERT INTO rr VALUES (x = 'Retention must be 30 to 1095 days.', 'P4 retention is bounded');
  x := rpp_submit('pa1', 'key-0001', 't1', 'Riverside Policy Lab', 'Enrollment patterns', 'Understand enrollment status mix across terms to inform advising policy.', 'IRB-2026-114', ARRAY[ds], 365); p1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'P5 a partner submits a protocol');
  x := rpp_submit('pa1', 'key-0001', 't1', 'Riverside Policy Lab', 'Enrollment patterns', 'Understand enrollment status mix across terms to inform advising policy.', 'IRB-2026-114', ARRAY[ds], 365);
  INSERT INTO rr VALUES (x = 'replay:' || p1, 'P6 a retry replays');
  INSERT INTO rr VALUES (NOT rpp_read_ok('pa1', snap), 'P7 nothing is readable before approval and agreement');

  SELECT protocol_hash INTO h FROM rpp_protocols WHERE id = p1;
  x := rpp_review('pa1', 't1', p1, true, h, 'Looks fine to me');
  INSERT INTO rr VALUES (x = 'You submitted this protocol, so another steward reviews it.', 'P8 a partner who is also a steward cannot approve their own');
  x := rpp_review('ir1', 't1', p1, true, h, 'Looks fine to me');
  INSERT INTO rr VALUES (x = 'Only a data steward reviews research protocols.', 'P9 only stewards review');
  x := rpp_review('st1', 't2', p1, true, h, 'Looks fine to me');
  INSERT INTO rr VALUES (x = 'Only a data steward reviews research protocols.', 'P10 another institution cannot review');
  x := rpp_review('st1', 't1', p1, true, 'stale', 'Looks fine to me');
  INSERT INTO rr VALUES (x = 'The protocol changed since you opened it. Reload and review again.', 'P11 approval bound to the protocol seen');
  x := rpp_review('st1', 't1', p1, true, h, 'Aggregates only; IRB reference checked');
  INSERT INTO rr VALUES (x IS NULL, 'P12 a steward approves');
  INSERT INTO rr VALUES (NOT rpp_read_ok('pa1', snap), 'P13 approval alone gives no access (agreement needed)');

  x := rpp_issue('st1', 't1', p1, 'short terms', 30);
  INSERT INTO rr VALUES (x = 'Write the full terms (200+ characters).', 'P14 agreement terms are required');
  x := rpp_issue('st1', 't1', p1, terms, 400);
  INSERT INTO rr VALUES (x = 'The agreement cannot run longer than the protocol''s retention period.', 'P15 agreement within the retention period');
  x := rpp_issue('st1', 't1', p1, terms, 180); g1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND NOT rpp_read_ok('pa1', snap), 'P16 issued but not accepted: still no access');
  x := rpp_accept('st2', g1, md5(terms));
  INSERT INTO rr VALUES (x = 'Agreement not found.', 'P17 only the partner accepts');
  x := rpp_accept('pa1', g1, 'other');
  INSERT INTO rr VALUES (x = 'The terms changed since you opened them. Reload and read them again.', 'P18 acceptance bound to the terms read');
  x := rpp_accept('pa1', g1, md5(terms));
  INSERT INTO rr VALUES (x IS NULL AND rpp_read_ok('pa1', snap), 'P19 accepted: the approved dataset''s snapshot is readable');
  INSERT INTO rr VALUES (NOT rpp_read_ok('pa1', snapX) AND NOT rpp_read_ok('pa2', snap), 'P20 other datasets and other partners stay closed');

  x := rpp_output_submit('pa1', p1, 'Draft findings', 'Enrollment status mix is stable across terms.', ARRAY[snapX]);
  INSERT INTO rr VALUES (x = 'An output can only cite snapshots you are allowed to read.', 'P21 outputs cite readable snapshots only');
  x := rpp_output_submit('pa1', p1, 'Draft findings', 'Enrollment status mix is stable across terms.', ARRAY[snap]); o1 := substr(x, 4)::bigint;
  x := rpp_output_submit('pa1', p1, 'Small group', 'In one program only 4 students withdrew after week two.', ARRAY[snap]); o2 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES ((SELECT NOT small_numbers FROM rpp_outputs WHERE id = o1) AND (SELECT small_numbers FROM rpp_outputs WHERE id = o2), 'P22 small numbers in the text are flagged');
  x := rpp_output_review('pa1', 't1', o1, 'approve', false, 'Approving my own output');
  INSERT INTO rr VALUES (x = 'You wrote this output, so another steward reviews it.', 'P23 no self-review of outputs');
  x := rpp_output_review('st1', 't1', o2, 'approve', false, 'Checked against the snapshot');
  INSERT INTO rr VALUES (x = 'The text contains a number under 10. Confirm it is not a count of people before approving.', 'P24 small numbers need confirmation');
  x := rpp_output_review('st1', 't1', o2, 'reject', false, 'A count of 4 students would identify people');
  INSERT INTO rr VALUES (x IS NULL, 'P25 a steward rejects the small-count output');
  x := rpp_output_review('st1', 't1', o1, 'approve', false, 'Matches suppressed snapshot; no small cells');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state FROM rpp_outputs WHERE id = o1) = 'approved', 'P26 a clean output is approved');

  x := rpp_revoke('st2', 't1', g1, 'short');
  INSERT INTO rr VALUES (x = 'Say why (10+ characters). The partner sees this.', 'P27 revocation needs a reason');
  x := rpp_revoke('st2', 't1', g1, 'Partner moved to a new institution');
  INSERT INTO rr VALUES (x IS NULL AND NOT rpp_read_ok('pa1', snap), 'P28 revoking the agreement closes access at once');
  x := rpp_output_submit('pa1', p1, 'Late findings', 'More text to release after revocation.', ARRAY[snap]);
  INSERT INTO rr VALUES (x = 'Outputs need an approved protocol with an active agreement.', 'P29 no outputs without an active agreement');
  UPDATE rpp_agreements SET revoked_at = NULL, revoked_by = NULL, revoked_reason = NULL, expires_at = now() - interval '1 day' WHERE id = g1;
  INSERT INTO rr VALUES (NOT rpp_read_ok('pa1', snap), 'P30 an expired agreement gives no access');
  got := false; BEGIN UPDATE rpp_protocols SET reviewer_id = partner_id WHERE id = p1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'P31 the table refuses self-review of a protocol');
  got := false; BEGIN UPDATE rpp_outputs SET state = 'approved', small_ack = false WHERE id = o2; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'P32 the table refuses approving a small-number output without confirmation');
  got := false; BEGIN DELETE FROM rpp_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'P33 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...DGV_MIGRATION, ...RSD_MIGRATION, ...RPP_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', base);
  const muts: [string, string, string][] = [
    ['access without agreement (P13, P16)', `AND p.state = 'approved' AND rpp_active_agreement(p.id) IS NOT NULL) $$`, `AND p.state = 'approved') $$`],
    ['any dataset readable (P20)', `JOIN rpp_protocols p ON p.tenant_id = s.tenant_id AND s.def_id = ANY(p.datasets)`, `JOIN rpp_protocols p ON p.tenant_id = s.tenant_id`],
    ['expired still active (P30)', `AND accepted_at IS NOT NULL AND expires_at > now() LIMIT 1 $$`, `AND accepted_at IS NOT NULL LIMIT 1 $$`],
    ['small numbers waved through (P24)', `IF p_step = 'approve' AND o.small_numbers AND NOT coalesce(p_ack, false) THEN RETURN`, `IF false THEN RETURN`],
    ['partner self-review (P8)', `IF r.partner_id = p_actor THEN RETURN 'You submitted this protocol`, `IF false THEN RETURN 'You submitted this protocol`],
  ];
  for (const [name, from, to] of muts) { const m = base.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== base.join('')); await go(`mutant ${name}:`, m); }
}
