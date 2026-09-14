import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { datedItems } from '../lib/select';
import { bestBuys, calibrate } from '../lib/worth';
import { dateToIso } from '../lib/date';
import { assignmentProgress, inAssignmentView, workloadByDay, type AssignmentView } from '../lib/assignmentcenter';
import { BreakItUp } from './BreakItUp';
import { TermSwitch } from './TermSwitch';
import type { DatedItem } from '../lib/types';

const VIEWS: [AssignmentView, string][] = [['today','Today'],['week','Next 7 days'],['upcoming','Upcoming'],['overdue','Past due'],['working','In progress'],['completed','Completed'],['graded','Recorded grades'],['all','All work']];

export function AssignmentCenter({ onTools }: { onTools: () => void }) {
  const { state, dispatch, catalog, now } = useStore();
  const [view, setView] = useState<AssignmentView>('week');
  const [query, setQuery] = useState('');
  const [course, setCourse] = useState('');
  const [sort, setSort] = useState('date');
  const [layout, setLayout] = useState('list');
  const [selected, setSelected] = useState<string | null>(null);
  const all = datedItems(catalog, now);
  const recordedGrades = Object.fromEntries(state.returned.map(r=>[r.id,r.score]));
  const bias = calibrate(state.spent.filter(s => typeof s.guess === 'number').map(s => ({ guess: s.guess ?? 0, minutes: s.minutes })));
  const ranked = bestBuys(all.filter(i => !state.done[i.id]).map(i => ({...i, courseId:i.c})), state.spent, bias);
  const ranks = new Map(ranked.map((item, index) => [item.id,index]));
  const estimates = new Map(ranked.map(item => [item.id,item.minutes]));
  const reasons = new Map(ranked.map(item => [item.id,item.why]));
  const filtered = all.filter(i => (!course || i.c === course) && `${i.title} ${i.detail} ${catalog.byId[i.c]?.code ?? ''}`.toLowerCase().includes(query.toLowerCase().trim()));
  const items = filtered.filter(i => inAssignmentView(i,view,state.done,state.started,recordedGrades));
  if (sort === 'priority') items.sort((a,b) => Number(b.isPast&&!state.done[b.id])-Number(a.isPast&&!state.done[a.id]) || (ranks.get(a.id) ?? Infinity)-(ranks.get(b.id) ?? Infinity));
  const days = workloadByDay(filtered,state.done,estimates);
  const selectedItem = all.find(i => i.id === selected);
  const next = ranked.find(i => (all.find(a => a.id === i.id)?.daysAway ?? -1) >= 0 && i.daysAway < 7);
  const count = (v: AssignmentView) => all.filter(i => inAssignmentView(i,v,state.done,state.started,recordedGrades)).length;

  return <div className="portal-workspace assignment-center">
    <header className="portal-heading"><div><span className="portal-eyebrow">{state.sample ? 'Sample semester' : 'Your semester'} · Academic workspace</span><h2>One place for all your work</h2><p>Find what is due, continue a draft, and plan your next step.</p></div><div className="portal-actions"><button onClick={onTools}>Assignment tools</button><button onClick={()=>dispatch({type:'go',screen:'calendar'})}>Open calendar</button></div></header>
    <TermSwitch/>
    <div className="portal-stats">{(['today','week','overdue','working'] as AssignmentView[]).map(id=><button key={id} onClick={()=>{setView(id);setLayout('list');}}><strong>{count(id)}</strong><span>{VIEWS.find(v=>v[0]===id)?.[1]}</span></button>)}</div>
    {next && <section className="assignment-next"><div><span className="portal-eyebrow">What should I do next?</span><strong>{catalog.byId[next.courseId]?.code} · {next.title}</strong><p>{next.daysAway===0?'Due today':`Due in ${next.daysAway} days`} · {next.why}. Suggested from due dates, grade weight and your recorded pace.</p></div><button className="portal-primary" onClick={()=>setSelected(next.id)}>Plan this work →</button></section>}
    <div className="portal-filter-row"><label className="portal-search"><input type="search" aria-label="Search all assignments" placeholder="Search assignments and instructions" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter assignments by course" value={course} onChange={e=>setCourse(e.target.value)}><option value="">All courses</option>{catalog.courses.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select><select aria-label="Assignment sort order" value={sort} onChange={e=>setSort(e.target.value)}><option value="date">Due date</option><option value="priority">Suggested priority</option></select></div>
    <div className="portal-tabs" aria-label="Assignment views">{VIEWS.map(([id,label])=><button key={id} aria-pressed={view===id&&layout==='list'} onClick={()=>{setView(id);setLayout('list');}}>{label}</button>)}<button aria-pressed={layout==='workload'} onClick={()=>setLayout('workload')}>Workload</button></div>
    {layout==='workload' ? <section className="portal-panel"><h3>Next 7 days at a glance</h3><p className="portal-muted">Estimates use your recorded study times. Untimed work remains unestimated. This is work due each day, not a schedule of reserved work sessions.</p>{days.map(day=><div className="assignment-load-row" key={day.label}><strong>{day.label}</strong><span>{day.items.length} items{day.items.length>=3?' · Several deadlines together':''}</span><span>{day.minutes ? `${Math.round(day.minutes/6)/10} estimated hours` : 'No time estimate'}{day.unknown?` · ${day.unknown} unestimated`:''}</span><div>{day.items.map(i=><button key={i.id} onClick={()=>setSelected(i.id)}>{catalog.byId[i.c]?.code} · {i.title}</button>)}</div></div>)}{!days.length&&<p>No outstanding deadlines in the next 7 days.</p>}<button onClick={()=>dispatch({type:'go',screen:'tonight'})}>Plan with my available time →</button></section> : <section className="portal-panel"><p className="portal-muted">{items.length} items · Completion and grades here are your records. They do not confirm an official submission.</p><div className="assignment-list">{items.map(item=>{const progress=assignmentProgress(item.id,state.tasks,!!state.done[item.id]);return <article className="assignment-list-row" key={item.id}><button aria-label={`Open assignment ${item.title}`} className="assignment-title" onClick={()=>setSelected(item.id)}><span className="portal-eyebrow">{catalog.byId[item.c]?.code ?? item.c} · {item.kind}</span><strong>{item.title}</strong><small>{item.dueShort} · {item.dueTime || 'Time not stated'}{item.weight?` · ${item.weight}`:''}</small></button><span className="assignment-status">{state.done[item.id]?'Completed':item.isPast?'Past due':state.started[item.id]?'In progress':'Not started'}{progress.percent!==null&&<small>{progress.percent}% {progress.steps.length ? 'of checklist' : 'complete'}</small>}{recordedGrades[item.id]?.trim()&&<small>Recorded grade: {recordedGrades[item.id]}</small>}</span><button className="assignment-open" onClick={()=>setSelected(item.id)}>Open →</button></article>;})}</div>{!items.length&&<p role="status">No work matches this view. Try All work, another course, or import a syllabus.</p>}{!all.length&&<button className="portal-primary" onClick={()=>dispatch({type:'go',screen:'import'})}>Import a syllabus</button>}</section>}
    {selectedItem&&<AssignmentPlan key={selectedItem.id} item={selectedItem} reason={reasons.get(selectedItem.id)} onClose={()=>setSelected(null)}/>}
  </div>;
}

