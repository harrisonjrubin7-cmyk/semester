function FinanceScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Finance · Student accounts</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Maya Lindqvist · 20419311</h1></div><div style={{ display: 'flex', gap: 8 }}><N.Button>Record a payment</N.Button><N.Button variant="primary">Offer payment plan…</N.Button></div></div>
      <div className="cols">
        <div className="stack">
          <N.Fields items={[{ field: 'Balance', value: '$1,240.00 due 31 Oct' }, { field: 'Aid applied', value: '$14,200.00 · Financial Aid Office' }, { field: 'Holds', value: 'None from Finance' }, { field: 'Source', value: 'TouchNet · synced 07:30' }]} />
          <N.SectionLabel>Ledger</N.SectionLabel>
          <N.DataTable caption="Ledger" columns={[{ key: 'd', label: 'Date' }, { key: 'w', label: 'Entry' }, { key: 'b', label: 'By' }, { key: 'a', label: 'Amount', numeric: true }]} rows={[{ d: 'Aug 1', w: 'Tuition — full time', b: 'system', a: '$16,850.00' }, { d: 'Aug 1', w: 'Lab fee · BIO 210', b: 'system', a: '$90.00' }, { d: 'Aug 20', w: 'Aid disbursement', b: 'Financial Aid', a: '−$14,200.00' }, { d: 'Sep 2', w: 'Dean’s scholarship', b: 'Provost', a: '−$2,500.00' }]} />
        </div>
        <aside className="stack"><N.SectionLabel aside="1">Waiting for a second approver</N.SectionLabel>
          <N.ObjectCard kind="Request" statuses={['pending']} tone="pending" title="Waive late fee · $50.00" explanation="Requested by M. Chen. Two-person duty: a second Finance approver is needed, and it can’t be the requester." metadata="Expires Oct 9 · 17:00" primary={{ label: 'Review…' }} />
          <N.Notice head="Scope">You see this account because you hold Student Accounts at nfu-prod. Every view is logged.</N.Notice>
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { FinanceScreen });
