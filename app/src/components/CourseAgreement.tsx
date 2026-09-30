import {useState} from 'react';
import {useStore} from '../state/store';
import {courseCode,courseLayers,useCoursePublications} from '../lib/courserules';
import {HEADINGS,RESPONSIBILITY,agreementLines,summary,type Bucket} from '../lib/agreement';
const ORDER:Bucket[]=['may','disclose','required','not','unknown'];
/** One course's agreement: what Semester may be used for, on whose word. Reads policy; holds none. */
export function CourseAgreement(){
 const {state,account,dispatch,catalog}=useStore();const [chosenCourse,setCourseId]=useState('');const courseId=chosenCourse||catalog.courses[0]?.id||'';
 const course=catalog.courses.find(c=>c.id===courseId);
 const published=useCoursePublications(catalog.courses.map(c=>c.code),state.term,!!account);
 const pub=published[courseCode(course?.code??'')];
 const lines=agreementLines(courseLayers(course?.code??'',course?.ai,published));
 const rules=pub?.rules?.link;
 return <details className="portal-workspace portal-panel course-agreement"><summary>Course agreement</summary><p>What Semester may be used for in a course, and whose word that is. Your instructor’s published rules come first; where they are silent it uses your own record of the syllabus; where nothing is on file it says so and never assumes yes.</p><label>Course<select className="input" value={courseId} onChange={e=>setCourseId(e.target.value)}>{catalog.courses.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select></label><p role="status">{summary(lines)}</p>{ORDER.map(b=>{const rows=lines.filter(l=>l.bucket===b);return rows.length>0&&<section className="portal-panel" key={b}><span className="portal-eyebrow">{HEADINGS[b]}</span><ul>{rows.map(l=><li key={l.use}>{b==='may'?'✓ ':b==='not'?'✗ ':''}{l.label}{l.by?` — ${l.by}`:''}</li>)}</ul></section>;})}{pub?.guidance&&<section className="portal-panel"><span className="portal-eyebrow">From your instructor · published {pub.guidance.published}</span><p className="preserve-lines">{pub.guidance.body}</p></section>}{pub&&pub.packs.length>0&&<p>{pub.packs.length} approved source {pub.packs.length===1?'pack':'packs'} published for this course.</p>}<section className="portal-panel"><span className="portal-eyebrow">Always true</span><ul>{RESPONSIBILITY.map(r=><li key={r}>{r}</li>)}</ul></section>{rules&&/^https:\/\//.test(rules)&&<p><a href={rules} target="_blank" rel="noreferrer noopener">Read the policy in its own words</a></p>}<div className="portal-actions"><button onClick={()=>dispatch({type:'go',screen:'meet'})}>Find academic support</button></div></details>;
}
