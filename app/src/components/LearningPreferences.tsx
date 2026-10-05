import {useStore} from '../state/store';
import {useDeviceLibrary} from '../lib/device-library';
import {DEFAULT_PREFS,DENSITIES,PREFS_PREFIX,SESSIONS,readPrefs,type Density,type Session} from '../lib/learningprefs';
/** The student's study preferences, on this device. Read by every learning panel; written only here. */
export function useLearningPrefs(){const {account}=useStore();return useDeviceLibrary(`${PREFS_PREFIX}:${account?.id||'device'}`,readPrefs,DEFAULT_PREFS);}
const DENSITY_WORDS:Record<Density,string>={concise:'Concise — hide the evidence behind each concept',standard:'Standard — show how many records back each concept',expanded:'Expanded — list each record and where it came from'};
export function LearningPreferences(){
 const {dispatch}=useStore();const lib=useLearningPrefs();const p=lib.value;
 /* `portal-workspace` for the classless buttons, as on the study journal. */
 return <details className="portal-workspace portal-panel learning-preferences"><summary>Learning preferences</summary><p>How the study views behave for you. These are choices about the tool, not a record about you: they stay on this device and are not shown to anyone. Text size, spacing, motion, plain language and accessibility presets are in Settings and apply everywhere.</p><div className="study-controls"><label>Study sitting<select className="input" value={p.session} onChange={e=>lib.update(old=>({...old,session:Number(e.target.value) as Session}))}>{SESSIONS.map(s=><option key={s} value={s}>{s} minutes</option>)}</select></label><label>Detail on the map<select className="input" value={p.density} onChange={e=>lib.update(old=>({...old,density:e.target.value as Density}))}>{DENSITIES.map(d=><option key={d} value={d}>{DENSITY_WORDS[d]}</option>)}</select></label></div><label><input type="checkbox" checked={p.patterns} onChange={e=>lib.update(old=>({...old,patterns:e.target.checked}))}/> Show me patterns in when I review, in Learning insights</label>{lib.error&&<p role="status">{lib.error}</p>}<div className="portal-actions"><button onClick={()=>dispatch({type:'go',screen:'settings'})}>Display and accessibility settings</button></div></details>;
}
