import { neon } from '@neondatabase/serverless';
import { CO_ROLE_STATEMENTS } from '../src/lib/coRoles';
import { MKT_MIGRATION } from '../src/lib/mktMigration';
import { MKA_MIGRATION } from '../src/lib/mkaMigration';
import { SITE_MIGRATION } from '../../semester-site/src/lib/pg';

// Marketing consent, attribution, experiments and exports (lib/mkaMigration.ts). One rolled-back transaction; synthetic rows
// use example.test addresses only. Run on app sbjuykr2qw: import { run } from './dbchecks/marketingAnalytics'; await run();
export const CHECKS = `DO $$
DECLARE x text; base int; ca text := 'zz-camp-a'; cb text := 'zz-camp-b'; na int; nb int; e1 bigint; e2 bigint; x1 bigint; h text; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  base := mka_audience();
  INSERT INTO site_inbound_requests (kind, name, email, message, consent_to_contact) VALUES
    ('Contact', 'Ann', 'zz-ann@example.test', 'Interested in a pilot next year', true),
    ('Demo request', 'Ann', 'ZZ-Ann@Example.test ', 'Second request from the same person', true),
    ('Contact', 'Bob', 'zz-bob@example.test', 'Question about pricing please', true);
  INSERT INTO rr VALUES (mka_audience() = base + 2, 'M1 the audience counts people, not requests');
  x := mka_consent('u1', false, 'zz-bob@example.test', 'withdrawn', 'contact_request', NULL);
  INSERT INTO rr VALUES (x = 'Only a marketer, marketing approver or privacy officer records consent.', 'M2 only marketing or privacy roles record consent');
  x := mka_consent('m1', true, 'zz-bob@example.test', 'withdrawn', 'contact_request', 'Asked by phone');
  INSERT INTO rr VALUES (x IS NULL AND mka_audience() = base + 1, 'M3 a withdrawal removes the person at once');
  x := mka_consent('m1', true, 'zz-bob@example.test', 'given', 'event_signup', NULL);
  INSERT INTO rr VALUES (x = 'Record where the consent came from (10+ characters).', 'M4 consent by hand needs its source');
  x := mka_consent('m1', true, 'zz-bob@example.test', 'given', 'event_signup', 'Signed up at the October fair');
  INSERT INTO rr VALUES (mka_audience() = base + 2, 'M5 consent given again counts again');
  INSERT INTO rr VALUES (NOT EXISTS (SELECT 1 FROM mka_consent_events WHERE contact_key !~ '^[0-9a-f]{32}$' OR note LIKE '%@%'), 'M6 the ledger stores no addresses');

  INSERT INTO mkt_campaigns (id, name, channel, author_id, state, approved_by) VALUES (ca, 'Fall webinar A', 'email', 'm1', 'approved', 'm2'), (cb, 'Fall webinar B', 'email', 'm1', 'approved', 'm2');
  INSERT INTO mkt_campaigns (id, name, channel, author_id) VALUES ('zz-camp-draft', 'Draft idea', 'email', 'm1');
  SELECT number INTO na FROM mkt_campaigns WHERE id = ca; SELECT number INTO nb FROM mkt_campaigns WHERE id = cb;
  x := mka_experiment('m1', false, 'start', NULL, 'Webinar subject test', 'A shorter subject line brings more demo requests.', ca, cb, 5, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only a marketing analyst runs experiments.', 'M7 only analysts run experiments');
  x := mka_experiment('an1', true, 'start', NULL, 'Webinar subject test', 'A shorter subject line brings more demo requests.', ca, 'zz-camp-draft', 5, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Both arms must be approved campaigns.', 'M8 arms are approved campaigns');
  x := mka_experiment('an1', true, 'start', NULL, 'Webinar subject test', 'A shorter subject line brings more demo requests.', ca, cb, 5, NULL, NULL); e1 := substr(x, 4)::bigint;
  INSERT INTO site_inbound_requests (kind, name, email, message, consent_to_contact, utm_campaign, utm_source)
    SELECT 'Demo request', 'Lead', 'zz-a' || g || '@example.test', 'Saw the webinar invitation', true, 'c' || na, 'newsletter' FROM generate_series(1, 6) g;
  INSERT INTO site_inbound_requests (kind, name, email, message, consent_to_contact, utm_campaign, utm_source)
    SELECT 'Demo request', 'Lead', 'zz-b' || g || '@example.test', 'Saw the webinar invitation', true, 'c' || nb, 'newsletter' FROM generate_series(1, 3) g;
  INSERT INTO rr VALUES (mka_leads(ca, now() - interval '1 hour') = 6 AND mka_leads(cb, now() - interval '1 hour') = 3, 'M9 leads attributed by campaign tag');
  x := mka_experiment('an1', true, 'decide', e1, NULL, NULL, NULL, NULL, NULL, 'a', 'A brought more demo requests');
  INSERT INTO rr VALUES (x = 'You set up this experiment, so another analyst decides it.', 'M10 the analyst who set it up does not decide');
  x := mka_experiment('an2', true, 'decide', e1, NULL, NULL, NULL, NULL, NULL, 'a', 'A brought more demo requests');
  INSERT INTO rr VALUES (x = 'Not enough data yet: 6 and 3 leads, 5 needed in each arm.', 'M11 no winner before the minimum in both arms');
  INSERT INTO site_inbound_requests (kind, name, email, message, consent_to_contact, utm_campaign) SELECT 'Contact', 'Lead', 'zz-b' || g || '@example.test', 'Second wave from the invitation', true, 'c' || nb FROM generate_series(4, 8) g;
  x := mka_experiment('an2', true, 'decide', e1, NULL, NULL, NULL, NULL, NULL, 'a', 'A brought more demo requests');
  INSERT INTO rr VALUES (x = 'The data does not support that winner (6 vs 8 leads).', 'M12 the declared winner must lead');
  x := mka_experiment('an2', true, 'decide', e1, NULL, NULL, NULL, NULL, NULL, 'b', 'B brought more demo requests over two weeks');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT decision = 'b' AND leads_a = 6 AND leads_b = 8 FROM mka_experiments WHERE id = e1), 'M13 a supported winner is recorded with its counts');

  x := mka_export('an1', true, false, 'request', NULL, 'attribution', '{"rows":[{"campaign":"c1","people":3,"contact":"zz-ann@example.test"}]}'::jsonb, 'Quarterly board pack, aggregates', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Exports carry aggregates only; this one contains an address.', 'M14 address-like content refused');
  x := mka_export('an1', true, false, 'request', NULL, 'attribution', '{"rows":[{"campaign":"c1","people":3}]}'::jsonb, 'Quarterly board pack, aggregates', NULL, NULL); x1 := substr(x, 4)::bigint;
  SELECT snapshot_hash INTO h FROM mka_exports WHERE id = x1;
  x := mka_export('an1', true, true, 'approve', x1, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x = 'You requested this export, so another approver decides it.', 'M15 no self-approval of exports');
  x := mka_export('an1', true, false, 'download', x1, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'This export is not approved.', 'M16 nothing downloads before approval');
  x := mka_export('ap1', false, true, 'approve', x1, NULL, NULL, NULL, h, NULL);
  x := mka_export('ap1', false, true, 'download', x1, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only the person who requested an export downloads it.', 'M17 only the requester downloads');
  x := mka_export('an1', true, false, 'download', x1, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT downloads FROM mka_exports WHERE id = x1) = 1, 'M18 the approved export downloads and is counted');
  UPDATE mka_exports SET decided_at = now() - interval '8 days' WHERE id = x1;
  x := mka_export('an1', true, false, 'download', x1, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'This export expired. Request a fresh one.', 'M19 exports expire after 7 days');

  got := false; BEGIN INSERT INTO mka_exports (report, snapshot, snapshot_hash, purpose, requested_by) VALUES ('funnel', '{"x":"someone@example.test"}', 'h', 'Direct insert attempt here', 'an1'); EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'M20 the table itself refuses addresses in exports');
  got := false; BEGIN UPDATE mka_experiments SET decided_by = created_by WHERE id = e1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'M21 the table refuses self-decided experiments');
  got := false; BEGIN DELETE FROM mka_consent_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'M22 the consent ledger is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run(only?: string) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...CO_ROLE_STATEMENTS, ...SITE_MIGRATION, ...MKT_MIGRATION, ...MKA_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', base);
  const muts: [string, string, string][] = [
    ['withdrawal ignored (M3)', `FROM site_inbound_requests WHERE consent_to_contact AND NOT mka_withdrawn(mka_key(email)) $$`, `FROM site_inbound_requests WHERE consent_to_contact $$`],
    ['requests not people (M1)', `SELECT count(DISTINCT lower(trim(email)))::int FROM site_inbound_requests`, `SELECT count(*)::int FROM site_inbound_requests`],
    ['winner before minimum (M11)', `IF la < e.min_per_arm OR lb < e.min_per_arm THEN RETURN`, `IF false THEN RETURN`],
    ['unsupported winner (M12)', `IF (p_decision = 'a' AND la <= lb) OR (p_decision = 'b' AND lb <= la) THEN RETURN`, `IF false THEN RETURN`],
    ['download before approval (M16)', `IF x.state <> 'approved' THEN RETURN 'This export is not approved.'`, `IF false THEN RETURN 'This export is not approved.'`],
    ['no expiry (M19)', `IF x.decided_at < now() - interval '7 days' THEN RETURN`, `IF false THEN RETURN`],
  ];
  for (const [name, from, to] of muts.filter(([n]) => !only || n.includes(only))) { const m = base.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== base.join('')); await go(`mutant ${name}:`, m); }
}