function AssignmentPlan({item,reason,onClose}:{item:DatedItem;reason?:string;onClose:()=>void}) {
 const {state,dispatch,catalog}=useStore();const [step,setStep]=useState('');const [day,setDay]=useState(dateToIso(item.date));
 const planRef=useRef<HTMLElement>(null);
 useEffect(()=>{planRef.current?.focus();planRef.current?.scrollIntoView({block:'start',behavior:'instant'});},[]);
 const progress=assignmentProgress(item.id,state.tasks,!!state.done[item.id]);
 return <section ref={planRef} tabIndex={-1} className="portal-panel assignment-plan" aria-label={`Plan ${item.title}`}><div className="portal-heading"><div><span className="portal-eyebrow">{catalog.byId[item.c]?.code} · {item.dueShort}</span><h3>{item.title}</h3></div><button aria-label="Close assignment plan" onClick={onClose}>×</button></div><p>{item.detail || 'No additional instructions recorded.'}</p>{reason&&<p className="portal-muted">Planning estimate: {reason}.</p>}{item.quote&&<blockquote>{item.quote}<footer>{item.source}{item.checked?.page?` · Page ${item.checked.page}`:''}</footer></blockquote>}<div className="portal-actions"><button className="portal-primary" onClick={()=>dispatch({type:'openItem',id:item.id})}>Instructions, files & feedback →</button><button onClick={()=>dispatch({type:'newDocument',courseId:item.c,itemId:item.id})}>Start a document</button>{!state.done[item.id]&&<button aria-pressed={!!state.started[item.id]} onClick={()=>dispatch({type:'toggleStarted',id:item.id})}>{state.started[item.id]?'Mark not started':'Mark started'}</button>}<button onClick={()=>dispatch({type:'toggleDone',id:item.id})}>{state.done[item.id]?'Reopen work':'Mark completed'}</button></div><h4>Your checklist</h4>{progress.percent!==null&&<p>{progress.checked} of {progress.steps.length} steps done. Checking every step does not submit this assignment.</p>}{progress.steps.map(t=><label className="assignment-step" key={t.id}><input type="checkbox" checked={t.done} onChange={()=>dispatch({type:'toggleTask',id:t.id})}/><span>{t.title}<small>{t.date || 'No planned date'}</small></span></label>)}<form className="portal-filter-row" onSubmit={e=>{e.preventDefault();if(!step.trim())return;dispatch({type:'addTask',task:{title:step.trim(),from:item.id,date:day||null,time:'',note:`Step towards ${item.title}`,courseId:item.c}});setStep('');}}><input aria-label="New assignment step" placeholder="Add a small next step" maxLength={500} value={step} onChange={e=>setStep(e.target.value)}/><input type="date" aria-label="Planned date for assignment step" value={day} onChange={e=>setDay(e.target.value)}/><button type="submit" disabled={!step.trim()}>Add step</button></form><BreakItUp item={item}/><p className="portal-muted">Steps appear in your tasks and calendar. Use the course’s authorized submission system to hand in work.</p></section>;
}
