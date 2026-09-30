import {useState} from 'react';
import {useNow,useStore} from '../state/store';
import {useDeviceLibrary} from '../lib/device-library';
import {dateToIso} from '../lib/date';
import {ARTIFACT_KINDS,EMPTY_EVIDENCE,evidenceKey,readEvidence,saveArtifact,type Artifact} from '../lib/career-evidence';
/**
 * Keep something the student wrote as evidence of what they did.
 *
 * It saves one portfolio entry, in the student's own words and only when they
 * press the button, into the career evidence they already keep. It never adds a
 * skill: skills are confirmed one by one in Career, where they are backed by a
 * course or an entry, and a course is not proof of every skill it touches. The
 * entry has a stable id, so saving again updates it rather than filing a copy.
 */
export function SaveAsEvidence({id,courseId,title,description,kind='Paper'}:{id:string;courseId:string;title:string;description:string;kind?:Artifact['kind']}){
 const {state,account,dispatch,catalog}=useStore();const now=useNow();
 const lib=useDeviceLibrary(evidenceKey(account?.id,state.term),readEvidence,EMPTY_EVIDENCE);
 const course=catalog.courses.find(c=>c.id===courseId);const saved=lib.value.artifacts.find(a=>a.id===id);
 const [open,setOpen]=useState(false);const [t,setT]=useState(saved?.title??title);const [k,setK]=useState<Artifact['kind']>(saved?.kind??kind);const [d,setD]=useState(saved?.description??description);const [notice,setNotice]=useState('');
 const save=()=>{if(!course){setNotice('Pick the course this belongs to first.');return;}try{const next=saveArtifact(lib.value,{id,title:t,kind:k,date:dateToIso(now).slice(0,7),description:d,url:'',evidence:{kind:'course',id:course.id,label:`${course.code} · ${course.name}`},skills:saved?.skills??[]},{experiences:[],courseIds:catalog.courses.map(c=>c.id),confirmed:saved?.skills??[]});if(lib.update(next)){setNotice(saved?'Evidence updated.':'Saved to your career evidence.');setOpen(false);}}catch(e){setNotice(e instanceof Error?e.message:'Could not save.');}};
 if(!open)return <div className="save-as-evidence"><button disabled={!course} onClick={()=>{setNotice('');setOpen(true);}}>{saved?'Update my evidence':'Save as evidence'}</button>{notice&&<span role="status"> {notice}</span>}{saved&&!notice&&<span className="portal-muted"> On your career evidence.</span>}</div>;
 return <fieldset className="save-as-evidence portal-panel"><legend>Save as evidence</legend><p className="portal-muted">Only you see this until you choose to share a portfolio. Nothing here adds a skill — confirm skills in Career, where each needs a course or an entry behind it.</p><label>Title<input className="input" maxLength={300} value={t} onChange={e=>setT(e.target.value)}/></label><label>What it is<select className="input" value={k} onChange={e=>setK(e.target.value as Artifact['kind'])}>{ARTIFACT_KINDS.map(x=><option key={x}>{x}</option>)}</select></label><label>What I did and what I learned<textarea className="input" maxLength={2000} value={d} onChange={e=>setD(e.target.value)}/></label><div className="portal-actions"><button className="portal-primary" disabled={!t.trim()||lib.blocked} onClick={save}>{saved?'Update evidence':'Save to career evidence'}</button><button onClick={()=>setOpen(false)}>Cancel</button><button onClick={()=>dispatch({type:'go',screen:'career'})}>Open career evidence</button></div>{(notice||lib.error)&&<p role="status">{lib.error||notice}</p>}</fieldset>;
}
