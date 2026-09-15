import {CampusDirectory, MealPlanner} from '../components/CampusDirectory';
import { useMemo, useState } from 'react';
import { secondLine } from '../lib/dim';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { CustomRow, Group } from '../components/shell/Rows';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, TabList } from '../components/ui';
import { TermSwitch } from '../components/TermSwitch';
import { CAMPUS_LINKS } from '../data/campus';
import { readTerm } from '../lib/term';
import { termEnds as lastDayOfTerm } from '../lib/registrar';
import { isoToDate } from '../lib/date';
import {
  cashLine,
  forTerm,
  money,
  pace,
  paceLine,
  readMoney,
  readSwipes,
  staleLine,
} from '../lib/meals';

/**
 * Swipes, Commodore Cash, and the week they run out.
 *
 * CBORD GET shows a balance. It does not say what the balance means, which is
 * the only thing anybody wants to know — forty-one swipes and twenty-three
 * days left is 1.8 a day, and if you have been eating 2.4 you run dry on the
 * 14th of November. Nobody does that in their head, so people find out by
 * being declined at a register in the last fortnight of term.
 *
 * The site is behind single sign-on and publishes no API a student can use,
 * so there is nothing to read even in principle without holding somebody's
 * university credentials — which this app will never do. You tap through,
 * read two numbers, and type them back. Ten seconds a week.
 *
 * The rate needs two readings, which is why this logs rather than overwrites:
 * one balance is a fact about today and says nothing about eating.
 */
