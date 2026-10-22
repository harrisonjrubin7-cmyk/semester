function ApprovalsScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [decided, setDecided] = React.useState(null); const [ask, setAsk] = React.useState(false);
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Approvals · ask, decide, act</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Release registration hold</h1></div><N.StatusChip status={decided ? 'approved' : 'pending'} label={decided ? 'Approved 2 of 2 — ready to act' : 'Pending · 1 of 2 approvals'} /></div>
      <div className="cols">
        <div className="stack">
          <div className="object-card">
            <div className="object-card-eyebrow">Request T-5521 · two-person duty</div>
            <N.Fields label="Request details" items={[{ field: 'Duty', value: 'Release a Finance hold before payment' }, { field: 'Tenant', value: 'nfu-prod — Northfield University' }, { field: 'Target', value: 'Student 20419311 (M. Lindqvist)' }, { field: 'Evidence', value: 'Payment plan signed Oct 6; Bursar email attached' }, { field: 'Requester', value: 'm.chen@northfield.edu' }, { field: 'Expires', value: 'Oct 9 · 17:00' }, { field: 'Correlation', value: 'req_7Hk2Q9', mono: true }]} />
            {!decided && <div className="object-card-actions"><N.Button variant="primary" onClick={() => setAsk(true)}>Approve…</N.Button><N.Button>Reject</N.Button></div>}
          </div>
          <N.Notice head="Policy">Self-approval is refused by the server, a two-person duty needs two distinct approvers, and every decision asks for a second factor verified in the last fifteen minutes.</N.Notice>
        </div>
        <aside><N.SectionLabel>Decision trail</N.SectionLabel>
          <N.DecisionTrail items={[{ title: 'Request recorded', who: 'M. Chen, Student Accounts', when: 'Oct 7 · 07:12' }, { title: 'Approved (1 of 2)', who: 'R. Alvarez, Registrar', when: 'Oct 7 · 08:02' }, decided ? { title: 'Approved (2 of 2)', who: 'You · Finance', when: 'just now' } : { title: 'Second approval', who: 'Awaiting Finance', state: 'current' }, { title: 'Hold released', state: decided ? 'current' : 'waiting' }]} />
        </aside>
      </div>
      {ask && <N.Dialog title="Approve hold release?" confirmLabel="Approve with MFA" onCancel={() => setAsk(false)} onConfirm={() => { setAsk(false); setDecided(true); }}>
        <N.ActionPreview subject="Finance hold · Student 20419311" says="The second approval is recorded. The requester can then release the hold, which lets the student register on Oct 14." doesNotChange="The balance of $1,240.00 and the payment plan stay as they are." recovery={{ kind: 'request', how: 'a Finance lead can re-apply the hold from Student Accounts.' }} subjectTo="Your decision is written to the audit log before anything changes." />
      </N.Dialog>}
    </div>
  );
}
Object.assign(window, { ApprovalsScreen });
