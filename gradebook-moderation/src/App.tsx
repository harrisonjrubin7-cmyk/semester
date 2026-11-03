import React, {useState} from 'react';
import './styles.css';
type Role='Faculty'|'TA'|'Registrar'|'Advisor'|'Student';
type State='draft'|'submitted'|'reviewed';
type Blocker='none'|'policy_exception'|'privacy_block'|'missing_evidence';
type Release={score:number;version:number;by:Role};
export default function App(){
 const [role,setRole]=useState<Role>('Faculty');
 const [state,setState]=useState<State>('draft');
 const [score,setScore]=useState('84');
 const [version,setVersion]=useState(1);
 const [blocker,setBlocker]=useState<Blocker>('none');
 const [gate,setGate]=useState(true);
 const [override,setOverride]=useState<number|null>(null);
 const [reason,setReason]=useState('');
 const [releases,setReleases]=useState<Release[]>([]);
 const [events,setEvents]=useState<string[]>([]);
 const [error,setError]=useState('');
 const [screen,setScreen]=useState('default');
 const [transcript,setTranscript]=useState('requested');
 const [auditMode,setAuditMode]=useState('official');
 const [shared,setShared]=useState(false);
 const canInspect=['Faculty','TA','Registrar'].includes(role);
 const ready=state==='reviewed'&&gate&&(blocker==='none'||blocker==='policy_exception'&&override===version);
 const visible=role==='Student'||role==='Advisor' ? releases.at(-1) : undefined;
 const log=(s:string)=>{setEvents(e=>[...e,`${role}: ${s} · authority DEMO-${role} · v${version}`]);setError('');};
 const invalidate=()=>{setVersion(v=>v+1);setOverride(null);setState('draft');};
 function release(){
  const n=Number(score);
  if(!['Faculty','Registrar'].includes(role)||!ready||!score.trim()||!Number.isFinite(n)||n<0||n>100){setError('Release denied: review, evidence, valid score or authority missing.');return;}
  if(releases.some(r=>r.version===version)){setError('This version is already released.');return;}
  setReleases(r=>[...r,{score:n,version,by:role}]);log('Released score; not final academic acceptance');
 }
 function approve(){
  if(role!=='Registrar'||state!=='reviewed'||blocker!=='policy_exception'||!gate||!reason.trim()){setError('Only a reviewed policy exception with a reason is overrideable.');return;}
  setOverride(version);log('Policy override approved: '+reason.trim());
 }
 const transcriptFlow=['requested','validating','authorized','generating','ready','delivering','delivered'];
 const auditAllowed=auditMode==='official'||role==='Student'||role==='Advisor'&&shared;
 return <><header><h1>Semester · Moderation and release</h1><p>Local fixtures only. Role selection is not authentication; all transitions simulate authority.</p></header><div className="shell"><aside><label htmlFor="role">Demo role</label><select id="role" value={role} onChange={e=>{setRole(e.target.value as Role);setError('');}}>{['Faculty','TA','Registrar','Advisor','Student'].map(r=><option key={r}>{r}</option>)}</select><p>Moderation</p><p>Release preview</p><p>Degree audit</p><p>Transcript status</p></aside><main><label htmlFor="screen">Screen state</label><select id="screen" value={screen} onChange={e=>setScreen(e.target.value)}>{['default','loading','empty','error','forbidden','offline'].map(s=><option key={s}>{s}</option>)}</select>{error&&<p role="alert">{error}</p>}
 {screen!=='default'?<article role="status">{screen}: fixture display; mutation controls unavailable.</article>:<>
 <article><h2>Assessment moderation</h2>{canInspect?<><p>Version {version} · {state}</p><label htmlFor="score">Draft score (0–100)</label><input id="score" value={score} disabled={!['Faculty','TA'].includes(role)} onChange={e=>{setScore(e.target.value);invalidate();}}/><button disabled={!['Faculty','TA'].includes(role)||state!=='draft'} onClick={()=>{setState('submitted');log('Submitted for review');}}>Submit</button><button disabled={role!=='Faculty'||state!=='submitted'} onClick={()=>{setState('reviewed');log('Review approved');}}>Approve moderation</button><label htmlFor="blocker">Test fixture blocker</label><select id="blocker" value={blocker} disabled={role!=='Faculty'} onChange={e=>{setBlocker(e.target.value as Blocker);invalidate();}}>{['none','policy_exception','privacy_block','missing_evidence'].map(s=><option key={s}>{s}</option>)}</select><label><input type="checkbox" checked={gate} disabled={role!=='Faculty'} onChange={e=>{setGate(e.target.checked);invalidate();}}/> Access gate passed (fixture control, server-owned in production)</label>{role==='Registrar'&&<><label htmlFor="reason">Override reason</label><input id="reason" value={reason} onChange={e=>setReason(e.target.value)}/><button onClick={approve} disabled={state!=='reviewed'||blocker!=='policy_exception'||!gate||!reason.trim()}>Approve policy exception</button></>}<p>Readiness: {ready?'ready_as_of — fixture evaluation':blocker==='privacy_block'?'blocked — cannot override':blocker==='missing_evidence'?'unknown — evidence missing':'review_required'}</p><p>Release publishes this score and approved feedback. It does not accept a final grade or issue a transcript. Recovery: a new versioned correction.</p><button onClick={release} disabled={!['Faculty','Registrar'].includes(role)||!ready}>Release reviewed version</button></>:<p>Published score: {visible?.score??'Not released'}. Draft score is not rendered in this role view.</p>}</article>
 <article><h2>Degree audit</h2><label htmlFor="mode">Run mode</label><select id="mode" value={auditMode} onChange={e=>setAuditMode(e.target.value)}><option>official</option><option>what_if</option></select>{role==='Student'&&<label><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)}/> Share this what-if run with the assigned Advisor (local fixture)</label>}{['Advisor','Student','Registrar'].includes(role)&&auditAllowed?<p>Requirement evidence: unknown. Transfer evidence is missing; no completion claim. This is a synthetic run, not a computed degree audit.</p>:<p>Run unavailable. Personal what-if runs require explicit sharing.</p>}</article>
 <article><h2>Transcript status</h2>{['Student','Registrar'].includes(role)?<><p>{transcript} · separate accepted-record fixture</p><button disabled={role!=='Registrar'||transcript==='delivered'} onClick={()=>{setTranscript(transcriptFlow[transcriptFlow.indexOf(transcript)+1]);log('Transcript fixture advanced');}}>Advance transcript</button></>:<p>Transcript status denied in this role.</p>}<small>No artifact download, consent evaluation or external delivery is implemented.</small></article></>}
 <article><h2>Developer event inspector</h2><small>Full local ledger is not a production cross-role audit view.</small><ol>{events.map((e,i)=><li key={i}>{e}</li>)}</ol><p>Published versions: {releases.map(r=>`v${r.version}: ${r.score}`).join(', ')||'None'}</p><button onClick={()=>{setState('draft');setScore('84');setVersion(1);setBlocker('none');setGate(true);setOverride(null);setReason('');setReleases([]);setEvents([]);setTranscript('requested');setShared(false);setError('');}}>Reset</button></article></main></div></>;
}
