import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { ActionButton, Notice, SectionLabel, Segmented } from '../components/ui';
import { NotOfficial } from '../components/NotOfficial';
import { NilExplainer } from '../components/NilExplainer';
import { ComplianceLink } from '../components/ComplianceLink';
import { secondLine } from '../lib/dim';
import { useDeviceLibrary } from '../lib/device-library';
import { download } from '../lib/deliver';
import { money, readMoney } from '../lib/cost';
import { longLabel } from '../lib/date';
import {
  DISCLOSURE_CENTS,
  DISCLOSURE_DAYS,
  EMPTY_NIL,
  NIL_LIMITS,
  aggregate,
  crossings,
  nilKey,
  prompts,
  readNil,
  yearTotal,
  years,
  type Associated,
  type NilDeal,
} from '../lib/nil';

/**
 * What you were paid, what it adds up to, and the date that follows from it.
 *
 * ## The thing this is not, stated first because it is the important half
 *
 * There is no marketplace here, nothing matches anybody to a brand, no money
 * moves, and **nothing on this screen is a verdict.** It does not say a deal
 * is permissible or impermissible, reportable or clear. Those are
 * determinations; they belong to a compliance office and to the review NIL Go
 * runs; and a student acting on a verdict from a study app would find that out
 * at the worst possible moment. The banner says so at the top of the screen,
 * in those words, and does not scroll away behind a fold.
 *
 * What it is: a private notebook with arithmetic in it. A deal you already
 * agreed, written down. A running total per payer per year. A date five
 * business days out, and a task in the app you already use so it is not a date
 * you have to remember. Four pieces of jargon explained in plain words, with
 * where they came from and when they were read. And two links out, to the
 * people and the platform that actually do the thing.
 *
 * ## Why the reminder is an ordinary task
 *
 * Because the app already has a deadline engine, and a second one that only
 * athletes see would be a second set of reminders to get wrong. A crossing
 * produces a `PersonalTask` with a date — which is then on Today, in the week
 * ahead, in the notification rules and in the clash detector, exactly like
 * every other thing this student owes. The `from` marker is
 * `components/BreakItUp.tsx`'s pattern, so pressing it twice does not make two.
 *
 * ## Nothing leaves the device
 *
 * A device library, like Athletics and Family. Not in `state/shape.ts`, so it
 * does not sync, is not in a backup, and leaves only by the export button
 * below. A record of what somebody was paid is not something to put in an
 * account without being asked.
 */
export function Nil() {
  const { account } = useStore();
  const key = nilKey(account?.id);
  return <Workspace key={key} storageKey={key} />;
}

const TABS = [
  { id: 'log' as const, label: 'Deals' },
  { id: 'words' as const, label: 'What it means' },
];

type Tab = (typeof TABS)[number]['id'];

const ASSOCIATED: { id: Associated; label: string }[] = [
  { id: 'no', label: 'Not connected to my school' },
  { id: 'yes', label: 'A collective, booster or school sponsor' },
  { id: 'unsure', label: 'I am not sure' },
];

