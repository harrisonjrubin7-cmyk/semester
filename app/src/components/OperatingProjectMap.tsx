/** Visualizes only dependencies explicitly entered by the student. */
export function OperatingProjectMap({ steps }: { steps: string }) {
  const nodes = steps.split('\n').filter(s => s.trim()).map(s => {
    const [name, owner, date, dependency, status, context, action, support] = s.split('|').map(v => v.trim());
    return { name, owner, date, dependency, status, context, action, support };
  });
  return <div>
    <svg viewBox={`0 0 480 ${Math.max(100, nodes.length * 100)}`} role="img" aria-label="Project map with student-entered dependencies" style={{ width: '100%', maxWidth: 480 }}>
      <title>Project dependencies</title>
      <desc>{nodes.map(n => `${n.name}${n.dependency ? ', depends on ' + n.dependency : ', no dependency entered'}`).join('. ')}</desc>
      {nodes.map((n,i) => {
        const parent = nodes.findIndex(p => p.name === n.dependency);
        return <g key={i}>
          {parent >= 0 && parent !== i && <path d={`M 430 ${parent * 100 + 45} L 460 ${parent * 100 + 45} L 460 ${i * 100 + 45} L 430 ${i * 100 + 45}`} fill="none" stroke="currentColor" />}
          <rect x="10" y={i * 100 + 10} width="420" height="70" rx="8" fill="var(--app-bg)" stroke="currentColor" />
          <text x="25" y={i * 100 + 38} fill="currentColor">{n.name.slice(0,45)}</text>
          <text x="25" y={i * 100 + 62} fill="currentColor">{[n.owner,n.date,n.status].filter(Boolean).join(' · ').slice(0,50)}</text>
        </g>;
      })}
    </svg>
    {nodes.map((n,i) => <details key={i}><summary>{n.name}</summary><p>Owner: {n.owner || 'Choose owner'}. Date: {n.date || 'Choose date'}. Dependency: {n.dependency || 'None entered'}. Status: {n.status || 'Not entered'}</p><p>Context: {n.context || 'Select source'}</p><p>First action: {n.action || 'Choose action'}. Support: {n.support || 'Choose support route'}</p></details>)}
  </div>;
}
