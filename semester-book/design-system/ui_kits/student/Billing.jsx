function BillingScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [pay, setPay] = React.useState(false); const [paid, setPaid] = React.useState(false);
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Billing · Fall 2026</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Your account</h1></div><N.SourceBadge source="official" by="Bursar via TouchNet" updated="Updated 07:30" /></div>
      <div className="cols">
        <div className="stack">
          <div style={{ padding: 20, border: '1px solid var(--border-default)', borderRadius: 6, background: 'var(--surface-base)', display: 'grid', gap: 8 }}>
            <div className="kicker">Balance due Fri 31 Oct</div>
            <div className="nums" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 40, lineHeight: 1 }}>{paid ? '$0.00' : '$1,240.00'}</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--type-sm)' }}>{paid ? 'Payment received. The Bursar confirms within one business day.' : 'After financial aid of $14,200.00 and a $2,500.00 scholarship.'}</p>
            {!paid && <div className="object-card-actions"><N.Button variant="primary" onClick={() => setPay(true)}>Pay $1,240.00…</N.Button><N.Button>Set up a payment plan</N.Button></div>}
          </div>
          <N.DataTable caption="Charges and credits" columns={[{ key: 'd', label: 'Date' }, { key: 'w', label: 'Item' }, { key: 'a', label: 'Amount', numeric: true }]} rows={[{ d: 'Aug 1', w: 'Tuition — full time', a: '$16,850.00' }, { d: 'Aug 1', w: 'Lab fee · BIO 210', a: '$90.00' }, { d: 'Aug 20', w: 'Federal Pell Grant', a: '−$3,700.00' }, { d: 'Aug 20', w: 'Institutional grant', a: '−$10,500.00' }, { d: 'Sep 2', w: 'Dean’s scholarship', a: '−$2,500.00' }]} />
        </div>
        <aside className="stack"><N.SectionLabel>Holds</N.SectionLabel>
          <N.ObjectCard kind="Hold" statuses={['hold']} tone="danger" title="Immunization record missing" provenance={{ origin: 'official', by: 'Student Health' }} explanation="Blocks spring registration from Oct 14. Upload your MMR record or book a clinic visit." primary={{ label: 'Upload record' }} secondary={{ label: 'Contact Student Health' }} />
          <N.PermissionNotice changed="Jonas Lindqvist can see billing milestones" why="Due dates and payment confirmations only — not line items or aid." controlLabel="Manage family sharing" />
        </aside>
      </div>
      {pay && <N.Dialog title="Pay $1,240.00?" confirmLabel="Pay $1,240.00" onCancel={() => setPay(false)} onConfirm={() => { setPay(false); setPaid(true); }}>
        <N.ActionPreview subject="Fall 2026 balance · Northfield University" says="$1,240.00 is paid from Checking ••4417 through TouchNet, the Bursar’s payment system." doesNotChange="Your aid and scholarship are unaffected." recovery={{ kind: 'request', how: 'refunds go through the Bursar and take 5–7 business days.' }} subjectTo="Semester does not process the payment; TouchNet does." />
      </N.Dialog>}
    </div>
  );
}
Object.assign(window, { BillingScreen });
