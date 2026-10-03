import { useStore } from '../state/store';
/** Keep planning validation and export logic behind the lazy Work route. */
export function OperatingLauncher() {
  const { dispatch } = useStore();
  return <section aria-label="Private planning"><button className="pill-soft tap-y" onClick={() => dispatch({ type: 'go', screen: 'work' })}>My operating manual</button></section>;
}
