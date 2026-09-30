import {useState} from 'react';
import {useNow,useStore} from '../state/store';
import {cardIdentity} from '../lib/review';
import {courseLearningInput,learningState} from '../lib/learning-loop';
import {coverage,coverageWords,eveningPattern,forReview} from '../lib/learninginsights';
import {useLearningPrefs} from './LearningPreferences';
/** What the student can see about their own studying — counted from answers, private, never scored. */
export function LearningInsights(){
 const {state,catalog}=useStore();const now=useNow();const prefs=useLearningPrefs().value;const [chosenCourse,setCourseId]=useState('');const courseId=chosenCourse||catalog.courses[0]?.id||'';
 const guide=catalog.guides[courseId];
 const cov=guide?coverage(courseId,guide,state.reviews):[];
 const due=guide?guide.units.flatMap(u=>u.cards).filter(c=>{const r=state.reviews[cardIdentity(courseId,c)];return !!r&&r.due<=now.getTime();}).length:0;
 const review=guide?forReview(learningState(courseLearningInput(courseId,guide,state.reviews,{due,now:now.getTime()}))):[];
 const pattern=prefs.patterns?eveningPattern(state.reviews,ms=>new Date(ms).getHours()):null;
 return <details className="portal-workspace portal-panel learning-insights"><summary>Learning insights{review.length>0?` · ${review.length} to review`:''}</summary><p>What you have studied, by concept, counted from the cards you answered — not from time spent or clicks. This stays on your device. It is not a grade, a prediction or a comparison with anyone.</p><label>Course<select className="input" value={courseId} onChange={e=>setCourseId(e.target.value)}>{catalog.courses.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select></label><section className="portal-panel"><span className="portal-eyebrow">Answered by concept</span>{cov.length>0?<ul>{cov.map(c=><li key={c.unit}>{coverageWords(c)}</li>)}</ul>:<p>No concepts for this course yet.</p>}</section><section className="portal-panel"><span className="portal-eyebrow">Marked for review</span>{review.length>0?<ul>{review.map(n=><li key={n}>{n}</li>)}</ul>:<p>Nothing is marked for review right now.</p>}<p>{due} {due===1?'card is':'cards are'} due.</p></section>{prefs.patterns&&<section className="portal-panel"><span className="portal-eyebrow">A pattern you asked to see</span><p>{pattern??'Nothing to say yet. This appears only once there are enough answers to mean something.'}</p></section>}<p className="portal-muted">Turn patterns on or off in Learning preferences.</p></details>;
}
