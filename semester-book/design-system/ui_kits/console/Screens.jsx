function OverviewScreen({ go }) {
  const N = window.SemesterDesignSystem_e9f3ba;
  const m = [['Students active · 7d', '18,402', 'official'], ['Integrations healthy', '11 / 12', 'connected'], ['Approvals waiting', '3', null], ['Open support tickets', '27', null]];
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Northfield University · Tenant nfu-prod</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Operations overview</h1></div><div style={{ display: 'flex', gap: 8 }}><N.Button icon="export">Export evidence</N.Button><N.Button variant="primary" onClick={() => go('approvals')}>Review approvals</N.Button></div></div>
      <div className="grid4">{m.map(([l, v, s]) => <div className="metric" key={l}><div className="kicker">{l}</div><div className="metric-v">{v}</div>{s ? <N.SourceBadge source={s} updated="5 min ago" /> : <span style={{ fontSize: 'var(--type-xs)', color: 'var(--text-secondary)' }}>Live</span>}</div>)}</div>
      <div className="cols sec">
        <div className="stack">
          <N.SectionLabel>Needs attention</N.SectionLabel>
          <N.ObjectCard kind="Integration" statuses={['sync-error']} tone="danger" title="Housing (StarRez) sync failed 3 times" explanation="Room assignments for 2,032 students may be up to 6 hours old. Students see a stale label on Housing." metadata="Last success Oct 7 · 04:00 · error 401 Unauthorized" primary={{ label: 'Rotate credential', onClick: () => go('integrations') }} secondary={{ label: 'View log', onClick: () => go('audit') }} />
          <N.ObjectCard kind="Release" statuses={['pending']} tone="pending" title="Spring registration window — release readiness" explanation="2 of 9 checks open: accessibility sign-off and Finance hold mapping." metadata="Planned go-live Oct 14 · 07:00" primary={{ label: 'Open checklist' }} />
        </div>
        <aside><N.SectionLabel>Implementation</N.SectionLabel>
          <N.DecisionTrail items={[{ title: 'Tenant configured', when: 'Jun 2' }, { title: 'SIS + LMS connected', when: 'Jul 18' }, { title: 'Pilot: 3 colleges', when: 'Aug 25' }, { title: 'Campus-wide rollout', when: 'In progress · 78%', state: 'current' }, { title: 'Steady-state review', when: 'Dec 1', state: 'waiting' }]} />
        </aside>
      </div>
    </div>
  );
}
function IntegrationsScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const rows = [{ name: 'Banner SIS', kind: 'Student records', src: 'official', st: 'synced', n: '41,208', last: '07:55' }, { name: 'Canvas LMS', kind: 'Courses & grades', src: 'connected', st: 'syncing', n: '9,114', last: '07:58' }, { name: 'StarRez', kind: 'Housing', src: 'imported', st: 'sync-error', n: '2,032', last: '04:00' }, { name: 'TouchNet', kind: 'Billing', src: 'official', st: 'synced', n: '18,377', last: '07:30' }, { name: 'Handshake', kind: 'Career', src: 'connected', st: 'queued', n: '6,410', last: '06:00' }];
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Integrations</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Connected systems</h1></div><N.Button variant="primary" icon="plus">Add integration</N.Button></div>
      <N.DataTable caption="Integrations" columns={[{ key: 'name', label: 'System' }, { key: 'kind', label: 'Data' }, { key: 'src', label: 'Trust level', render: (r) => <N.SourceBadge source={r.src} /> }, { key: 'st', label: 'State', render: (r) => <N.StatusChip status={r.st} /> }, { key: 'n', label: 'Records', numeric: true }, { key: 'last', label: 'Last sync', numeric: true }]} rows={rows} />
      <div className="sec"><N.ErrorState title="StarRez rejected Semester’s credential" body="The service account token expired on Oct 7. Students’ housing data is now labelled stale until the next successful sync." recoverLabel="Rotate credential" secondaryLabel="Contact StarRez support" reference="INT-STR-0x41F" /></div>
    </div>
  );
}
function AuditScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const rows = [['#88214', 'Oct 7 · 08:02', 'r.alvarez', 'Approved hold release', 'student 20419311', 'two-person 1/2'], ['#88213', 'Oct 7 · 07:58', 'system', 'Sync completed', 'Canvas LMS', '—'], ['#88212', 'Oct 7 · 07:41', 'm.chen', 'Viewed student record', 'student 20410022', 'support grant T-5521'], ['#88211', 'Oct 7 · 04:00', 'system', 'Sync failed (401)', 'StarRez', 'retry 3/3'], ['#88210', 'Oct 6 · 18:12', 'k.osei', 'Changed feature flag', 'ai.tutor.econ = on', 'MFA fresh']].map(([seq, at, who, what, target, auth]) => ({ seq, at, who, what, target, auth }));
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Audit · append-only</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Audit log</h1></div><div style={{ display: 'flex', gap: 8 }}><N.Button icon="search">Filter</N.Button><N.Button icon="export">Export CSV</N.Button></div></div>
      <N.DataTable caption="Audit events" columns={[{ key: 'seq', label: 'Seq', render: (r) => <span className="mono">{r.seq}</span> }, { key: 'at', label: 'When' }, { key: 'who', label: 'Actor', render: (r) => <span className="mono">{r.who}</span> }, { key: 'what', label: 'Event' }, { key: 'target', label: 'Target' }, { key: 'auth', label: 'Authority' }]} rows={rows} />
      <p style={{ marginTop: 12, fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>Each event is written before its action runs. If the write fails, nothing happens.</p>
    </div>
  );
}
Object.assign(window, { OverviewScreen, IntegrationsScreen, AuditScreen });
