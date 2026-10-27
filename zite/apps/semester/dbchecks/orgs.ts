import { neon } from '@neondatabase/serverless';
import { ORG_MIGRATION } from '../src/lib/orgMigration';

const C = 'Article I. Name. Article II. Purpose: robotics outreach. Article III. Officers are elected each spring.';
export const CHECKS = `DO $$
DECLARE r text; x text; h text; v int; ch bigint; ch2 bigint; ln bigint; ex1 bigint; ex2 bigint; el bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO rr VALUES (org_set_admin('adm','t1','adm',true) IS NOT NULL, 'F1 no self-grant');
  PERFORM org_set_admin('adm','t1','sl',true); PERFORM org_set_admin('adm','t1','sl2',true);
  INSERT INTO rr VALUES (org_submit_charter('out','t1','g1','Robotics outreach club','${C}',false) = 'Only members submit the charter.', 'F2 only members submit');
  PERFORM org_submit_charter('m1','t1','g1','Robotics outreach club','${C}',true);
  SELECT sha256, version INTO h, v FROM org_charters WHERE group_id = 'g1';
  INSERT INTO rr VALUES (org_charter_decide('m1','t1','g1','recognize',h,current_date+365,'',v) LIKE 'Only an organization admin%', 'F3 only org admins recognize');
  INSERT INTO rr VALUES (org_charter_decide('sl','t1','g1','recognize',repeat('0',64),current_date+365,'',v) LIKE 'The charter you read%', 'F4 recognition pinned to the exact charter');
  PERFORM org_charter_decide('sl','t1','g1','recognize',h,current_date+365,'',v);
  INSERT INTO rr VALUES (org_active('g1'), 'F5 recognized and active');
  -- roles
  INSERT INTO rr VALUES (org_set_role('m1','t1','g1','m1','president',true,NULL,true) LIKE 'Someone else changes%', 'F6 no self-appointment');
  INSERT INTO rr VALUES (org_set_role('m2','t1','g1','m1','president',true,NULL,true) LIKE 'The president is set by%', 'F7 members cannot install a president');
  PERFORM org_set_role('sl','t1','g1','m1','president',true,NULL,true);
  INSERT INTO rr VALUES (org_set_role('m1','t1','g1','m3','treasurer',true,NULL,false) = 'Officers are members of the organization.', 'F8 officers must be members');
  PERFORM org_set_role('m1','t1','g1','m2','treasurer',true,NULL,true); PERFORM org_set_role('m1','t1','g1','m4','officer',true,NULL,true);
  -- channels
  PERFORM org_channel('m1','t1','g1','general',false); PERFORM org_channel('m1','t1','g1','officers',true);
  SELECT id INTO ch FROM org_channels WHERE group_id = 'g1' AND name = 'general'; SELECT id INTO ch2 FROM org_channels WHERE group_id = 'g1' AND name = 'officers';
  INSERT INTO rr VALUES (org_post('m5',ch,'Hello all',true) IS NULL AND org_post('m5',ch2,'Hi officers',true) = 'This channel is for officers.' AND org_post('out',ch,'spam',false) LIKE 'Join the organization%', 'F9 channel access');
  -- RSVPs
  PERFORM org_event_rules('m4','t1','g1','ev1',1,true);
  INSERT INTO rr VALUES (org_rsvp('out','ev1','g1','going',false) = 'This event is for members.', 'F10 members-only events');
  PERFORM org_rsvp('m5','ev1','g1','going',true);
  INSERT INTO rr VALUES (org_rsvp('m6','ev1','g1','going',true) = 'This event is full.' AND org_rsvp('m6','ev1','g1','maybe',true) IS NULL, 'F11 capacity');
  -- dues
  INSERT INTO rr VALUES (org_dues('m1','t1','g1','m5','Fall 2026',2000,'recorded_paid','R-1') = 'Only the treasurer records dues.', 'F12 only treasurer records dues');
  INSERT INTO rr VALUES (org_dues('m2','t1','g1','m2','Fall 2026',2000,'recorded_paid','R-2') LIKE 'Someone other than the treasurer%', 'F13 treasurer cannot record own dues');
  INSERT INTO rr VALUES (org_dues('m2','t1','g1','m5','Fall 2026',2000,'recorded_paid','') LIKE 'Record the receipt reference%', 'F14 dues need an external receipt reference');
  PERFORM org_dues('m2','t1','g1','m5','Fall 2026',2000,'recorded_paid','R-1');
  -- budget and expenses
  INSERT INTO rr VALUES (org_budget('m1','t1','g1','Fall 2026','Events',50000) LIKE 'Only an organization admin%', 'F15 officers cannot allocate budget');
  PERFORM org_budget('sl','t1','g1','Fall 2026','Events',50000);
  SELECT id INTO ln FROM org_budget_lines WHERE group_id = 'g1';
  r := org_expense('m4','t1',ln,40000,'Competition registration'); ex1 := split_part(r,':',2)::bigint;
  r := org_expense('m2','t1',ln,20000,'Pizza for build night'); ex2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (org_expense_decide('m2','t1',ex2,true,'') LIKE 'Someone other than the requester%', 'F16 treasurer cannot approve own spending');
  PERFORM org_expense_decide('m2','t1',ex1,true,'');
  PERFORM org_set_role('m1','t1','g1','m7','treasurer',true,NULL,true);
  INSERT INTO rr VALUES (org_expense_decide('m7','t1',ex2,true,'') LIKE 'This would overspend%', 'F17 spending stays within the line');
  -- election, secret ballot, succession
  r := org_election_open('sl','t1','g1','president',now()+interval '1 day'); el := split_part(r,':',2)::bigint;
  PERFORM org_candidate('m4',el,'Build more robots',true); PERFORM org_candidate('m5',el,'More outreach',true);
  INSERT INTO rr VALUES (org_vote('out',el,'m4',false) = 'Only members vote.', 'F18 members vote');
  PERFORM org_vote('m1',el,'m4',true); PERFORM org_vote('m2',el,'m4',true); PERFORM org_vote('m6',el,'m5',true);
  INSERT INTO rr VALUES (org_vote('m1',el,'m5',true) = 'You have already voted.', 'F19 one vote each');
  INSERT INTO rr VALUES (NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org_ballots' AND column_name IN ('voter_id','user_id')), 'F20 ballots carry no voter');
  INSERT INTO rr VALUES (org_certify('sl','t1',el,'') = 'Voting is still open.', 'F21 no certification before close');
  UPDATE org_elections SET closes_at = now() - interval '1 minute' WHERE id = el;
  x := org_certify('sl','t1',el,'');
  INSERT INTO rr VALUES (x IS NULL AND org_role_of('g1','m4','president') AND NOT org_role_of('g1','m1','president'), 'F22 certified winner becomes president');
  INSERT INTO rr VALUES (org_handover('m1','t1','g1','president','m4','Keys with advisor; bank login via treasurer; spring fair May 3') IS NULL, 'F23 outgoing president records handover');
  -- suspension and archive
  SELECT version INTO v FROM org_charters WHERE group_id = 'g1';
  PERFORM org_charter_decide('sl2','t1','g1','suspend',NULL,NULL,'Missed safety training',v);
  INSERT INTO rr VALUES (org_post('m5',ch,'Still here?',true) LIKE 'The organization is not currently recognized%', 'F24 suspension pauses activity');
  SELECT version INTO v FROM org_charters WHERE group_id = 'g1';
  PERFORM org_charter_decide('sl2','t1','g1','archive',NULL,NULL,'Club dissolved by vote',v);
  INSERT INTO rr VALUES ((SELECT count(*) = 0 FROM org_roles WHERE group_id = 'g1' AND ended_at IS NULL) AND (SELECT count(*) > 0 FROM org_posts) AND (SELECT count(*) = 3 FROM org_ballots WHERE election_id = el), 'F25 archive ends roles, keeps records');
  got := false; BEGIN DELETE FROM org_ballots; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F26 ballots append-only');
  got := false; BEGIN UPDATE org_charters SET state = 'recognized', recognized_by = submitted_by WHERE group_id = 'g1'; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F27 table refuses self-recognition');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...ORG_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('org_charters') AS t`)));
}
