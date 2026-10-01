import { ComparisonHistory } from './ComparisonHistory';
import { lazy, Suspense, useState } from 'react';
import { COMPARISON_SURFACES, comparisonDraft, type SavedComparison } from '../lib/comparison-actions';
import { EMPTY_PRODUCTIVITY, readProductivity } from '../lib/productivity';
import { EMPTY_MEETINGS, LIMITS, meetingKey, newMeeting, readMeetings } from '../lib/advisor-meeting';
import { useDeviceLibrary } from '../lib/device-library';
import type { ComparisonActionsProps } from './ComparisonActions';
const AdvisorMeeting = lazy(() => import('./AdvisorMeeting').then(m => ({ default: m.AdvisorMeeting })));

export default function ComparisonActionsPanel({ surface, scope, title, options, onChoose, decisionId, decisionVersion, accountId }: ComparisonActionsProps & { accountId: string | null }) {
  const work = useDeviceLibrary(`semester.productivity.v1:${accountId || 'device'}`, readProductivity, EMPTY_PRODUCTIVITY);
  const meetings = useDeviceLibrary(meetingKey(accountId), readMeetings, EMPTY_MEETINGS);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  const [included, setIncluded] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [planning, setPlanning] = useState(false);
  const textFor = (ids: string[], full: boolean) => ids.length ? comparisonDraft(title, options.filter(o => ids.includes(o.id)).map(o => ({ ...o, context: full ? o.context : o.advisorContext ?? ['Select planning context to include details.'] }))) : '';
  const [meetingId, setMeetingId] = useState('');
  const history = (work.value.comparisons ?? []).filter(s => s.surface === surface && s.scope === scope);
  const save = (chosen: string | null) => {
    const snapshot: SavedComparison = { id: crypto.randomUUID(), surface, scope, title, at: new Date().toISOString(), chosen, options: structuredClone(options) };
    const ok = work.update(old => {
      if (decisionId && JSON.stringify(old.decisions.find(d => d.id === decisionId)) !== decisionVersion) throw new Error('Decision changed. Review the options again.');
      return { ...old, comparisons: [...(old.comparisons ?? []), snapshot],
        decisions: chosen && decisionId ? old.decisions.map(d => d.id === decisionId ? { ...d, decided: true, chosen } : d) : old.decisions,
      };
    });
    if (ok && chosen && onChoose && !onChoose(chosen)) { setNotice('Personal choice saved. The source workspace could not be updated; review it before continuing.'); return; }
    setNotice(ok ? chosen ? `Personal choice saved: ${options.find(o => o.id === chosen)?.label}. No official action submitted.` : 'All options saved with their separate original context.' : 'Snapshot could not be saved.');
  };
  const prepare = () => {
    // Existing agenda limits apply. Refuse overflow rather than silently cutting context.
    const chunks = draft.match(/[\s\S]{1,500}/g) ?? [];
    if (!draft.trim() || chunks.length > LIMITS.items) return;
    const m = newMeeting(Date.now());
    m.title = title.slice(0, LIMITS.title);
    m.agenda = chunks.map(text => ({ id: crypto.randomUUID(), text }));
    if (meetings.update(old => {
      if (old.meetings.length >= LIMITS.meetings) throw new Error('Remove an older meeting before preparing another.');
      return { ...old, meetings: [m, ...old.meetings] };
    })) { setPreview(false); setMeetingId(m.id); setNotice('Editable advisor meeting prepared privately. Nothing sent.'); }
  };
  return <section aria-label={`${COMPARISON_SURFACES[surface]} actions`} className="portal-panel">
    <p>Save a personal choice or keep every option. Official next steps still need confirmation.</p>
    <div className="portal-actions">
      {options.map(o => <button key={o.id} type="button" disabled={work.blocked} onClick={() => save(o.id)}>Choose {o.label}</button>)}
      <button type="button" disabled={work.blocked} onClick={() => save(null)}>{options.length === 2 ? 'Save both options' : 'Save all options'}</button>
      <button type="button" onClick={() => { setIncluded([]); setPlanning(false); setDraft(''); setPreview(true); setMeetingId(''); }}>Ask advisor</button>
    </div>
    {(notice || work.error || meetings.error) && <p role="status">{work.error || meetings.error || notice}</p>}
    {preview && <section aria-label="Advisor privacy preview">
      <h4>Choose what to include</h4><p>Only selected option context enters this editable draft. Review and remove any details before preparing your meeting. Nothing is sent here.</p>
      {options.map(o => <label key={o.id} className="portal-check"><input type="checkbox" checked={included.includes(o.id)} onChange={e => {
        const ids = e.target.checked ? [...included, o.id] : included.filter(id => id !== o.id);
        setIncluded(ids); setDraft(textFor(ids, planning));
      }} />Include {o.label}</label>)}
      <label className="portal-check"><input type="checkbox" checked={planning} onChange={e => { setPlanning(e.target.checked); setDraft(textFor(included, e.target.checked)); }} />Include applied assumptions and personal planning context</label>
      <p>Changing selected options or context rebuilds the draft below.</p>
      <label>Advisor draft<textarea className="input" aria-label="Advisor draft" value={draft} onChange={e => setDraft(e.target.value)} /></label>
      {draft.length > LIMITS.items * LIMITS.text && <p role="alert">This draft exceeds the meeting agenda limit. Edit it to 15,000 characters or fewer.</p>}
      <button type="button" disabled={!included.length || !draft.trim() || draft.length > LIMITS.items * LIMITS.text || meetings.blocked} onClick={prepare}>Prepare editable meeting</button>
      <button type="button" onClick={() => { setPreview(false); setDraft(''); setIncluded([]); }}>Cancel advisor preview</button>
    </section>}
    {meetingId && <><button type="button" onClick={() => setMeetingId('')}>Close prepared meeting</button><Suspense fallback={<p role="status">Loading meeting…</p>}><AdvisorMeeting key={meetingId} accountId={accountId} initialMeetingId={meetingId} /></Suspense></>}
    <ComparisonHistory snapshots={history} />
  </section>;
}
