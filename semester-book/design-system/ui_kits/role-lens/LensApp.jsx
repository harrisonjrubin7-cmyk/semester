function LensApp() {
  const N = window.SemesterDesignSystem_e9f3ba, L = window.LENS, A = window.NAV_AREAS;
  const [role, setRole] = React.useState(() => localStorage.getItem('sem-lens-role') || 'guardian');
  const [view, setView] = React.useState('matrix'); const [sel, setSel] = React.useState('degree');
  const pick = (r) => { setRole(r); localStorage.setItem('sem-lens-role', r); };
  const all = A.flatMap((a) => a.screens.map(([id, label, icon]) => ({ id, label, icon, area: a })));
  const tone = { full: 'approved', scoped: 'syncing', shared: 'connected', read: 'draft', audited: 'pending', none: 'rejected' };
  const glyph = { full: '●', scoped: '◐', shared: '⇄', read: '○', audited: '!', none: '—' };
  const s = all.find((x) => x.id === sel) || all[0]; const lvl = L.access(role, s.id); const be = L.BACKEND[s.area.id];
  const counts = Object.fromEntries(L.ROLES.map(([r]) => [r, all.filter((x) => L.access(r, x.id) !== 'none').length]));
  return (
    <div className="shell">
      <N.SideRail current={role} onNavigate={pick} groups={[{ label: 'View as', items: L.ROLES.map(([id, l]) => ({ id, label: l, icon: 'person', count: counts[id] })) }]} foot={<><div style={{ color: 'var(--chrome-text)' }}>Role lens</div><div>{all.length} screens × {L.ROLES.length} roles</div></>} />
      <div className="main"><N.SystemContextBar location={'Viewing as ' + L.ROLES.find((r) => r[0] === role)[1]} term="Northfield University" sync="device-only" />
        <div className="scroll"><div className="page" style={{ maxWidth: 'none' }}>
          <div className="pagehead"><div><div className="kicker">Role lens · every screen, every role</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>What {L.ROLES.find((r) => r[0] === role)[1].toLowerCase()} sees, and the backend behind it</h1></div><N.Segmented label="View" options={[{ value: 'matrix', label: 'Matrix' }, { value: 'role', label: 'This role' }]} value={view} onChange={setView} /></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>{Object.entries(L.SAID).map(([k, v]) => <span key={k} className="status-chip" data-tone={({ full: 'success', scoped: 'official', shared: 'connected', read: 'personal', audited: 'pending', none: 'danger' })[k]} title={v}><span className="status-glyph" aria-hidden="true">{glyph[k]}</span>{k}</span>)}</div>
          {view === 'matrix' ? (
            <div className="table-wrap" role="region" aria-label="Role by screen access" tabIndex={0}><table className="table" style={{ fontSize: 12.5 }}><thead><tr><th>Screen</th><th>Area</th>{L.ROLES.map(([r, l]) => <th key={r} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 160, whiteSpace: 'nowrap', padding: '6px 4px', background: r === role ? 'var(--action-secondary)' : undefined }}>{l}</th>)}</tr></thead>
              <tbody>{all.map((x) => <tr key={x.id} style={{ background: x.id === sel ? 'var(--surface-quiet)' : undefined }}><td><button type="button" style={{ all: 'unset', cursor: 'pointer' }} onClick={() => { setSel(x.id); setView('role'); }}>{x.label}</button></td><td style={{ color: 'var(--text-secondary)' }}>{x.area.label}</td>{L.ROLES.map(([r]) => { const v = L.access(r, x.id); return <td key={r} title={L.SAID[v]} style={{ textAlign: 'center', color: v === 'none' ? 'var(--text-tertiary)' : 'var(--text-primary)', background: r === role ? 'var(--action-secondary)' : undefined }}><span aria-label={v}>{glyph[v]}</span></td>; })}</tr>)}</tbody></table></div>
          ) : (
            <div className="cols">
              <div style={{ display: 'grid', gap: 18 }}>{A.map((a) => <section key={a.id}><N.SectionLabel aside={a.screens.filter(([id]) => L.access(role, id) !== 'none').length + ' of ' + a.screens.length}>{a.label}</N.SectionLabel><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 8 }}>{a.screens.map(([id, l, ic]) => { const v = L.access(role, id); return <button key={id} type="button" className="next-step" onClick={() => setSel(id)} style={{ minHeight: 52, opacity: v === 'none' ? .45 : 1, borderStyle: v === 'none' ? 'dashed' : 'solid', outline: id === sel ? '2px solid var(--focus-color)' : 'none' }}><N.Icon name={ic} size={18} /><span className="next-step-text"><span style={{ fontSize: 14 }}>{l}</span><span className="next-step-why" style={{ fontSize: 11.5 }}>{glyph[v]} {v}</span></span></button>; })}</div></section>)}</div>
              <aside className="stack">
                <div className="object-card"><div className="object-card-eyebrow">{s.area.label} · {s.label}</div><div className="object-card-title">How it renders for this role</div><N.StatusChip status={tone[lvl]} label={L.SAID[lvl]} />
                  {lvl === 'none' ? <N.EmptyState title={s.label + ' doesn’t render'} body="The route is hidden from navigation and the server returns no rows for this role. Deep links show a permission notice." /> : <><N.ProvenanceChips origin={lvl === 'shared' ? 'personal' : 'official'} by={lvl === 'shared' ? 'Shared by the student' : 'Northfield'} cues={lvl === 'audited' ? ['action-required'] : []} age={lvl === 'read' ? 'Read-only' : undefined} />{lvl === 'shared' && <N.PermissionNotice changed="You see only what the student shared" why="Shares expire and can be revoked; every view is logged for the student." />}{lvl === 'audited' && <N.Notice head="Audited">Requires a second approver or break-glass; every record opened is written to the audit log.</N.Notice>}</>}</div>
                <div className="object-card"><div className="object-card-eyebrow">Backend</div><N.Fields items={[{ field: 'Sources', value: be.src.join(' · ') }, { field: 'Tables', value: be.tables.join(', '), mono: true }, { field: 'Row-level security', value: be.rls }, { field: 'API', value: be.api }, { field: 'Role filter', value: role === 'student' ? 'auth.uid() owns the rows' : lvl === 'shared' ? 'join shares where grantee = auth.uid() and now() < expires_at' : lvl === 'scoped' ? 'membership in section / ticket / listing' : lvl === 'audited' ? 'has_role(security) + approval or break-glass grant' : lvl === 'none' ? 'no policy grants select' : 'tenant member, select only' }]} /></div>
                <N.Notice head="Model">Design-level map from the navigation areas and role kits — not read from every migration. Verify against supabase/migrations before relying on it.</N.Notice>
              </aside>
            </div>
          )}
        </div></div></div>
    </div>
  );
}
window.__lensRoot = window.__lensRoot || ReactDOM.createRoot(document.getElementById('root'));
window.__lensRoot.render(<LensApp />);
