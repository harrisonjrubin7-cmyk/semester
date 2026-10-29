import { neon } from '@neondatabase/serverless';
import { CO_ROLE_STATEMENTS } from '../src/lib/coRoles';
import { MKT_MIGRATION } from '../src/lib/mktMigration';
import { MKA_MIGRATION } from '../src/lib/mkaMigration';
import { SITE_MIGRATION } from '../../semester-site/src/lib/pg';

// Marketing Admin audiences, templates and channels (mkt-003). One rolled-back transaction: role rows, example.test contacts,
// segments, templates and channel changes exist only inside it. Nothing here sends: every channel's sending is CHECK 'disabled'.
// Run on app sbjuykr2qw: import { run } from './dbchecks/marketingAdmin'; await run();
export const CHECKS = `DO $$
DECLARE r jsonb; t text; g text; g2 text; tp text; tp2 text; v_id text; v int; h text; h2 text; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO co_roles (tenant_id, user_id, role, granted_by) VALUES ('semester-company', 'zz_mk1', 'marketer', 'dbcheck'),
    ('semester-company', 'zz_ap1', 'marketing_approver', 'dbcheck'),
    ('semester-company', 'zz_both', 'marketer', 'dbcheck'), ('semester-company', 'zz_both', 'marketing_approver', 'dbcheck');
  INSERT INTO site_inbound_requests (kind, name, email, role, message, consent_to_contact, utm_source) VALUES
    ('Pilot request', 'A', 'a@example.test', 'Associate Dean', 'Interested', true, 'zzcheck'),
    ('Pilot request', 'A', 'A@example.test ', 'Associate Dean', 'Again', true, 'zzcheck'),
    ('Pilot request', 'B', 'b@example.test', 'Faculty', 'Interested', true, 'zzcheck'),
    ('Pilot request', 'C', 'c@example.test', 'Dean', 'No consent', false, 'zzcheck'),
    ('Contact', 'D', 'd@example.test', 'Dean', 'Other kind', true, 'zzcheck'),
    ('Pilot request', 'E', 'e@example.test', 'Dean of students', 'Will withdraw', true, 'zzcheck');

  -- Audience segments
  t := mkt_admin('zz_ap1', 'segment_create', '{"name":"Deans asking for pilots","kinds":["Pilot request"],"roleTerms":["dean"],"utmSource":"zzcheck"}');
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'A1 segments need the marketer role');
  t := mkt_admin('zz_mk1', 'segment_create', '{"name":"Bad","kinds":["Student records"]}');
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'A2 only site request kinds can define a segment ' || t);
  t := mkt_admin('zz_mk1', 'segment_create', '{"name":"Deans asking for pilots","kinds":["Pilot request"],"roleTerms":["dean"],"utmSource":"zzcheck"}');
  g := substr(t, 4);
  INSERT INTO rr VALUES (mkt_segment_size(g) = 2, 'A3 segment counts distinct consented people matching kind, role and tag (got ' || mkt_segment_size(g) || ')');
  INSERT INTO mka_consent_events (contact_key, kind, source, note, recorded_by) VALUES (mka_key('e@example.test'), 'withdrawn', 'other', '', 'dbcheck');
  INSERT INTO rr VALUES (mkt_segment_size(g) = 1, 'A4 a withdrawal leaves the segment');
  INSERT INTO rr VALUES (mkt_segment_size(NULL) = mka_audience(), 'A5 no segment means everyone who consented');
  got := false; BEGIN UPDATE mkt_segments SET role_terms = '{}' WHERE id = g; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'A6 a segment definition cannot be changed');

  -- Templates
  t := mkt_admin('zz_ap1', 'template_create', '{"name":"Open house","channel":"email","subject":"Visit us","body":"Join us for an open house and meet the team in person. {{unsubscribe}}"}');
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'T1 templates need the marketer role');
  t := mkt_admin('zz_mk1', 'template_create', '{"name":"Results","channel":"email","subject":"Pilot results","body":"Students finished 30% more work on time with the new planner. {{unsubscribe}}"}');
  tp2 := substr(t, 4);
  t := mkt_admin('zz_ap1', 'template_approve', jsonb_build_object('templateId', tp2, 'seenBody', (SELECT md5(subject || '|' || body) FROM mkt_templates WHERE id = tp2)));
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'T2 a template cannot carry claim wording ' || t);
  t := mkt_admin('zz_mk1', 'template_create', '{"name":"Open house","channel":"email","subject":"Visit us","body":"Join us for an open house and meet the team in person. {{unsubscribe}}"}');
  tp := substr(t, 4);
  t := mkt_admin('zz_mk1', 'template_approve', jsonb_build_object('templateId', tp, 'seenBody', (SELECT md5(subject || '|' || body) FROM mkt_templates WHERE id = tp)));
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'T3 approval needs the approver role');
  t := mkt_admin('zz_ap1', 'template_approve', jsonb_build_object('templateId', tp, 'seenBody', 'stale'));
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'T4 approval is bound to the text the reviewer saw');
  t := mkt_admin('zz_ap1', 'template_approve', jsonb_build_object('templateId', tp, 'seenBody', (SELECT md5(subject || '|' || body) FROM mkt_templates WHERE id = tp)));
  INSERT INTO rr VALUES (t LIKE 'ok:%' AND (SELECT state FROM mkt_templates WHERE id = tp) = 'approved', 'T5 a different person approves ' || t);
  got := false; BEGIN UPDATE mkt_templates SET approved_by = author_id WHERE id = tp; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'T6 the table refuses self-approved templates');
  t := mkt_admin('zz_both', 'template_create', '{"name":"Own template","channel":"event","subject":"Campus tour","body":"Come on a guided campus tour with current students and staff."}');
  t := mkt_admin('zz_both', 'template_approve', jsonb_build_object('templateId', substr(t, 4), 'seenBody', (SELECT md5(subject || '|' || body) FROM mkt_templates WHERE id = substr(t, 4))));
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'T7 holding both roles still cannot approve your own template');

  -- Campaign from a template, with a segment
  r := mkt_cmd('zz_mk1', 'm1', 'hm1', 'create', NULL, jsonb_build_object('name', 'Spring open house', 'channel', 'social', 'templateId', tp));
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'C1 a template only starts a campaign on its own channel');
  r := mkt_cmd('zz_mk1', 'm2', 'hm2', 'create', NULL, jsonb_build_object('name', 'Spring open house', 'channel', 'email', 'templateId', tp2));
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'C2 an unapproved template cannot be used');
  r := mkt_cmd('zz_mk1', 'm3', 'hm3', 'create', NULL, jsonb_build_object('name', 'Spring open house', 'channel', 'email', 'templateId', tp));
  v_id := r->>'id';
  INSERT INTO rr VALUES ((SELECT template_id = tp AND body LIKE 'Join us%' AND state = 'draft' FROM mkt_campaigns WHERE id = v_id), 'C3 the campaign starts as a draft copy of the template');
  SELECT mkt_hash(c) INTO h FROM mkt_campaigns c WHERE id = v_id;
  r := mkt_cmd('zz_mk1', 'm4', 'hm4', 'edit', v_id, jsonb_build_object('version', 1, 'segmentId', g));
  SELECT mkt_hash(c) INTO h2 FROM mkt_campaigns c WHERE id = v_id;
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND h <> h2, 'C4 choosing a segment changes what the approver signs');
  r := mkt_cmd('zz_mk1', 'm5', 'hm5', 'edit', v_id, jsonb_build_object('version', 2, 'segmentId', 'seg_nope'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'C5 only an active segment can be chosen');

  -- Channels
  t := mkt_admin('zz_mk1', 'channel_set', '{"channel":"email","version":1,"status":"paused","note":"Pausing for review"}');
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'H1 channel settings need the approver role');
  v := (SELECT version FROM mkt_channels WHERE channel = 'email');
  t := mkt_admin('zz_ap1', 'channel_set', jsonb_build_object('channel', 'email', 'version', v + 7, 'status', 'paused', 'note', 'Pausing for review'));
  INSERT INTO rr VALUES (t NOT LIKE 'ok:%', 'H2 stale channel settings refused');
  t := mkt_admin('zz_ap1', 'channel_set', jsonb_build_object('channel', 'email', 'version', v, 'status', 'paused', 'senderLabel', '', 'note', 'Pausing for review'));
  INSERT INTO rr VALUES (t LIKE 'ok:%' AND NOT mkt_channel_open('email'), 'H3 approver pauses email ' || t);
  r := mkt_cmd('zz_mk1', 'm6', 'hm6', 'create', NULL, '{"name":"Another email","channel":"email"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'CHANNEL_PAUSED', 'H4 no new campaigns on a paused channel');
  r := mkt_cmd('zz_mk1', 'm7', 'hm7', 'submit', v_id, jsonb_build_object('version', 2, 'audienceSize', mkt_segment_size(g)));
  INSERT INTO rr VALUES (r->>'resultCode' = 'CHANNEL_PAUSED', 'H5 no submission on a paused channel');
  t := mkt_admin('zz_ap1', 'channel_set', jsonb_build_object('channel', 'email', 'version', v + 1, 'status', 'open', 'note', 'Reopened after review'));
  r := mkt_cmd('zz_mk1', 'm8', 'hm8', 'submit', v_id, jsonb_build_object('version', 2, 'audienceSize', mkt_segment_size(g)));
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT audience_size FROM mkt_campaigns WHERE id = v_id) = 1, 'H6 submitted with the segment snapshot ' || coalesce(r->>'message', ''));
  SELECT mkt_hash(c), c.version INTO h, v FROM mkt_campaigns c WHERE id = v_id;
  r := mkt_cmd('zz_ap1', 'm9', 'hm9', 'approve', v_id, jsonb_build_object('version', v, 'seenHash', h, 'a11yReviewed', true));
  SELECT version INTO v FROM mkt_campaigns WHERE id = v_id;
  r := mkt_cmd('zz_ap1', 'm10', 'hm10', 'launch_check', v_id, jsonb_build_object('version', v, 'audienceNow', 1));
  INSERT INTO rr VALUES (r->>'message' LIKE '%No email sender name is set.%', 'H7 launch is blocked until email has a sender name ' || coalesce(r->>'message', ''));
  t := mkt_admin('zz_ap1', 'channel_set', jsonb_build_object('channel', 'email', 'version', (SELECT version FROM mkt_channels WHERE channel = 'email'), 'senderLabel', 'Semester team', 'note', 'Set the sender name'));
  r := mkt_cmd('zz_ap1', 'm11', 'hm11', 'launch_check', v_id, jsonb_build_object('version', v, 'audienceNow', 1));
  INSERT INTO rr VALUES (r->>'message' LIKE 'Every launch check passes%', 'H8 then the gate passes; nothing is sent ' || coalesce(r->>'message', ''));
  got := false; BEGIN UPDATE mkt_channels SET sending = 'enabled' WHERE channel = 'email'; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'H9 no channel can enable sending');
  t := mkt_admin('zz_mk1', 'segment_retire', jsonb_build_object('segmentId', g));
  r := mkt_cmd('zz_ap1', 'm12', 'hm12', 'launch_check', v_id, jsonb_build_object('version', v, 'audienceNow', 1));
  INSERT INTO rr VALUES (r->>'message' LIKE '%segment was retired%', 'H10 a retired segment blocks launch');
  got := false; BEGIN UPDATE mkt_segments SET state = 'active' WHERE id = g; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'H11 a retired segment stays retired');
  got := false; BEGIN DELETE FROM mkt_admin_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'H12 admin history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run(only?: string) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...CO_ROLE_STATEMENTS, ...SITE_MIGRATION, ...MKT_MIGRATION, ...MKA_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 1200)); } };
  const mutants: [string, string, string][] = [
    ['withdrawals ignored (A4)', `WHERE r.consent_to_contact AND NOT mka_withdrawn(mka_key(r.email))`, `WHERE r.consent_to_contact`],
    ['paused channel submits (H5)', `      ELSIF NOT mkt_channel_open(m.channel) THEN v_code := 'CHANNEL_PAUSED'; v_msg := 'The ' || m.channel || ' channel is paused.';\n      ELSIF m.segment_id IS NOT NULL`, `      ELSIF m.segment_id IS NOT NULL`],
    ['self-approved template (T7; the table constraint is the backstop)', `IF p_actor = t.author_id THEN RETURN 'You wrote this template`, `IF false THEN RETURN 'You wrote this template`],
    ['hash ignores segment (C4)', `c.spend_minor, c.segment_id,`, `c.spend_minor,`],
  ];
  if (!only || only === 'real') await go('real:', base);
  for (const [label, from, to] of mutants) {
    if (only && only !== 'mutants' && !label.startsWith(only)) continue;
    const m = base.map((q) => q.replace(from, () => to));
    console.log(label, 'applied:', m.join('') !== base.join(''));
    await go('mutant ' + label + ':', m);
  }
}
