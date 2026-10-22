function TodayScreen({ go }) {
  const N = window.SemesterDesignSystem_e9f3ba; const d = window.studentData;
  return (
    <div className="page">
      <div className="pagehead">
        <div><div className="kicker">Today</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Tuesday, 7 October</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Three classes, one thing to begin, one hold to clear before Oct 14.</p></div>
        <N.Segmented label="Feed" options={['Cards', 'Rows', 'Timeline']} value="Cards" />
      </div>
      <div className="cols">
        <div>
          <N.SectionLabel aside="1">Begin today</N.SectionLabel>
          <N.ObjectCard kind="Assignment" statuses={['action-required']} title="Lab report 3: Enzyme kinetics" provenance={{ origin: 'official', by: 'BIO 210', age: 'Updated today' }} explanation="Worth 12% of your grade. Methods drafted; results and discussion remain." metadata="Due Thu 9 Oct · 23:59 · about 3h left by your pace" primary={{ label: 'Open draft', onClick: () => go('course') }} secondary={{ label: 'View rubric', onClick: () => go('course') }} />
          <div className="sec"><N.SectionLabel aside={d.classes.length}>Schedule</N.SectionLabel>
            {d.classes.map((c) => (
              <div className="row-item" key={c.time}><span className="nums" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 'var(--type-md)' }}>{c.time}</span><div><div style={{ fontSize: 'var(--type-md)' }}>{c.title}</div><div style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{c.where}</div></div><N.SourceBadge source={c.src} /></div>
            ))}
          </div>
          <div className="sec"><N.SectionLabel>Grade changes</N.SectionLabel>
            <div className="row-item" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}><div><div>Quiz 4 · ECON 1020</div><div style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>Posted by Prof. Haddad · yesterday</div></div><span className="nums" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 'var(--type-lg)' }}>8.5 / 10</span><N.SourceBadge source="official" /></div>
          </div>
        </div>
        <aside>
          <N.SectionLabel aside="2">Needs you</N.SectionLabel>
          <N.NextSteps steps={[{ label: 'Clear immunization hold', why: 'Blocks spring registration on Oct 14.', icon: 'registrar', aside: <N.StatusChip status="hold" /> }, { label: 'Pay fall balance · $1,240.00', why: 'Due Oct 31. A payment plan is available.', icon: 'costs' }]} />
          <div className="sec"><N.SectionLabel>Suggested</N.SectionLabel>
            <N.AIResponse scope={['Your calendar', 'BIO 210']} confidence="High" cost="Included" actions={<><N.Button size="sm" variant="primary" onClick={() => go('assistant')}>Review plan</N.Button><N.Button size="sm" variant="ghost">Not now</N.Button></>}>
              <p>You have a 90-minute gap at 11:30. Spending it on the lab report’s results section keeps Thursday realistic<span className="ai-cite">1</span>.</p>
            </N.AIResponse>
          </div>
          <div className="sec"><N.Notice head="Campus">Hensel Hall elevator out of service until Oct 9.</N.Notice></div>
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { TodayScreen });
