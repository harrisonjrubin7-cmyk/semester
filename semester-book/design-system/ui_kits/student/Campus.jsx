function CampusScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const halls = [['Commons Dining', 'Open · until 20:00', 'official'], ['Laird Café', 'Open · until 16:00', 'official'], ['North Market', 'Closed · opens 07:00', 'official']];
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Campus</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Northfield today</h1></div><N.Segmented label="View" options={['Now', 'This week']} value="Now" /></div>
      <div style={{ marginBottom: 20 }}><N.Notice head="Alert">Shuttle Route B is delayed about 15 minutes. Posted by Transportation, 10:05.</N.Notice></div>
      <div className="cols">
        <div className="stack">
          <N.SectionLabel aside="3">Events near you</N.SectionLabel>
          <N.ObjectCard kind="Event" title="Graduate school info session" provenance={{ origin: 'official', by: 'Career Center' }} metadata="Today · 17:30 · Laird 110 · 42 going" primary={{ label: 'RSVP' }} secondary={{ label: 'Add to calendar' }} />
          <N.ObjectCard kind="Event" title="Rowing club erg night" provenance={{ origin: 'connected', by: 'TeamApp' }} metadata="Thu · 19:00 · Boathouse" primary={{ label: 'Open in TeamApp' }} />
          <N.EmptyState title="No housing requests open" body="Maintenance and room-change requests you file appear here with their status." action={<N.Button size="sm" icon="housing">Report a housing issue</N.Button>} />
        </div>
        <aside><N.SectionLabel>Dining</N.SectionLabel>
          {halls.map(([n, s, src]) => <div className="row-item" key={n} style={{ gridTemplateColumns: '24px minmax(0,1fr) auto' }}><N.Icon name="meals" /><div><div>{n}</div><div style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{s}</div></div><N.SourceBadge source={src} /></div>)}
          <div className="row-item" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}><div><div>Meal swipes</div><div style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>Resets Sunday</div></div><span className="nums" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 'var(--type-lg)' }}>9 / 14</span></div>
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { CampusScreen });
