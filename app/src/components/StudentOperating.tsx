import { OperatingProjectMap } from './OperatingProjectMap';
import { dateToIso } from '../lib/date';
import { useState } from 'react';
import { zipSync, strToU8 } from 'fflate';
import { useNow, useStore } from '../state/store';
import { activeManual, critic, defaultManual, emptyEntry, exportOperating, operatingCsv, operatingIcs, operatingMarkdown, PLAYBOOKS, readOperating, visibleEntries } from '../lib/student-operating';
import type { EntryKind, Manual, OperatingEntry, OperatingWorkspace, Structure } from '../lib/student-operating';
import { ActionButton, SectionLabel } from './ui';
import { ConfirmDialog } from './ConfirmDialog';
import { ActionPreview } from './unity/ActionPreview';

const labels: Record<EntryKind, string> = { plan: 'Daily plan', decision: 'Decision journal', waiting: 'Waiting on', meeting: 'Meeting to action', project: 'Project map', evidence: 'Study evidence', playbook: 'Reusable playbook', group: 'Group charter', service: 'Service packet' };
function download(name: string, content: string | Uint8Array, mime: string) {
  const data = typeof content === 'string' ? content : new Uint8Array(content).buffer;
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function StudentOperating() {
  const now = useNow();
  const { state, dispatch } = useStore();
  const workspace = readOperating(state.operatingWorkspace);
  const today = dateToIso(now);
  const [temporary, setTemporary] = useState<Manual | null>(null);
  const manual = temporary ?? activeManual(workspace.manual, today);
  const [editingManual, setEditingManual] = useState<Manual>(() => manual ?? defaultManual());
  const [structure, setStructure] = useState<Structure>('none');
  const [hidePrompt, setHidePrompt] = useState(false);
  const [entry, setEntry] = useState<OperatingEntry>(() => emptyEntry('plan'));
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState<OperatingEntry | null>(null);
  const [packetPreview, setPacketPreview] = useState(false);
  const [draft, setDraft] = useState('');
  const [recipient, setRecipient] = useState('');
  const [deletePending, setDeletePending] = useState(false);
  const [calendarStart, setCalendarStart] = useState('');
  const [calendarReviewed, setCalendarReviewed] = useState('');
  const save = (next: OperatingWorkspace) => dispatch({ type: 'setOperatingWorkspace', value: JSON.stringify(next) });
  const patch = (key: keyof OperatingEntry, value: string) => setEntry(e => ({ ...e, [key]: value }));
  const mode = structure === 'none' ? manual?.style === 'simple' ? 'low' : manual?.style === 'daily' ? 'medium' : 'none' : structure;
  const shown = visibleEntries(workspace.entries, mode);
  const firstMinutes = mode === 'low' ? 2 : mode === 'medium' ? Math.min(25, Math.max(10, manual?.minutes ?? 10)) : manual?.minutes ?? 10;
  const fields: { key: keyof OperatingEntry; label: string; type?: string }[] = [
    { key: 'title', label: 'Meaningful outcome or title' }, { key: 'done', label: 'Definition of done / desired meeting outcome' },
    { key: 'next', label: 'Smallest next action / what I will do' }, { key: 'deadline', label: 'Deadline / review / follow-up date', type: 'date' },
    { key: 'owner', label: 'Dependency owner / editable group roles / official service owner' },
    { key: 'context', label: 'Selected prompt, sources, documents or evidence (private)' },
    { key: 'obstacle', label: 'Pre-mortem: most likely obstacle (if…)' }, { key: 'response', label: 'Small prevention or contingency step (then…)' },
    { key: 'assumptions', label: 'Assumptions / what mattered / what needs official confirmation' },
    { key: 'reflection', label: 'Decision outcome (yes / partly / no), meeting notes or reflection' },
    { key: 'support', label: 'Human-support route / official next system' },
    { key: 'steps', label: 'Milestones, one per line: step | owner | date | dependency | status | context | first action | support' },
    { key: 'submitted', label: 'Submitted / meeting date', type: 'date' }, { key: 'reviewed', label: 'Official source last reviewed', type: 'date' },
  ];
  const preference = <K extends keyof Manual>(key: K, value: Manual[K]) => setEditingManual(m => ({ ...m, [key]: value }));
  const exportAll = () => download('semester-operating-workspace.zip', zipSync({ 'workspace.json': strToU8(JSON.stringify(exportOperating(workspace), null, 2)), 'plans.csv': strToU8(operatingCsv(workspace)), 'manual.md': strToU8(operatingMarkdown(workspace)) }), 'application/zip');
  return <section aria-label="Student operating workspace" style={manual?.quiet ? { background: 'var(--app-bg)', lineHeight: 'var(--leading-relaxed)' } : undefined} data-quiet={manual?.quiet || undefined}>
    <SectionLabel>My Student Operating Manual</SectionLabel>
    <p>Start with one outcome, define done, choose a small action, select context, plan for an obstacle, then close with a next step. Your preferences and plans are private. No ability, health, motivation or risk is inferred.</p>
    <p>Saved with your private Semester workspace on this device and your account when account sync is enabled. Nothing here sends a message, creates a share or changes an official record.</p>
    <details><summary>Edit how Semester helps me</summary>
      <label>Planning style<select className="input" value={editingManual.style} onChange={e => preference('style', e.target.value as Manual['style'])}>{['simple','daily','weekly','project','explore'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Starter minutes<select className="input" value={editingManual.minutes} onChange={e => preference('minutes', Number(e.target.value) as Manual['minutes'])}>{[2,5,10,25,45].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Representation<select className="input" value={editingManual.format} onChange={e => preference('format', e.target.value as Manual['format'])}>{['checklist','timeline','map','plain'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>When stuck<select className="input" value={editingManual.stuck} onChange={e => preference('stuck', e.target.value)}>{['smaller_step','source_explanation','analogous_practice','prepare_question','human_support','fewer_suggestions'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Reminder preference (no reminders are scheduled by this workspace)<select className="input" value={editingManual.notifications} onChange={e => preference('notifications', e.target.value as Manual['notifications'])}>{['none','essential','daily','weekly'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Preferred planning time<input className="input" value={editingManual.planningTime} onChange={e => preference('planningTime', e.target.value)} /></label>
      <label>Break preference<input className="input" value={editingManual.breaks} onChange={e => preference('breaks', e.target.value)} /></label>
      <label>Save until (term end)<input className="input" type="date" value={editingManual.expires} onChange={e => preference('expires', e.target.value)} /></label>
      {(['quiet','noOpportunities','noAnalytics','noStudyBlocks'] as const).map(k => <label key={k} style={{ display: 'block' }}><input type="checkbox" checked={editingManual[k]} onChange={e => preference(k, e.target.checked)} />{({quiet:'Quiet Mode',noOpportunities:'No opportunity prompts',noAnalytics:'No planning analytics',noStudyBlocks:'No automatic study blocks'})[k]}</label>)}
      <ActionButton onClick={() => { setTemporary(editingManual); setNotice('Preferences applied for this visit only; nothing saved.'); }}>Use for this visit only</ActionButton>
      <ActionButton onClick={() => { if (!editingManual.expires || editingManual.expires < today) { setNotice('Choose a valid term-end date before saving.'); return; } save({ ...workspace, manual: editingManual }); setTemporary(null); setNotice('Preferences saved until your selected term end.'); }}>Save for this term</ActionButton>
      <button className="bare" onClick={() => { save({ ...workspace, manual: null }); setTemporary(null); setEditingManual(defaultManual()); setNotice('Preferences deleted.'); }}>Delete preferences</button>
    </details>
    {!hidePrompt && <fieldset><legend>How much planning structure would help right now?</legend>{(['low','medium','high','none'] as const).map(v => <button className="pill-soft tap-y" key={v} aria-pressed={structure === v} onClick={() => setStructure(v)}>{v === 'none' ? 'No preference' : v}</button>)}<button className="bare" onClick={() => { setHidePrompt(true); setStructure('none'); }}>Do not ask again this visit</button></fieldset>}
    {hidePrompt && <button className="bare" onClick={() => setHidePrompt(false)}>Change planning structure</button>}
    <p>Suggested starter: {firstMinutes} minutes. Because you selected {mode === 'none' ? 'your normal view' : mode + ' structure'}. Help route: {manual?.stuck.replaceAll('_',' ') ?? 'smaller step'}. No grades, tutor activity or behavioral data used. Dates and access never change with this choice.</p>
    <SectionLabel>{mode === 'low' ? 'One next action' : mode === 'medium' ? 'Daily Three' : 'My project and weekly workspace'}</SectionLabel>
    {shown.length === 0 && <p>Add your first outcome below. Completed items remain in your export and full history.</p>}
    {shown.map(e => <article key={e.id} style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--app-line)' }}>
      <h3>{e.title}</h3><p>{labels[e.kind]} · {e.status} · {e.deadline || 'No date selected'}</p>
      <p>{e.next || 'Choose a first small action.'}</p>
      {mode !== 'low' && <><p>Done means: {e.done || 'Not defined yet'}</p>{e.obstacle && <p>If {e.obstacle}, then {e.response || 'choose a fallback'}.</p>}
        {e.steps && (manual?.format === 'map' ? <OperatingProjectMap steps={e.steps} /> : manual?.format === 'timeline' ? <ol aria-label="Milestone timeline">{e.steps.split('\n').filter(Boolean).map((s,i) => <li key={i}>{s}</li>)}</ol> : <p style={{ whiteSpace: 'pre-wrap' }}>{e.steps}</p>)}</>}
      <button className="bare" onClick={() => setEntry({ ...e })}>Edit / reflect / repair</button>{' '}
      <button className="bare" onClick={() => { setReview(e); setPacketPreview(false); setDraft(''); }}>Review blind spots and context</button>{' '}
      <button className="bare" onClick={() => save({ ...workspace, entries: workspace.entries.map(x => x.id === e.id ? { ...x, status: 'done' } : x) })}>Mark resolved</button>{' '}
      <button className="bare" onClick={() => { setEntry({ ...e, kind: 'plan', id: crypto.randomUUID(), status: 'planned', reflection: '', submitted: '' }); setNotice('Private copy ready to edit; choose Save to keep it.'); }}>Reuse as plan</button>
    </article>)}
    <details><summary>All items, including completed and waiting</summary>{workspace.entries.map(e => <p key={e.id}><button className="bare" onClick={() => setEntry({ ...e })}>{e.title} · {e.status}</button>{' '}<button className="bare" onClick={() => save({ ...workspace, entries: workspace.entries.filter(x => x.id !== e.id) })}>Delete this item</button></p>)}</details>
    <details open={mode !== 'low'}><summary>Add or edit a private outcome, decision or workflow</summary>
      <form onSubmit={e => { e.preventDefault(); if (!entry.title.trim()) return; save({ ...workspace, entries: [...workspace.entries.filter(x => x.id !== entry.id), { ...entry, title: entry.title.trim() }] }); setEntry(emptyEntry(entry.kind)); setNotice('Saved privately. No reflection becomes a preference automatically.'); }}>
        <label>Workflow<select className="input" value={entry.kind} onChange={e => patch('kind', e.target.value)}>{Object.entries(labels).map(([k,v]) => <option value={k} key={k}>{v}</option>)}</select></label>
        <label>Status<select className="input" value={entry.status} onChange={e => patch('status', e.target.value)}>{['planned','moving','waiting','blocked','done'].map(v => <option key={v}>{v}</option>)}</select></label>
        {fields.map(f => <label key={f.key} style={{ display: 'block', marginTop: 'var(--sp-3)' }}>{f.label}{f.type ? <input className="input" type={f.type} value={entry[f.key]} onChange={e => patch(f.key, e.target.value)} /> : <textarea className="input" required={f.key === 'title'} value={entry[f.key]} onChange={e => patch(f.key, e.target.value)} rows={f.key === 'steps' ? 5 : 2} />}</label>)}
        <button type="submit" className="pill-soft tap-y">Save privately</button>{' '}<button type="button" className="bare" onClick={() => setEntry(emptyEntry('plan'))}>New item</button>
      </form>
    </details>
    <details><summary>Starter playbooks and recovery</summary>{Object.entries(PLAYBOOKS).map(([name,steps]) => <p key={name}><button className="bare" onClick={() => { setEntry({ ...emptyEntry('playbook'), title: name, steps, next: steps.split('\n')[0] }); setNotice('Starter copied into the editor. Edit and save to keep it.'); }}>{name}</button></p>)}</details>
    {review && <section aria-label="Plan review"><h3>Review: {review.title}</h3><p>Rule-based checklist, not an AI assessment. Uncertainty: official source facts and availability have not been verified.</p>
      {critic(review).map((c,i) => <p key={i}>{c.message} Because: {c.because} <button className="bare" onClick={() => setEntry({ ...review })}>Edit plan</button></p>)}
      <button className="bare" onClick={() => setPacketPreview(v => !v)}>Preview selected Context Packet</button>
      {packetPreview && <div><p style={{ whiteSpace: 'pre-wrap' }}>{review.context || 'No context selected.'}</p><p>This preview sends nothing to AI or staff. Select only approved material under your course policy. Restricted assessment answers remain outside this workflow.</p></div>}
      <label>Recipient to review<input className="input" value={recipient} onChange={e => setRecipient(e.target.value)} /></label>
      <button className="bare" onClick={() => setDraft(`Hello,\n\nI am working on ${review.title}. My next step is ${review.next || '[choose next step]'}. I would appreciate guidance on ${review.obstacle || '[write your question]'}.\n\n${review.reflection ? 'My notes: ' + review.reflection + '\n\n' : ''}Thank you.`)}>Prepare human handoff / follow-up draft</button>
      {draft && <><label>Review draft<textarea className="input" rows={8} value={draft} onChange={e => setDraft(e.target.value)} /></label><p>Recipient: {recipient || 'Not selected'}. Copy/export only. You decide what to send through your own mail system; no automatic send.</p><button className="bare" onClick={() => download('human-handoff.txt', `Recipient: ${recipient}\n\n${draft}`, 'text/plain')}>Export reviewed draft</button></>}
      <button className="bare" onClick={() => { setReview(null); setDraft(''); }}>Close review</button>
    </section>}
    <details><summary>Read aloud and reviewed calendar export</summary>
      <button className="bare" onClick={() => { if (!('speechSynthesis' in window)) { setNotice('Read aloud is unavailable in this browser.'); return; } window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(shown.map(e => e.title + '. Next: ' + e.next).join('. '))); }}>Read current plan aloud</button>{' '}
      <button className="bare" onClick={() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }}>Stop reading</button>
      <p>Export one student-selected planning window; importing it into a calendar is your choice.</p>
      <label>Window title<input className="input" value={entry.title} onChange={e => { patch('title', e.target.value); setCalendarReviewed(''); }} /></label>
      <label>Start in this device’s local timezone<input className="input" type="datetime-local" value={calendarStart} onChange={e => { setCalendarStart(e.target.value); setCalendarReviewed(''); }} /></label>
      <p>Preview: {entry.title || 'Choose a title'} · {calendarStart || 'Choose start'} · {firstMinutes} minutes. No source text or private notes included.</p>
      <label><input type="checkbox" checked={calendarReviewed === `${entry.title}|${calendarStart}|${firstMinutes}`} onChange={e => setCalendarReviewed(e.target.checked ? `${entry.title}|${calendarStart}|${firstMinutes}` : '')} />I reviewed this title, start and duration for export.</label>
      <button className="bare" disabled={calendarReviewed !== `${entry.title}|${calendarStart}|${firstMinutes}` || !entry.title || !calendarStart} onClick={() => { try { download('semester-planning-window.ics', operatingIcs(entry.title, calendarStart, firstMinutes), 'text/calendar'); setCalendarReviewed(''); } catch { setNotice('Choose a valid calendar start time.'); } }}>Export confirmed ICS</button>
    </details>
    <details><summary>Export and privacy controls</summary><p>Exports separate preferences, private objects, references and empty sharing/consent metadata. Energy selections are transient and excluded. No sharing service is activated here.</p>
      <button className="bare" onClick={() => download('semester-operating.json', JSON.stringify(exportOperating(workspace), null, 2), 'application/json')}>JSON</button>{' '}
      <button className="bare" onClick={() => download('semester-operating.csv', operatingCsv(workspace), 'text/csv')}>CSV</button>{' '}
      <button className="bare" onClick={() => download('semester-operating.md', operatingMarkdown(workspace), 'text/markdown')}>Markdown</button>{' '}
      <button className="bare" onClick={exportAll}>ZIP</button>{' '}
      <button className="bare" onClick={() => {
        const frame = document.createElement('iframe'); frame.title = 'Printable private plan'; frame.style.position = 'fixed'; frame.style.width = '1px'; frame.style.height = '1px'; document.body.append(frame);
        const doc = frame.contentDocument; if (!doc) { frame.remove(); return; }
        const heading = doc.createElement('h1'); heading.textContent = 'My Semester plan'; doc.body.append(heading);
        const info = doc.createElement('p'); info.textContent = 'Private, student-selected plan. ' + today; doc.body.append(info);
        for (const item of shown) { const h = doc.createElement('h2'); h.textContent = item.title; doc.body.append(h); const p = doc.createElement('p'); p.textContent = `Next: ${item.next}. Done: ${item.done}. Date: ${item.deadline}. If ${item.obstacle}, then ${item.response}. Support: ${item.support}`; doc.body.append(p); }
        frame.contentWindow?.focus(); frame.contentWindow?.print(); setTimeout(() => frame.remove(), 1000);
      }}>Print selected plan / save PDF</button>{' '}
      <button className="bare" onClick={() => setDeletePending(true)}>Delete this planning workspace</button>
      {deletePending && <ConfirmDialog
        title="Delete this planning workspace?"
        preview={<ActionPreview
          subject={`Planning workspace · ${workspace.entries.length} saved workflow item${workspace.entries.length === 1 ? '' : 's'}`}
          says={<>Deletes all saved operating preferences and {workspace.entries.length} workflow item{workspace.entries.length === 1 ? '' : 's'} from your private Semester workspace. It also clears this screen’s unsaved editor, review and handoff draft. When account sync is enabled, that deletion is saved to your account too.</>}
          doesNotChange="Downloaded exports, calendar entries you imported separately and official records stay where they are."
          recovery={{ kind: 'none', how: 'Export a backup before deleting if you need a copy.' }}
        />}
        confirmLabel="Delete workspace"
        onCancel={() => setDeletePending(false)}
        onConfirm={() => { dispatch({ type: 'setOperatingWorkspace', value: null }); setTemporary(null); setEditingManual(defaultManual()); setReview(null); setDraft(''); setEntry(emptyEntry('plan')); setDeletePending(false); setNotice('Operating workspace deleted.'); }}
      />}
    </details>
    <details><summary>Human oversight and boundaries</summary><p>You decide private plans and sharing. Faculty controls course sources and assessment policy. Advisors and registrars make official academic determinations. Messages, calendar writes and shares require exact previews and student confirmation; official writes also require authorized institutional approval. Privacy incidents belong with the named institutional security/privacy owner. This workspace performs none of those external actions.</p><p>Private choices stay under your control; no inferred profiles, peer rankings or automatic staff alerts. Group charters are private preparation; live collaboration and faculty aggregate signals require separately configured institutional access and privacy controls.</p></details>
    <p role="status">{notice}</p>
  </section>;
}
