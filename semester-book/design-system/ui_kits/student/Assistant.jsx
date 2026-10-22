function AssistantScreen() {
  const N = window.SemesterDesignSystem_e9f3ba;
  const [stage, setStage] = React.useState('answer'); const [confirm, setConfirm] = React.useState(false);
  const [q, setQ] = React.useState(''); const [live, setLive] = React.useState([]); const [busy, setBusy] = React.useState(false);
  const CTX = 'You are Ask Semester, an AI-assisted, source-linked assistant inside a student app. Answer ONLY from this sample data; if the answer is not in it, say you can\'t see that and suggest where to look. Be brief, plain, sentence case, no exclamation marks. Cite sources as [1], [2]. Sources: [1] BIO 210 syllabus: Lab report 3 due Thu 9 Oct 23:59, worth 12%, rubric 40 pts (data & figures 15, methods 10, discussion 10, citations 5); AI allowed for outlining and feedback only. [2] Calendar: Tue 7 Oct BIO 210 lecture 09:00, gap 11:30-13:00, ECON 1020 recitation 13:00, rowing 16:00-18:00; Wed ECON 10:00, free evening; Thu BIO lecture 09:00, rowing 16:00. [3] ECON 1020: problem set 5 due Fri 10 Oct 17:00, 4%. [4] Registrar: immunization hold blocks spring registration on Oct 14; balance $1,240 due Oct 31. Student is Maya Lindqvist.';
  const ask = async () => { const t = q.trim(); if (!t || busy) return; setQ(''); setLive((l) => [...l, { who: 'you', t }]); setBusy(true); try { const r = await window.claude.complete(CTX + '\n\nQuestion: ' + t); setLive((l) => [...l, { who: 'ai', t: r }]); } catch (e) { setLive((l) => [...l, { who: 'err', t: 'Ask Semester didn’t answer. Try again in a moment.' }]); } setBusy(false); };
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="pagehead"><div><div className="kicker">Ask Semester</div><h1 style={{ fontSize: 'var(--type-xl)', marginTop: 6 }}>Plan my week around the lab report</h1></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><N.StatusChip status="beta" label="Scope: BIO 210 · Calendar · Tasks" /><N.IconButton icon="privacy" label="Data scope and privacy" /></div></div>
      <div className="stack" style={{ gap: 20 }}>
        <div style={{ justifySelf: 'end', maxWidth: '70%', padding: '12px 16px', background: 'var(--surface-quiet)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)' }}>Can you fit the rest of Lab report 3 into this week without touching rowing?<div className="v" style={{ fontSize: 'var(--type-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>You · 10:42</div></div>
        <div className="state" style={{ padding: '12px 16px' }}><N.StepStatus label="Assistant progress" steps={[{ label: 'Read BIO 210 rubric and due date', state: 'done' }, { label: 'Checked your calendar (rowing kept fixed)', state: 'done' }, { label: 'Drafted three study blocks', state: stage === 'answer' ? 'done' : 'working' }]} /></div>
        <N.AIResponse scope={['BIO 210 materials', 'Your calendar', 'Your tasks']} confidence="High for dates · moderate for time estimates" cost="1 request · 14 left this week" policy="Outlining allowed in BIO 210"
          sources={[{ title: 'BIO 210 Syllabus — Lab report 3 rubric', kind: 'official' }, { title: 'Your calendar, Oct 7–9', kind: 'personal' }, { title: 'Rowing schedule from TeamApp', kind: 'connected' }]}
          actions={<><N.Button variant="primary" icon="calendar" onClick={() => setConfirm(true)}>Add 3 blocks to calendar…</N.Button><N.Button variant="ghost">Adjust</N.Button></>}>
          <p>Yes. About <b>3 hours</b> remain by your pace on earlier reports<span className="ai-cite">1</span>. I’d place them in gaps that avoid practice<span className="ai-cite">3</span>:</p>
          <ul style={{ margin: '10px 0 0', paddingLeft: 20, lineHeight: 1.7 }} className="nums"><li>Today 11:30–13:00 — results table and figure</li><li>Wed 19:00–20:00 — discussion outline</li><li>Thu 14:00–14:30 — citations and submit</li></ul>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--type-sm)' }}>Estimates are mine, not your instructor’s. Thursday’s block leaves 9 hours of margin.</p>
        </N.AIResponse>
        {live.map((m, i) => m.who === 'you' ? <div key={i} style={{ justifySelf: 'end', maxWidth: '70%', padding: '12px 16px', background: 'var(--surface-quiet)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)' }}>{m.t}</div> : m.who === 'err' ? <N.ErrorState key={i} title="No answer" body={m.t} onRecover={() => {}} /> : <N.AIResponse key={i} scope={['BIO 210', 'ECON 1020', 'Your calendar', 'Registrar']} confidence="Sample data only" cost="1 request" policy="Outlining + feedback in BIO 210"><p style={{ whiteSpace: 'pre-wrap' }}>{m.t}</p></N.AIResponse>)}
        {busy && <div className="state"><N.StepStatus steps={[{ label: 'Reading your sample sources', state: 'done' }, { label: 'Drafting an answer', state: 'working' }]} /></div>}
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} style={{ display: 'flex', gap: 8, padding: 8, border: '1px solid var(--border-default)', borderRadius: 'var(--r-lg)', background: 'var(--surface-raised)' }}><input className="input" style={{ border: 0, background: 'none' }} placeholder="Ask about your week, BIO 210, ECON or holds…" aria-label="Ask a follow-up" value={q} onChange={(e) => setQ(e.target.value)} disabled={busy} /><N.IconButton icon="send" label="Send" type="submit" /></form>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Live demo: answers come from Claude using only the sample data above.</p>
      </div>
      {confirm && <N.Dialog title="Add 3 study blocks?" confirmLabel="Add to calendar" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); setStage('done'); }}>
        <N.ActionPreview subject="Your Semester calendar" says="Three private blocks are added on Oct 7, 8 and 9." exactly="11:30–13:00 · 19:00–20:00 · 14:00–14:30 — titled “Lab report 3”." doesNotChange="Nothing is shared. Rowing and class times are untouched." recovery={{ kind: 'undo', how: 'Remove them from Calendar any time.' }} />
      </N.Dialog>}
      {stage === 'done' && <div style={{ marginTop: 16 }}><N.SuccessState title="3 blocks added to your calendar" body="Only you can see them." nextLabel="Open today’s first block" /></div>}
    </div>
  );
}
Object.assign(window, { AssistantScreen });
