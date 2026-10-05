import {useState} from 'react';
import {useNow,useStore} from '../state/store';
import {download} from '../lib/deliver';
import {courseLearningInput} from '../lib/learning-loop';
import {dueByConcept,statesByConcept} from '../lib/learningmap';
import {forReview} from '../lib/learninginsights';
import {buildAgenda,candidates,type Item} from '../lib/officeagenda';
import {useMapLibrary} from './LearningMap';
import {useInboxLibrary} from './FeedbackInbox';
/** A question list for office hours, built from what the student kept. Nothing is chosen for them and nothing is sent. */
export function OfficeAgenda(){
 const {state,dispatch,catalog}=useStore();const map=useMapLibrary().value;const inbox=useInboxLibrary().value;
 const [chosenCourse,setCourseId]=useState('');const courseId=chosenCourse||catalog.courses[0]?.id||'';const [picked,setPicked]=useState<Record<string,boolean>>({});const [goal,setGoal]=useState('');const [tried,setTried]=useState('');const [notice,setNotice]=useState('');
 const course=catalog.courses.find(c=>c.id===courseId);const guide=catalog.guides[courseId];
 const now=useNow().getTime();
 const dues=guide?dueByConcept(courseId,guide,state.reviews,now):{};const due=Object.values(dues).reduce((a,b)=>a+b,0);
 const review=guide?forReview(statesByConcept(courseLearningInput(courseId,guide,state.reviews,{due,now}),dues)):[];
 const all=candidates({courseId,own:map.own,feedback:inbox.items,review});
 const chosen=all.filter((i:Item)=>picked[i.id]);
 const text=buildAgenda({course:course?.code??'',goal,tried,chosen});
 const copy=async()=>{try{await navigator.clipboard.writeText(text);setNotice('Copied. Nothing was sent.');}catch{setNotice('Your browser would not copy. Use Save as a text file instead.');}};
 return <details className="portal-workspace portal-panel office-agenda"><summary>Office-hours agenda</summary><p>Turn what you kept into a short list to bring. Tick what you want on it — nothing is chosen for you, and nothing is sent anywhere. You copy or save it yourself.</p><label>Course<select className="input" value={courseId} onChange={e=>{setCourseId(e.target.value);setPicked({});setGoal('');setTried('');setNotice('');}}>{catalog.courses.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select></label>{all.length===0?<p>Nothing to bring yet. Questions from the learning map, filed feedback and concepts marked to review show up here.</p>:<fieldset><legend>What to put on it</legend>{all.map(i=><label key={i.id}><input type="checkbox" checked={!!picked[i.id]} onChange={e=>setPicked({...picked,[i.id]:e.target.checked})}/> {i.title}<span className="portal-muted"> · {i.kind==='question'?'your question':i.kind==='feedback'?'feedback you filed':'marked to review'}</span></label>)}</fieldset>}<label>What I would like from this visit<input className="input" maxLength={300} value={goal} onChange={e=>setGoal(e.target.value)}/></label><label>What I have already tried<textarea className="input" maxLength={4000} value={tried} onChange={e=>setTried(e.target.value)}/></label><section className="portal-panel"><span className="portal-eyebrow">Your agenda, as it will read</span><pre className="preserve-lines">{text}</pre></section><div className="portal-actions"><button onClick={()=>void copy()}>Copy the agenda</button><button onClick={()=>download({name:`Office hours ${course?.code??''}.txt`,body:text,mime:'text/plain'})}>Save as a text file</button><button onClick={()=>dispatch({type:'go',screen:'meet'})}>Find academic support</button></div>{notice&&<p role="status">{notice}</p>}</details>;
}
