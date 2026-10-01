import { useStore } from '../state/store';
import { readOperating } from '../lib/student-operating';
export function OperatingLauncher() {
  const { state, dispatch } = useStore();
  const w = readOperating(state.operatingWorkspace);
  const next = w.entries.find(e => e.status !== 'done');
  return <section aria-label="Private planning"><button className="pill-soft tap-y" onClick={() => dispatch({ type: 'go', screen: 'work' })}>My operating manual</button>{next && <p>{next.title}: {next.next || 'Choose a first small action'}</p>}</section>;
}