function Workspace({ storageKey }: { storageKey: string }) {
  const { state, dispatch } = useStore();
  const lib = useDeviceLibrary(storageKey, readNil, EMPTY_NIL);

  const [tab, setTab] = useState<Tab>('log');
  const [date, setDate] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [associated, setAssociated] = useState<Associated>('no');
  const [chosen, setChosen] = useState('');
  const [said, setSaid] = useState('');

  const deals = useMemo(
    () => [...lib.value.deals].sort((a, b) => b.date.localeCompare(a.date)),
    [lib.value.deals],
  );
  const due = useMemo(() => crossings(lib.value.deals), [lib.value.deals]);
  const selected = deals.find((d) => d.id === chosen) ?? null;

  const line = {
    fontSize: 'var(--type-sm)',
    ...secondLine(),
    lineHeight: 'var(--leading-normal)',
    textWrap: 'pretty',
  } as const;

  const add = () => {
    const cents = readMoney(amount);
    if (cents === null) {
      setSaid('Enter the amount as a number — 600, or 1,250.50.');
      return;
    }
    if (!/^\d{4}-\d\d-\d\d$/.test(date)) {
      setSaid('Give the date you agreed it. That is the day the five business days start from.');
      return;
    }
    if (!counterparty.trim()) {
      setSaid('Name who is paying. The total is counted per payer, so the name is what groups them.');
      return;
    }
    if (lib.value.deals.length >= NIL_LIMITS.deals) {
      setSaid(`That is ${NIL_LIMITS.deals} deals, which is as many as this holds.`);
      return;
    }
    const deal: NilDeal = {
      id: crypto.randomUUID(),
      date,
      counterparty: counterparty.trim().slice(0, NIL_LIMITS.counterparty),
      cents,
      description: description.trim().slice(0, NIL_LIMITS.description),
      associated,
      reported: false,
    };
    if (lib.update((old) => ({ ...old, deals: [...old.deals, deal] }))) {
      setAmount('');
      setDescription('');
      setChosen(deal.id);
      setSaid('Recorded on this device.');
    }
  };

  /**
   * The reminder, as an ordinary task on an ordinary date.
   *
   * `from` is the marker, so pressing this twice for the same crossing does
   * not make two tasks — `components/BreakItUp.tsx` learned that matching on
   * the title instead breaks the moment somebody renames one.
   */
  const remind = (c: (typeof due)[number]) => {
    const from = `nil:${c.deal.id}`;
    if (state.tasks.some((t) => t.from === from)) {
      setSaid('That reminder is already on your list. Its date is editable under Tasks.');
      return;
    }
    dispatch({
      type: 'addTask',
      task: {
        title: `Report ${c.counterparty} NIL deal to your compliance office`,
        date: c.due,
        time: '',
        note: [
          `Your record shows ${money(c.cents)} from ${c.counterparty} in ${c.year}, at or above the $600 threshold.`,
          `${DISCLOSURE_DAYS} business days from ${c.deal.date} is ${c.due}, counting weekdays only — a holiday could make the real date earlier, so treat this as the latest it could be.`,
          'Submission happens at NIL Go, not in this app. Your compliance office is the place to confirm what and when.',
        ].join('\n\n'),
        courseId: null,
        from,
      },
    });
    setSaid('Added to your tasks, so it shows up on Today like everything else you owe.');
  };

  const thisYear = years(lib.value.deals)[0] ?? String(new Date().getFullYear());

  return (
    <Page>
      <NotOfficial>
        A private record on this device. It works out dates and totals from what you type in; it does
        not decide whether a deal is allowed, whether it has to be reported, or whether you are
        eligible. Nothing here is submitted anywhere.
      </NotOfficial>

      <Segmented
        options={TABS.map((t) => ({
          id: t.id,
          label: t.id === 'log' && deals.length > 0 ? `${t.label} (${deals.length})` : t.label,
        }))}
        value={tab}
        onChange={setTab}
        style={{ marginBlock: 'var(--sp-5)' }}
      />

      {(said || lib.error) && <Notice>{lib.error || said}</Notice>}

      {tab === 'words' && <NilExplainer />}

      {tab === 'log' && (
        <>
          {due.length > 0 && (
            <>
              <SectionLabel style={{ marginBlock: 'var(--sp-5) var(--sp-3)' }}>
                At or above $600
              </SectionLabel>
              <p style={{ ...line, marginBlock: 0 }}>
                Counted per payer, per calendar year. Confirm with your compliance office how yours
                counts it — the plain total for {thisYear} is {money(yearTotal(lib.value.deals, thisYear))}.
              </p>
              {due.map((c) => (
                <div
                  key={c.deal.id}
                  style={{ borderBottom: '1px solid var(--app-line)', paddingBlock: 'var(--sp-4)' }}
                >
                  <p
                    style={{
                      fontSize: 'var(--type-base)',
                      lineHeight: 'var(--leading-normal)',
                      marginBlock: 0,
                      textWrap: 'pretty',
                    }}
                  >
                    {c.counterparty} · {money(c.cents)} in {c.year}
                  </p>
                  <p style={{ ...line, marginBlock: 'var(--sp-2) 0' }}>
                    {DISCLOSURE_DAYS} business days from {c.deal.date} is{' '}
                    {longLabel(new Date(`${c.due}T12:00`))} — weekdays only, so go earlier.
                  </p>
                  <ActionButton onClick={() => remind(c)} style={{ marginTop: 'var(--sp-3)' }}>
                    Add the reminder
                  </ActionButton>
                </div>
              ))}
            </>
          )}

          <SectionLabel
            aside={deals.length > 0 ? money(yearTotal(lib.value.deals, thisYear)) : undefined}
            style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}
          >
            Your record
          </SectionLabel>
          {deals.length === 0 ? (
            <p style={{ fontSize: 'var(--type-base)', ...secondLine(), lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
              Nothing recorded. A deal takes a minute to write down, and the reason to do it on the
              day is that the clock starts when you agree it rather than when you are paid.
            </p>
          ) : (
            deals.map((d) => (
              <button
                key={d.id}
                type="button"
                className="bare tappable"
                onClick={() => setChosen(chosen === d.id ? '' : d.id)}
                style={{
                  display: 'block',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--app-line)',
                  paddingBlock: 'var(--sp-4)',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--type-base)',
                    lineHeight: 'var(--leading-normal)',
                  }}
                >
                  {d.counterparty} · {money(d.cents)}
                </span>
                <span style={{ display: 'block', ...line }}>
                  {d.date} · {aggregate(lib.value.deals, d.counterparty, d.date.slice(0, 4)) >= DISCLOSURE_CENTS
                    ? 'payer at or above $600 this year'
                    : 'payer below $600 this year'}
                  {d.reported ? ' · you marked it reported' : ''}
                </span>
              </button>
            ))
          )}

          {selected && (
            <>
              <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>
                Worth asking about
              </SectionLabel>
              <p style={{ ...line, marginBlock: 0 }}>
                Questions, with your own answers read back. None of them is a finding — they are the
                things to put in front of a person who can actually answer them.
              </p>
              {prompts(selected, lib.value.deals).map((p) => (
                <div key={p.ask} style={{ paddingBlock: 'var(--sp-4)', borderBottom: '1px solid var(--app-line)' }}>
                  <p
                    style={{
                      fontSize: 'var(--type-base)',
                      lineHeight: 'var(--leading-normal)',
                      marginBlock: 0,
                      textWrap: 'pretty',
                    }}
                  >
                    {p.ask}
                  </p>
                  <p style={{ ...line, marginBlock: 'var(--sp-2) 0' }}>
                    {p.says}
                    {p.points ? ' — one to raise sooner rather than later.' : ''}
                  </p>
                </div>
              ))}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
                <ActionButton
                  onClick={() =>
                    lib.update((old) => ({
                      ...old,
                      deals: old.deals.map((x) => (x.id === selected.id ? { ...x, reported: !x.reported } : x)),
                    }))
                  }
                  style={{ flex: '1 1 auto' }}
                >
                  {selected.reported ? 'Not reported after all' : 'I have reported this'}
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    lib.update((old) => ({ ...old, deals: old.deals.filter((x) => x.id !== selected.id) }));
                    setChosen('');
                  }}
                  style={{ flex: '1 1 auto' }}
                >
                  Delete
                </ActionButton>
              </div>
            </>
          )}

          <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>Record a deal</SectionLabel>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <fieldset disabled={lib.blocked} style={{ border: 0, padding: 0, minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                <label style={{ flex: '1 1 150px' }}>
                  <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Date you agreed it</span>
                  <input
                    className="input"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                  />
                </label>
                <label style={{ flex: '1 1 110px' }}>
                  <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Amount</span>
                  <input
                    className="input"
                    required
                    inputMode="decimal"
                    placeholder="600"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                  />
                </label>
              </div>
              <label style={{ display: 'block', marginTop: 'var(--sp-5)' }}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Who is paying</span>
                <input
                  className="input"
                  required
                  maxLength={NIL_LIMITS.counterparty}
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                />
              </label>
              <label style={{ display: 'block', marginTop: 'var(--sp-5)' }}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Where the money comes from</span>
                <select
                  className="input"
                  value={associated}
                  onChange={(e) => setAssociated(e.target.value as Associated)}
                  style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                >
                  {ASSOCIATED.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'block', marginBlock: 'var(--sp-5)' }}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
                  What they are buying — the posts, the appearance, the camp
                </span>
                <textarea
                  className="input"
                  rows={3}
                  maxLength={NIL_LIMITS.description}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                />
              </label>
              <button type="submit" className="btn btn-primary btn-block">
                Record it
              </button>
            </fieldset>
          </form>

          <ComplianceLink />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
            <ActionButton
              onClick={() =>
                download({
                  name: 'Semester NIL record.json',
                  body: JSON.stringify(lib.value, null, 2),
                  mime: 'application/json',
                })
              }
              style={{ flex: '1 1 auto' }}
            >
              Export your record
            </ActionButton>
            {lib.blocked && (
              <ActionButton
                onClick={() => download({ name: 'NIL recovery.json', body: lib.recovery(), mime: 'application/json' })}
                style={{ flex: '1 1 auto' }}
              >
                Download recovery copy
              </ActionButton>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
