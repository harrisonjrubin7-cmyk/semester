function SettingsScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [ground, setGround] = React.useState('Match my device'); const [size, setSize] = React.useState('Normal'); const [calm, setCalm] = React.useState('device');
  const G = [['Match my device', '#f4f1ea', '#090a0e'], ['Ink', '#090a0e'], ['Graphite', '#16181c'], ['Midnight', '#080b15'], ['Parchment', '#f4f1ea'], ['Paper', '#f2f4f7'], ['Bone', '#ece9e3'], ['Fog', '#dde1e7']];
  return (
    <div className="page">
      <div className="pagehead"><div><div className="kicker">You · Settings · Appearance</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>How Semester looks</h1></div></div>
      <div className="cols">
        <div style={{ display: 'grid', gap: 28 }}>
          <section><N.SectionLabel>Ground</N.SectionLabel><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>{G.map(([n, a, b]) => <button key={n} type="button" aria-pressed={ground === n} onClick={() => setGround(n)} style={{ padding: 8, border: ground === n ? '2px solid var(--focus-color)' : '1px solid var(--border-default)', borderRadius: 6, background: 'var(--surface-raised)', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}><div style={{ height: 34, borderRadius: 3, background: b ? 'linear-gradient(135deg,' + a + ' 50%,' + b + ' 50%)' : a, border: '1px solid var(--border-subtle)' }}></div><div style={{ fontSize: 12.5, marginTop: 6 }}>{n}</div></button>)}</div></section>
          <section><N.SectionLabel>Text size</N.SectionLabel><N.Segmented label="Text size" options={['Compact', 'Normal', 'Large', 'Largest']} value={size} onChange={setSize} /><p style={{ marginTop: 10, fontSize: { Compact: 15, Normal: 16, Large: 17.4, Largest: 18.9 }[size] }}>Your lab report is due Thursday at 23:59.</p></section>
          <section><N.SectionLabel>Motion and decoration</N.SectionLabel>{[['device', 'Follow my device', 'Motion follows your system setting. Everything is drawn as designed.'], ['still', 'Less motion', 'Nothing slides, glides or sweeps, whatever your device says.'], ['calm', 'Low stimulation', 'Less motion, and less decoration: no gradients, no shadows, quieter badges.']].map(([id, l, a]) => <N.Choice key={id} name="calm" label={l} about={a} checked={calm === id} onChange={() => setCalm(id)} />)}</section>
        </div>
        <aside className="stack"><N.SectionLabel>Reading</N.SectionLabel>
          <N.Select label="Body typeface" options={['Barlow', 'System', 'Atkinson Hyperlegible', 'Georgia', 'Mono']} />
          <N.Select label="Line spacing" options={['Tight 1.35', 'Normal 1.55', 'Airy 1.75', 'Loose 1.95']} defaultValue="Normal 1.55" />
          <N.Select label="Reading width" options={['Narrow · 52 characters', 'Normal · 66', 'Wide · 82', 'Full']} defaultValue="Normal · 66" />
          <N.Switch label="Increase contrast" onChange={() => {}} /><N.Switch label="A colour per course" checked onChange={() => {}} />
          <N.Notice head="Synced">These settings follow your account to every device you sign in on.</N.Notice>
        </aside>
      </div>
    </div>
  );
}
Object.assign(window, { SettingsScreen });
