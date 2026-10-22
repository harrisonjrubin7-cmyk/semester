function SecurityScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [bg, setBg] = React.useState(false);
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Security operations</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Access and sessions</h1></div><div style={{ display: 'flex', gap: 8 }}><N.Button icon="export">Export access review</N.Button><N.Button variant="danger" onClick={() => setBg(true)}>Break-glass access…</N.Button></div></div>
      <div className="grid4">{[['Privileged sessions now', '4', null], ['MFA coverage · staff', '98.6%', 'official'], ['Access reviews due', '12', null], ['Failed sign-ins · 24h', '37', 'connected']].map(([l, v, s]) => <N.MetricTile key={l} label={l} value={v} source={s || undefined} updated={s ? '5 min ago' : undefined} />)}</div>
      <div className="cols sec">
        <div className="stack"><N.SectionLabel aside="4 live">Privileged sessions</N.SectionLabel>
          <N.DataTable caption="Sessions" columns={[{ key: 'u', label: 'Operator', render: (r) => <span className="mono">{r.u}</span> }, { key: 'g', label: 'Grant' }, { key: 'm', label: 'MFA' }, { key: 'e', label: 'Ends' }]} rows={[{ u: 'k.osei', g: 'Platform admin · nfu-prod', m: 'Fresh · 4 min', e: '12:40' }, { u: 'r.alvarez', g: 'Registrar approver', m: 'Fresh · 11 min', e: '13:05' }, { u: 'm.chen', g: 'Student accounts', m: 'Stale · 32 min', e: '12:58' }, { u: 'support.t2', g: 'Support grant T-5521', m: 'Fresh · 2 min', e: '11:30' }]} />
          <N.ErrorState title="37 failed sign-ins from one network" body="All against staff accounts; none succeeded. The network is rate-limited automatically. No student data was accessed." recoverLabel="Review the attempts" secondaryLabel="Block the network" reference="SEC-0x7A21" />
        </div>
        <aside><N.SectionLabel>Policy</N.SectionLabel><N.Fields items={[{ field: 'Session length', value: '60 min privileged · 12 h standard' }, { field: 'MFA freshness', value: '15 min for sensitive actions' }, { field: 'Break-glass', value: 'Two-person, 60 min, always audited' }, { field: 'Support access', value: 'Student-granted, ticket-scoped, expiring' }]} /></aside>
      </div>
      {bg && <N.Dialog title="Request break-glass access?" confirmLabel="Request — needs a second approver" destructive onCancel={() => setBg(false)} onConfirm={() => setBg(false)}>
        <N.ActionPreview subject="Emergency access · nfu-prod" says="You request full read access to the tenant for 60 minutes. A second security approver must agree before it starts." doesNotChange="No data is changed by this grant. Students are not notified individually." recovery={{ kind: 'undo', how: 'End the grant at any time; it ends itself after 60 minutes.' }} subjectTo="The request, approval and every record opened are written to the audit log and reported to the privacy officer." />
      </N.Dialog>}
    </div>
  );
}
Object.assign(window, { SecurityScreen });
