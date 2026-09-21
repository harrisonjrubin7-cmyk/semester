import { useStore } from '../state/store';
import { secondLine } from '../lib/dim';
import { ActionButton } from './ui';
import { useDeviceLibrary } from '../lib/device-library';
import { EMPTY_NIL, nilKey, readNil, yearTotal } from '../lib/nil';
import { money } from '../lib/cost';

/**
 * The sentence nobody says to a nineteen-year-old until April.
 *
 * NIL money arrives with nothing withheld. It is not a wage: there is no W-2,
 * no employer taking payroll tax out, and — for most athletes — a 1099-NEC in
 * January for money that was spent in March. The bill is income tax *plus*
 * self-employment tax on the same dollars, and the federal system expects it
 * in quarterly instalments rather than in one go the following spring.
 *
 * None of that is obscure, and none of it is on any screen a student-athlete
 * looks at. So it is on this one, where the rest of their money already is.
 *
 * ## What it is careful not to be
 *
 * **It is not tax advice and does not compute a liability.** No rate, no
 * estimate, no "set aside 30%", no quarterly amount. What somebody owes
 * depends on their other income, whether they are claimed as a dependent,
 * their state, their deductible expenses and the year's thresholds — five
 * things this app does not know and has no business guessing at. A figure
 * here would be relied on, and being relied on is precisely what it could not
 * survive.
 *
 * `lib/cost.ts` refuses to fetch a textbook price for a smaller version of the
 * same reason: a wrong number shown confidently is worse than a blank field.
 *
 * What it does instead is say the shape of the thing — this is usually
 * self-employment income, it usually arrives on a 1099-NEC, the system usually
 * wants instalments — and point at the people who answer it: a tax
 * professional, and the free filing help most universities run.
 *
 * ## Why it shows the total
 *
 * Because "plan for taxes" with no number attached is advice nobody acts on,
 * and the student's own recorded total is a number this app is entitled to
 * show them: they typed it in. It is what they logged, said as what they
 * logged, with no rate applied to it.
 */
export function NilTaxNote() {
  const { account, dispatch } = useStore();
  const nil = useDeviceLibrary(nilKey(account?.id), readNil, EMPTY_NIL);

  const year = String(new Date().getFullYear());
  const total = yearTotal(nil.value.deals, year);

  // Nothing recorded means nothing to say. A permanent note about tax on
  // income somebody does not have is the kind of thing people scroll past
  // until they scroll past the one that matters.
  if (nil.value.deals.length === 0) return null;

  return (
    <div
      style={{
        border: '1px solid var(--app-line)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-5)',
        marginBlock: 'var(--sp-5)',
      }}
    >
      <p
        style={{
          fontSize: 'var(--type-base)',
          lineHeight: 'var(--leading-normal)',
          marginBlock: 0,
          textWrap: 'pretty',
        }}
      >
        You have {money(total)} of NIL money recorded for {year}, and none of it has had tax taken
        out of it.
      </p>
      <p
        style={{
          fontSize: 'var(--type-sm)',
          ...secondLine(),
          lineHeight: 'var(--leading-normal)',
          marginBlock: 'var(--sp-3) 0',
          textWrap: 'pretty',
        }}
      >
        NIL income is generally self-employment income rather than a wage — usually reported to you
        on a 1099-NEC, usually owing self-employment tax as well as income tax, and usually expected
        in quarterly estimated payments rather than all at once the following April. This app does
        not work out what you owe and is not tax advice: that depends on your other income, whether
        somebody claims you as a dependent, your state and your expenses. A tax professional, or the
        free filing help most universities run, is the place to take it.
      </p>
      <ActionButton onClick={() => dispatch({ type: 'go', screen: 'nil' })} style={{ marginTop: 'var(--sp-4)' }}>
        Open your NIL record
      </ActionButton>
    </div>
  );
}
