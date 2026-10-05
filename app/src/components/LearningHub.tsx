import {Suspense,lazy,useEffect,useRef,useState} from 'react';
import {peek} from '../lib/learningintent';
const LearningPanels=lazy(()=>import('./LearningPanels').then(m=>({default:m.LearningPanels})));
/**
 * One closed Learning row on Study, holding six panels.
 *
 * The panels are loaded the first time the row is opened rather than with
 * Study. They came to about 6.8 KB gzipped, which took Study from 84.4 KB to
 * 91.2 KB to open against a budget of 89.0 KB (`perf-budgets.json`) — for a row
 * that is closed until asked for, and that most students will not open on a
 * given day. Once opened they stay mounted, so closing the row keeps what a
 * student was typing and which course they had picked.
 *
 * Each panel is still its own panel with its own private store; this only
 * decides where they sit and when they arrive. `portal-workspace` for the same
 * reason as the panels inside it: classless buttons are styled by that scope.
 */
export function LearningHub(){
 const [wanted]=useState(()=>peek('feedback')!==null);
 const [opened,setOpened]=useState(wanted);const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{if(wanted)ref.current?.scrollIntoView?.({block:'start'});},[wanted]);
 return <details ref={ref} open={wanted||undefined} className="portal-workspace portal-panel learning-hub" onToggle={e=>{if(e.currentTarget.open)setOpened(true);}}><summary>Learning</summary><p>Your concepts and start-here check, feedback you received, what each course allows, what you have covered, a list to bring to office hours, and how you like to study. All of it stays on this device.</p>{opened&&<Suspense fallback={<p role="status">Opening your learning tools…</p>}><LearningPanels/></Suspense>}</details>;
}
