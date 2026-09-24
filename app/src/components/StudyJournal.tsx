import {useState} from 'react';
import {useNow,useStore} from '../state/store';
import {useDeviceLibrary,obj,textValue,isoDay} from '../lib/device-library';
import {fromMarkdown} from '../lib/document';
import {download} from '../lib/deliver';
import {findings,nothingYet,says} from '../lib/again';
import {dateToIso} from '../lib/date';
import {classifyMistake} from '../lib/learning-loop';
interface Entry {id:string;courseId:string;topic:string;attempt:string;correction:string;kind:string;source:string;review:string;resolved:boolean}
interface Journal {version:1;entries:Entry[]}
const EMPTY:Journal={version:1,entries:[]};
function readJournal(v:unknown):Journal{if(!obj(v)||v.version!==1||!Array.isArray(v.entries)||v.entries.length>150||v.entries.some(e=>!obj(e)||!['id','courseId','topic','kind','source'].every(k=>textValue(e[k],500))||!textValue(e.attempt,8000)||!textValue(e.correction,8000)||!isoDay(e.review)||typeof e.resolved!=='boolean'))throw new Error('Invalid study journal.');return v as unknown as Journal;}
export function StudyJournal(){const {state,account}=useStore();return <JournalBody key={`${account?.id||'device'}:${state.term}`} storageKey={`semester.study-journal.v1:${account?.id||'device'}:${state.term}`}/>;}
function JournalBody({storageKey}:{storageKey:string}){
 const {state,dispatch,catalog}=useStore();const now=useNow();const lib=useDeviceLibrary(storageKey,readJournal,EMPTY);const [topic,setTopic]=useState('');const [courseId,setCourseId]=useState(catalog.courses[0]?.id||'');const [attempt,setAttempt]=useState('');const [correction,setCorrection]=useState('');const [kind,setKind]=useState('Concept');const [source,setSource]=useState('');const [review,setReview]=useState('');const [notice,setNotice]=useState('');const [showModel,setShowModel]=useState(false);const [question,setQuestion]=useState(0);
 const cards=catalog.guides[courseId]?.units.flatMap(u=>u.cards)||[];const card=cards[question%Math.max(1,cards.length)];
 /*
  * What the journal says back.
  *
  * Every entry went in and nothing ever came out — the panel listed them
  * newest first, which is a filing cabinet rather than a journal. `lib/again.ts`
  * is the reading: a mistake written down again after it was marked reviewed,
  * a kind of error that is most of what a course's entries are, and entries
  * whose revisit date has gone by. It says nothing below its floors, and the
  * count on the summary is across every course, because a number that only
  * counts the course you happen to have selected is a number you cannot see
  * while the panel is shut.
  */
 const today=dateToIso(now);
 const found=findings(lib.value.entries,courseId,today);
 const everywhere=catalog.courses.reduce((n,c)=>n+findings(lib.value.entries,c.id,today).length,0);
 const suggested=classifyMistake({attempt,correction,topic,source});
 /*
  * `portal-workspace` beside the panel class, which is what every other
  * portal feature has and this one never did.
  *
  * `features.css` styles a bare `<button>` as `.portal-workspace button` —
  * forty pixels of minimum height, an eight pixel radius, the accent wash,
  * no uppercase. That scope is the whole reason those buttons can go
  * classless. This panel took `.portal-panel` for the frame and `.input` for
  * its fields, so its selects and textareas looked right, and left its seven
  * buttons matching no rule at all: on the deployed build they rendered as
  * user-agent defaults — grey, square-cornered, two-pixel bevel, twenty-one
  * pixels tall — in the middle of a screen where every other control is a
  * rounded pill.
  *
  * `CourseHub`, `StudyStudio`, Meals, Housing and Yes all wrap themselves in
  * it. `CampusDirectory` and `RegistrationPortal` do not, and are fine
  * because they are only ever mounted inside a screen that does. This one is
  * mounted bare on Study, which is what made it the only one showing.
  */
 return <details className="portal-workspace portal-panel study-journal"><summary>Teach-back practice &amp; private mistake journal{everywhere>0?` · ${everywhere} worth a look`:''}</summary><p>Try an explanation before opening the reference. Record what you missed and set a date to revisit it. Your notes are private and are not graded automatically.</p><label>Course<select className="input" value={courseId} onChange={e=>{setCourseId(e.target.value);setQuestion(0);setShowModel(false);}}>{catalog.courses.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select></label><section className="portal-panel study-again"><span className="portal-eyebrow">What this adds up to</span>{found.length>0?<ul>{found.map(f=><li key={`${f.sort}-${'topic'in f?f.topic:'kind'in f?f.kind:'n'}`}>{says(f)}</li>)}</ul>:<p>{nothingYet(lib.value.entries,courseId)}</p>}</section>{card&&<section className="portal-panel"><h3>{card.q}</h3><label>Your explanation without notes<textarea className="input" value={attempt} maxLength={8000} onChange={e=>setAttempt(e.target.value)}/></label><div className="portal-actions"><button disabled={!attempt.trim()} onClick={()=>setShowModel(!showModel)}>{showModel?'Hide reference':'Compare with course guide'}</button><button onClick={()=>{setQuestion(q=>q+1);setShowModel(false);setAttempt('');}}>Next prompt</button><button onClick={()=>{setTopic(card.q.slice(0,500));setSource('Prepared course guide · Original source location not recorded');}}>Use this prompt in journal</button></div>{showModel&&<blockquote>{card.a}</blockquote>}</section>}<form onSubmit={e=>{e.preventDefault();const entry:Entry={id:crypto.randomUUID(),courseId,topic,attempt,correction,kind,source,review,resolved:false};if(lib.update(old=>({...old,entries:[entry,...old.entries]}))){setTopic('');setAttempt('');setCorrection('');setNotice('Journal entry saved for your own review.');}}}><div className="study-controls"><label>Topic / problem<input className="input" required maxLength={500} value={topic} onChange={e=>setTopic(e.target.value)}/></label><label>What needs attention<select className="input" value={kind} onChange={e=>setKind(e.target.value)}>{['Concept','Calculation','Formula','Question interpretation','Evidence','Units or sign','Incomplete explanation','Teach-back','Concept gap','Recall gap','Procedure error','Misread prompt','Source misuse','Calculation error','Unsupported claim','Confidence mismatch'].map(k=><option key={k}>{k}</option>)}</select></label><label>Source and page / timestamp<input className="input" value={source} maxLength={500} onChange={e=>setSource(e.target.value)}/></label><label>Review date<input className="input" type="date" value={review} onChange={e=>setReview(e.target.value)}/></label></div>{(attempt.trim()||correction.trim())&&<div className="study-mistake-suggestion"><span>Suggested classification: <strong>{suggested.label}</strong> · {suggested.reason}</span><button type="button" onClick={()=>setKind(suggested.label)}>Use suggestion</button></div>}<label>What I learned / next attempt<textarea className="input" maxLength={8000} value={correction} onChange={e=>setCorrection(e.target.value)}/></label><button disabled={lib.blocked} className="portal-primary">Save journal entry</button></form>{(notice||lib.error)&&<p role="status">{lib.error||notice}</p>}<div className="portal-actions"><button onClick={()=>download({name:'Semester study journal.json',body:JSON.stringify(lib.value,null,2),mime:'application/json'})}>Export journal</button><button onClick={()=>dispatch({type:'go',screen:'clocks'})}>Start focus timer</button><button onClick={()=>dispatch({type:'go',screen:'meet'})}>Find academic support</button></div>{lib.value.entries.filter(e=>e.courseId===courseId).map(e=><article className="study-journal-entry" key={e.id}><span className="portal-eyebrow">{e.kind} · {e.resolved?'Reviewed':'Needs review'}</span><h3>{e.topic}</h3><p className="preserve-lines">{e.correction}</p><p>{e.source} · {e.review||'No review date'}</p><details><summary>My original attempt</summary><p className="preserve-lines">{e.attempt}</p></details><div className="portal-actions"><button onClick={()=>lib.update(old=>({...old,entries:old.entries.map(x=>x.id===e.id?{...x,resolved:!x.resolved}:x)}))}>{e.resolved?'Review again':'Mark reviewed'}</button><button onClick={()=>{const from=`study-journal:${e.id}`;if(state.tasks.some(t=>t.from===from)){setNotice('A review task already exists. Edit its date in Tasks.');return;}dispatch({type:'addTask',task:{title:`Review: ${e.topic}`,date:e.review||null,time:'',note:e.correction,courseId:e.courseId,from}});setNotice('Review task added to your semester.');}}>Schedule review task</button><button onClick={()=>dispatch({type:'makeDocument',open:true,doc:{title:`Study reflection · ${e.topic}`,subtitle:'Private learning reflection · Self-reported',courseId:e.courseId,blocks:fromMarkdown(`## My attempt\n${e.attempt}\n\n## What I learned\n${e.correction}\n\n## Source\n${e.source}`)}})}>Continue in Write</button></div></article>)}</details>;
}
