function SupportQueueScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Support queue · tier 2</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>T-5531 · “My deadlines disappeared”</h1></div><N.StatusChip status="pending" label="Waiting on us · 2h 10m" /></div>
      <div className="cols">
        <div className="stack">
          <div className="object-card"><div className="object-card-eyebrow">Student · Oct 7 · 09:02</div><p style={{ fontSize: 'var(--type-base)' }}>“All my ECON deadlines are gone from Today since this morning.”</p></div>
          <N.Notice head="Diagnosis">Canvas feed for ECON 1020 returned 0 items at 06:00. Other courses synced normally. Likely cause: the course was re-published under a new id.</N.Notice>
          <N.TextField multiline label="Reply to the student" defaultValue={'Your ECON 1020 calendar hasn’t updated since 06:00 because the course moved in Canvas. Deadlines on Today may be missing. Reconnect ECON 1020 from Connect, or check the course page until it’s fixed — we’ll tell you when it is.'} />
          <div className="object-card-actions"><N.Button variant="primary" icon="send">Send reply</N.Button><N.Button>Escalate to Integrations</N.Button></div>
        </div>
        <aside className="stack"><N.SectionLabel>Your access</N.SectionLabel>
          <N.PermissionNotice changed="The student granted support access for this ticket" why="Read-only: Connect settings and sync log for ECON 1020. Ends Oct 8 · 09:02, or when the ticket closes." controlLabel="View the grant" />
          <N.Fields items={[{ field: 'Can see', value: 'Sync log, connection settings' }, { field: 'Cannot see', value: 'Grades, messages, notes, billing' }, { field: 'Ticket', value: 'T-5531', mono: true }]} />
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { SupportQueueScreen });