export function Meals() {
 const {state}=useStore();
 const [tab,setTab]=useState('mine');const [choice,setChoice]=useState('');
 return <div className="portal-workspace campus-workspace"><TabList label="Meals portal" className="portal-tabs" value={tab} onChange={id=>{setChoice('');setTab(id);}} tabs={([['mine','My meal plan'],['directory','Dining & meal plans'],['plan','Plan calculator']] as [typeof tab,string][]).map(([id,label])=>({id,label}))}/>{tab==='mine'?<MealsDetails key={state.term}/>:tab==='directory'?<CampusDirectory kind="dining" onPlan={item=>{setChoice(item.name);setTab('plan');}}/>:<MealPlanner key={state.term} choice={choice} term={state.term}/>}</div>;
}
function MealsDetails() {
  const { state, dispatch, now, school } = useStore();

  const [swipes, setSwipes] = useState('');
  const [cash, setCash] = useState('');
  const [dining, setDining] = useState('');
  const [bad, setBad] = useState('');

  const mine = useMemo(() => forTerm(state.balances, state.term), [state.balances, state.term]);
  const latest = mine[0];

  // The term's last day, from the registrar sheet if it has been filled in.
  const termEnds = useMemo(() => {
    const iso = lastDayOfTerm(state.registrar);
    return iso ? isoToDate(iso) : null;
  }, [state.registrar]);

  const p = useMemo(() => pace(mine, termEnds, now), [mine, termEnds, now]);
  const link =
    state.linkUrls.cbord || CAMPUS_LINKS.find((l) => l.id === 'cbord')?.url || '';

  const log = () => {
    const n = readSwipes(swipes);
    const c = readMoney(cash || '0');
    const d = dining.trim() ? readMoney(dining) : -1;
    if (swipes.trim() && n === null) {
      setBad('Swipes has to be a whole number, or left blank for a plan without them.');
      return;
    }
    if (c === null || d === null) {
      setBad('That is not an amount the app can read. Try 42.50, or $42.50.');
      return;
    }
    if (!swipes.trim() && !cash.trim() && !dining.trim()) {
      setBad('Nothing to log yet.');
      return;
    }
    dispatch({
      type: 'logBalance',
      balance: {
        at: Date.now(),
        swipes: n ?? -1,
        cashCents: c,
        diningCents: d,
        term: state.term,
      },
    });
    setSwipes('');
    setCash('');
    setDining('');
    setBad('');
  };

  return (
    <Page className="campus-personal" bottom={26} folds={false}>
      <TermSwitch /><div className="portal-stats"><div><strong>{latest&&latest.swipes>=0?latest.swipes:'—'}</strong><span>Meal swipes recorded</span></div><div><strong>{latest?money(latest.cashCents):'—'}</strong><span>Campus cash recorded</span></div><div><strong>{latest&&latest.diningCents>=0?money(latest.diningCents):'—'}</strong><span>Dining dollars recorded</span></div></div><p className="portal-muted">Balances are your saved readings, not a live account balance. Use the official balance page to check or change your enrolled plan.</p>

      <Blueprint style={{ padding: '15px 16px', marginTop: 'var(--sp-6)' }}>
        <div className="kicker">{readTerm(state.term).label}</div>
        <div
          className="chrome-text"
          style={{ fontSize: 'calc(21px * var(--text-scale, 1))', lineHeight: 1.25, marginTop: 'var(--sp-3)', textWrap: 'pretty' }}
        >
          {paceLine(latest, p)}
        </div>
        {cashLine(latest) ? (
          <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.75, marginTop: 'var(--sp-4)' }}>{cashLine(latest)}</div>
        ) : null}
        {latest ? (
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 'var(--sp-3)' }}>{staleLine(latest, now)}</div>
        ) : null}
      </Blueprint>

      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-block"
          style={{
            height: 46,
            marginTop: 'var(--sp-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Open the balance page →
        </a>
      ) : null}

      {/*
        What the school says a plan holds, against what you have left.
        `SchoolData.mealPlanTiers` was in the profile and read by nothing;
        here it is the one number the balance page never shows you — where
        you started — so "forty-one swipes" can mean something. Absent for
        Vanderbilt, and absent means no heading rather than an empty one.
      */}
      {(school.data.mealPlanTiers ?? []).length > 0 && (
        <>
          <SectionLabel>What {school.shortName || school.name} publishes</SectionLabel>
          <div style={{ fontSize: 'var(--type-sm)', ...secondLine(), marginBottom: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
            The plans as your school lists them, not your balance. Yours is whichever one you are
            enrolled in — the balance page above is the only place that knows which, and the one to
            check these counts against.
          </div>
          <Group framed={false}>
            {(school.data.mealPlanTiers ?? []).map((tier) => (
              <CustomRow key={tier.name}>
                <div style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'baseline' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)' }}>{tier.name}</span>
                  <span style={{ flex: 'none', fontSize: 'var(--type-xs)', ...secondLine() }}>
                    {[
                      tier.swipes > 0
                        ? `${tier.swipes} ${school.capabilities.swipeUnit || 'swipes'}`
                        : '',
                      tier.dollars > 0 ? money(tier.dollars * 100) : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {tier.period === 'week' ? ' a week' : ' a term'}
                  </span>
                </div>
              </CustomRow>
            ))}
          </Group>
        </>
      )}

      <SectionLabel>Log what it says</SectionLabel>
      <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, marginBottom: 9, lineHeight: 'var(--leading-relaxed)' }}>
        Leave a field blank if your plan does not have it. Two readings a few days apart is what
        turns a balance into a rate.
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
        <input
          className="input"
          value={swipes}
          aria-label="Meal swipes left"
          placeholder="Swipes"
          inputMode="numeric"
          onChange={(e) => setSwipes(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <input
          className="input"
          value={cash}
          aria-label="Commodore Cash"
          placeholder="Cash"
          inputMode="decimal"
          onChange={(e) => setCash(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <input
          className="input"
          value={dining}
          aria-label="Meal money"
          placeholder="Meal $"
          inputMode="decimal"
          onChange={(e) => setDining(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>

      {bad ? (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-warn)', marginBottom: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
          {bad}
        </div>
      ) : null}

      <button type="button" className="btn btn-secondary btn-block" onClick={log} style={{ height: 42 }}>
        Log it
      </button>

      {!termEnds && (
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'registrar' })}
          style={{ height: 38, marginTop: 'var(--sp-4)', fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
        >
          Set the term's last day, and the app can say what a balance is a day
        </button>
      )}

      {mine.length > 0 && (
        <Group header="What you have logged" framed={false}>
          {mine.map((r) => (
            <CustomRow key={r.id} pad={9}>
              <div style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'baseline' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)' }}>
                {new Date(r.at).toLocaleDateString()}
              </span>
              <span style={{ flex: 'none', fontSize: 'var(--type-base)', fontVariantNumeric: 'tabular-nums' }}>
                {r.swipes >= 0 ? `${r.swipes} swipes` : '—'}
                {r.cashCents > 0 ? ` · ${money(r.cashCents)}` : ''}
              </span>
              <button
                type="button"
                className="bare"
                aria-label="Remove this reading"
                onClick={() => dispatch({ type: 'dropBalance', id: r.id })}
                style={{ flex: 'none', width: 24, opacity: 0.4, fontSize: 'var(--type-md)' }}
              >
                ×
              </button>
              </div>
            </CustomRow>
          ))}
        </Group>
      )}

      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 14, lineHeight: 'var(--leading-normal)' }}>
        Nothing is fetched. The balance page is behind single sign-on and publishes no interface a
        student can use, so reading it would mean holding your university credentials — which this
        app will not do. The app reports a rate and a date and stops; it has no idea whether you
        are eating out, at home, or skipping meals, and a nudge about any of those would be both
        wrong and none of its business.
      </div>
    </Page>
  );
}
