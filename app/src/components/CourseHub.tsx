import { StudyStudio } from './StudyStudio';
import { TabList } from './ui';
import { draftFor } from '../lib/mail';
import {useState,type ReactNode} from 'react';
import { useNow, useStore } from '../state/store';
import {useLive} from '../lib/live';
import {modesFor} from '../lib/modes';
import {datedItems} from '../lib/select';
import {inView,split,standingOf,type AssignmentView} from '../lib/standing';
import {nameFor} from '../lib/yours';
import {DeadlineRow} from './DeadlineRow';
import {type Course} from '../lib/types';
import {ForThis} from './ForThis';
import {ContextBar} from './unity/ContextBar';
import {SourceLocker} from './SourceLocker';
import { accepts } from '../lib/degree';
import {StudyReadiness} from './StudyReadiness';
import {CourseSkills} from './CourseSkills';
import {MODULE_FLAGS,moduleOn} from '../lib/experience-flags';
/**
 * `readiness` and `locker` default to the `study_readiness` and
 * `source_locker` flags (Phase H); each adds one tab. `careerEvidence`
 * (Phase I) adds the course's suggested skills to the overview. Tests choose.
 */
export function CourseHub({course,information,readiness=moduleOn(MODULE_FLAGS.study_readiness),locker=moduleOn(MODULE_FLAGS.source_locker),careerEvidence=moduleOn(MODULE_FLAGS.career_evidence)}:{course:Course;information:ReactNode;readiness?:boolean;locker?:boolean;careerEvidence?:boolean}){
 const {state,dispatch,catalog}=useStore();const now=useNow();const live=useLive(course.id);const modes=modesFor(catalog,course.id,live);
 const [studio,setStudio]=useState(false);const [tab,setTab]=useState('overview');const [filter,setFilter]=useState('upcoming');const [query,setQuery]=useState('');
 const all=datedItems(catalog,now).filter(i=>i.c===course.id);const groups=split(all,state.done);const next=groups.ahead[0];
 const matches=(text:string)=>text.toLowerCase().includes(query.trim().toLowerCase());
 const assignments=all.filter(i=>matches(`${i.title} ${i.kind} ${i.detail}`)).filter(i=>inView(filter as AssignmentView,i,state.done));
 const readingItems=all.filter(i=>/read/i.test(i.kind));
 const ready=modes.filter(m=>m.ready);
 // Imported is the one test of whose course this is — the same one `ShareCourse` uses. A sample course is not the student's, whatever the rest of the semester is.
 const imported=state.courses.some(m=>m.course.id===course.id);const updates=state.updates.filter(u=>u.courseId===course.id);
 if(studio)return <StudyStudio courseId={course.id} onClose={()=>setStudio(false)}/>;
 return <div className="course-hub portal-workspace"><header className="course-banner"><ContextBar heading={2} context={`${course.code} · ${state.term}`} title={nameFor(course,state.yours)} statuses={[imported?'made':'sample']} source={{title:course.code,origin:imported?'made':'sample',sourceName:course.source,owner:course.prof||undefined,usedIn:['Deadlines','Study guide'],relationships:[...all.map(item=>item.title),...updates.map(update=>update.title)]}} primary={{label:'Continue studying →',run:()=>dispatch({type:'openGuide',id:course.id})}} secondary={{label:'+ Add reading',run:()=>dispatch({type:'openUpdate',courseId:course.id,unit:null})}}>{course.email&&<button type="button" className="btn btn-ghost" onClick={()=>dispatch({type:'writeMail',draft:draftFor('question',{course})})}>Email instructor</button>}</ContextBar><p>{course.prof||'Instructor not provided'} · {course.meets||'Schedule not provided'}{course.room?` · ${course.room}`:''}</p></header><TabList label="Course workspace" className="portal-tabs" value={tab} onChange={id=>{setTab(id);setQuery('');}} tabs={([['overview','Overview'],['assignments','Assignments'],['study','Study tools'],...(readiness?[['readiness','Readiness']]:[]),['readings','Readings & materials'],...(locker?[['locker','Sources']]:[]),['information','Syllabus & class info']] as [typeof tab,string][]).map(([id,label])=>({id,label}))}/>
 {tab==='overview'&&<><div className="portal-stats"><button onClick={()=>{setTab('assignments');setFilter('upcoming');}}><strong>{groups.ahead.length}</strong><span>Upcoming</span></button><button onClick={()=>{setTab('assignments');setFilter('past');}}><strong>{groups.overdue.length}</strong><span>Past due · unresolved</span></button><button onClick={()=>{setTab('assignments');setFilter('completed');}}><strong>{groups.done.length}</strong><span>Completed</span></button><button onClick={()=>setTab('study')}><strong>{ready.length}</strong><span>Study modes ready</span></button></div><div className="portal-columns"><section className="portal-panel"><h3>What’s next</h3>{next?<><DeadlineRow item={next} tone="ahead"/><ForThis item={next}/></>:<p>No upcoming deadlines are recorded for this course.</p>}<button className="workspace-text-button" onClick={()=>setTab('assignments')}>View all assignments →</button></section><section className="portal-panel"><h3>Start a study session</h3><p>{live.guide.blurb||'Review the material from your course.'}</p>{ready.slice(0,3).map(m=><button className="portal-link-row" key={m.id} onClick={()=>dispatch({type:'openGuide',id:course.id,mode:m.id})}><span><strong>{m.label}</strong><small>{m.count}</small></span><span>→</span></button>)}{!ready.length&&<button className="workspace-text-button" onClick={()=>dispatch({type:'openUpdate',courseId:course.id,unit:null})}>Add material to create study activities</button>}</section></div></>}
 {tab==='assignments'&&<section className="portal-panel"><div className="portal-filter-row"><label className="portal-search"><input type="search" aria-label="Search course assignments" placeholder="Search assignments, exams and readings" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Assignment status" value={filter} onChange={e=>setFilter(e.target.value)}><option value="upcoming">Upcoming</option><option value="past">Past</option><option value="completed">Completed</option><option value="all">All assignments</option></select></div><p className="portal-muted">{assignments.length} items · Open an item for its instructions, source, study plan and attached work.</p>{assignments.map(i=><DeadlineRow key={i.id} item={i} tone={standingOf(i,state.done)}/>)}{!assignments.length&&<p role="status">No assignments match this view.</p>}</section>}
 {tab==='study'&&<><section className="assignment-next"><div><strong>Create your study guide</strong><p>Choose from 11 formats, select sources, and adjust the level and length.</p></div><button className="portal-primary" onClick={()=>setStudio(true)}>Open study studio →</button></section><h3>Every way to study this course</h3><div className="portal-card-grid">{modes.map(m=><button className="portal-panel portal-mode" key={m.id} onClick={()=>dispatch({type:'openGuide',id:course.id,mode:m.id})}><strong>{m.label}</strong><p>{m.blurb}</p><span className={m.ready?'portal-tag':'portal-muted'}>{m.ready?m.count:m.missing||'Add material to get started'}</span></button>)}</div><h3>Course units</h3>{live.guide.units.map((u,index)=><button className="portal-link-row" key={`${u.name}-${index}`} onClick={()=>dispatch({type:'openGuide',id:course.id,unit:index,mode:'read'})}><span><strong>{u.name}</strong><small>{u.cards.length} cards</small></span><span>Open →</span></button>)}</>}
 {tab==='readings'&&<section className="portal-panel"><label className="portal-search"><input type="search" aria-label="Search course materials" placeholder="Search readings and uploaded material" value={query} onChange={e=>setQuery(e.target.value)}/></label><h3>Assigned readings</h3>{readingItems.filter(i=>matches(i.title)).map(i=><DeadlineRow key={i.id} item={i} tone={standingOf(i,state.done)}/>)}{!readingItems.length&&<p>No reading deadlines have been imported.</p>}<h3>Added materials</h3>{updates.filter(u=>matches(`${u.title} ${u.source}`)).map(u=><details className="portal-material" key={u.id}><summary><strong>{u.title}</strong><small>{u.source||'Added to this course'} · {u.cards.length} study cards</small></summary><p>{u.body||'This material has been organized into the course study guide.'}</p><button onClick={()=>dispatch({type:'openGuide',id:course.id,mode:'read',...(u.unit!==null?{unit:u.unit}:{})})}>Study this material →</button></details>)}{!updates.length&&<p>Add lecture notes, readings or handouts to keep them with this course.</p>}<button className="portal-primary" onClick={()=>dispatch({type:'openUpdate',courseId:course.id,unit:null})}>+ Add course material</button></section>}
 {tab==='overview'&&<details className="portal-panel"><summary>Relationship map</summary><ul aria-label="Course relationships">
 <li>{course.code} · {state.term}<ul>
 <li><button type="button" onClick={()=>setTab('information')}>Syllabus and course information</button></li>
 <li>Deadlines<ul>{all.map(item=><li key={item.id}><button type="button" onClick={()=>dispatch({type:'openItem',id:item.id})}>{item.title}</button></li>)}{!all.length&&<li>No deadlines recorded</li>}</ul></li>
 <li>Added material<ul>{updates.map(update=><li key={update.id}><button type="button" onClick={()=>setTab('readings')}>{update.title}</button></li>)}{!updates.length&&<li>No added material</li>}</ul></li>
 <li>Recorded requirement connections<ul>{state.requirements.filter(requirement=>accepts(requirement,course)).map(requirement=><li key={requirement.id}><button type="button" onClick={()=>dispatch({type:'go',screen:'degree'})}>{requirement.programme} · {requirement.name}</button> · Student recorded</li>)}</ul></li>
 <li><button type="button" onClick={()=>dispatch({type:'go',screen:'meet'})}>Prepare advisor questions about this course</button></li>
 </ul></li></ul><p>Only recorded connections are shown. Your advisor confirms whether a course satisfies a requirement.</p></details>}
 {tab==='overview'&&careerEvidence&&<CourseSkills course={course}/>}
 {tab==='readiness'&&readiness&&<StudyReadiness course={course}/>}
 {tab==='locker'&&locker&&<SourceLocker course={course}/>}
 {tab==='information'&&<><div className="portal-panel"><h3>Syllabus source</h3><p>{course.source||'No syllabus source recorded.'}</p><p className="portal-muted">Assignment details contain the original syllabus quotations and available page references. Course information below includes grading, office hours, attendance and the LMS link.</p></div>{information}</>}
 </div>;
}
