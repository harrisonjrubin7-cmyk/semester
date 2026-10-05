import { dateToIso } from '../lib/date';
import { goCal } from '../lib/opencal';
import { useStore } from '../state/store';

/**
 * Five ways out of Today, always in this order.
 *
 * A fixed order on purpose. Reordering by what a student taps most would be
 * reading app usage as a preference (command rule 7), and a row that moves is
 * a row nobody can learn. Text on every one; no icon-only control.
 *
 * "Build plan" is the term's schedule — search, cart and saved schedules on
 * Registration. "Prepare for advising" is the degree: it opens My Path until
 * Advisor Meeting Mode (Phase G) gives it an agenda of its own, and the
 * Scenarios tab there already writes an advisor summary. Two different rooms,
 * so no two doors here lead to the same one (`lib/oneroute.test.ts`).
 */
export function QuickActions() {
  const { dispatch } = useStore();
  const items: { label: string; run: () => void }[] = [
    { label: 'Search', run: () => dispatch({ type: 'finder', open: true }) },
    { label: 'Build plan', run: () => dispatch({ type: 'go', screen: 'yes' }) },
    { label: 'Add course', run: () => dispatch({ type: 'go', screen: 'import' }) },
    { label: 'View schedule', run: () => goCal(dispatch, dateToIso(new Date())) },
    { label: 'Prepare for advising', run: () => dispatch({ type: 'go', screen: 'degree' }) },
  ];
  return (
    <section className="quick-actions" aria-label="Quick actions">
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <button type="button" className="quick-action" onClick={item.run}>{item.label}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
