function TAScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [i, setI] = React.useState(0);
  const q = [{ n: 'Amara Diallo', t: 'Methods well-sourced; figure 2 lacks error bars.' }, { n: 'Ben Hartley', t: '' }, { n: 'Rui Tanaka', t: '' }];
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">Teaching assistant · BIO 210 · Lab sections 02, 04</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Grading queue</h1><p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Lab report 2 · 18 of 34 graded · scores stay drafts until Prof. Okafor releases them.</p></div><N.StatusChip status="draft" label="Drafts only — you can’t release" /></div>
      <div className="cols">
        <div className="stack">
          <div className="object-card"><div className="object-card-eyebrow">Submission {i + 1} of {q.length} · submitted Oct 1 · 22:14</div><div className="object-card-title">{q[i].n} — Lab report 2</div>
            <div style={{ height: 180, border: '1px dashed var(--border-default)', borderRadius: 4, display: 'grid', placeItems: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--type-sm)' }}>Submitted PDF preview</div>
            <N.Fields items={[{ field: 'Data & figures', value: <input className="input score nums" defaultValue={i === 0 ? '13' : ''} aria-label="Data & figures, of 15" /> }, { field: 'Methods', value: <input className="input score nums" defaultValue={i === 0 ? '9' : ''} aria-label="Methods, of 10" /> }, { field: 'Discussion', value: <input className="input score nums" aria-label="Discussion, of 10" /> }]} />
            <N.TextField multiline label="Comment to the student" defaultValue={q[i].t} />
            <div className="object-card-actions"><N.Button variant="primary" onClick={() => setI((x) => Math.min(q.length - 1, x + 1))}>Save draft and next</N.Button><N.Button variant="ghost" onClick={() => setI((x) => Math.max(0, x - 1))}>Previous</N.Button><N.SaveState status="saved" /></div></div>
        </div>
        <aside className="stack"><N.SectionLabel>Your authority</N.SectionLabel>
          <N.Fields items={[{ field: 'Can', value: 'Draft scores and comments for sections 02 and 04' }, { field: 'Cannot', value: 'Release grades, see other sections, change weights' }, { field: 'Granted by', value: 'Prof. A. Okafor · until 19 Dec 2026' }]} />
          <N.Notice head="Integrity">Similarity flags are a reason to look, not a finding. Send concerns to the instructor, not the student.</N.Notice>
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { TAScreen });
