function CommunityScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const posts = [['Rui Tanaka', 'BIO 210 · Study group', 'Anyone want to review Km/Vmax before Thursday? Laird 3rd floor, 18:00.', '12 min', 4], ['Rowing club', 'Activities', 'Erg night moved to Thursday 19:00.', '1 h', 11], ['Anonymous', 'Housing · North Hall', 'Laundry room B has been out for 3 days — reported?', '3 h', 7]];
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Campus · Community</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Northfield community</h1></div><N.Button variant="primary" icon="write">Post</N.Button></div>
      <div className="cols">
        <div className="stack">{posts.map(([a, c, t, w, n]) => <article key={t} className="object-card"><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><N.Avatar name={a === 'Anonymous' ? '' : a} size={30} /><div><div style={{ fontSize: 14, fontWeight: 600 }}>{a}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c} · {w}</div></div></div><p style={{ fontSize: 'var(--type-base)' }}>{t}</p><div className="object-card-actions"><button className="link-quiet">Reply · {n}</button><button className="link-quiet">Report</button></div></article>)}</div>
        <aside className="stack"><N.SectionLabel>Guidelines</N.SectionLabel><N.Notice head="Five lines">Be kind. No harassment or doxxing. No selling grades or work. Anonymous isn’t untraceable to moderators. Report anything unsafe.</N.Notice><N.Fields items={[{ field: 'Your posts show', value: 'Your name and class year' }, { field: 'Moderation', value: 'Student moderators + Student Affairs' }]} /></aside>
      </div>
    </div>
  );
}
Object.assign(window, { CommunityScreen });
