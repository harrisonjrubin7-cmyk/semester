import { useEffect, useMemo, useRef, useState } from 'react';
import { useNow, useStore } from '../state/store';
import { Page } from '../components/Page';
import { ActionButton, EmptyState, Notice, Segmented, TabList, Toggle } from '../components/ui';
import { CustomRow, Group } from '../components/shell/Rows';
import { SourceBadge } from '../components/SourceBadge';
import { AMOUNT, META, NOTE, ROW, WHAT } from '../components/rowparts';
import { useConfirm } from '../components/ConfirmDialog';
import { Counter } from '../components/dining/Counter';
import { formatDate, formatTime } from '../lib/locale';
import { IntentKeys } from '../lib/idempotency';
import { clock, menuToday, openAt, type DiningLocation, type HoursWindow } from '../lib/dining/locations';
import { MAX_ITEMS, type OrderStatus, type PayKind } from '../lib/dining/orders';
import { MAX_DONATION, SHARE_CONSENT_TEXT } from '../lib/dining/sharing';
import type { Figure } from '../lib/dining/figures';
import {
  DINING_STAFF,
  balanceFigures,
  cancelOrder,
  diningCents,
  donateSwipes,
  loadBalances,
  loadMyOrders,
  loadMyPlans,
  loadPlaces,
  openDining,
  placeOrder,
  type Balances,
  type DiningContext,
  type DiningOpening,
  type MyOrder,
  type Places,
  type PlanSummary,
} from '../lib/dining/client';

/**
 * Dining at your school, from the card office: what is left on your plan,
 * where is open and what it serves, a mobile order, and giving swipes to the
 * basic-needs pool — behind `module.dining`, which is off at every school
 * today, so what nearly everybody sees is the one sentence saying so.
 *
 * This is not the Meal plan screen (`screens/Meals.tsx`). That keeps the
 * readings a student types from the balance page, because without a card-
 * office connection there is nothing else to read; this is what the school's
 * card office says once it is connected. They link to each other and share no
 * state.
 *
 * Nothing here is the institution's figure until the card-office connection is
 * live. Until then every balance says it is Semester's own arithmetic, and
 * ordering and giving are refused by the database — the screen says so before
 * anybody presses anything.
 */

const BLURB = 'What is left on your meal plan, where is open and what it serves, and a mobile order — as your school’s card office reports it.';

type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; opening: DiningOpening };

export function Dining() {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    openDining().then(
      (opening) => { if (live) setLoaded({ status: 'done', opening }); },
      (e: unknown) => { if (live) setLoaded({ status: 'error', message: e instanceof Error ? e.message : 'Could not reach the dining service.' }); },
    );
    return () => { live = false; };
  }, [attempt]);

  if (loaded.status === 'loading') {
    return (
      <Page blurb={BLURB}>
        <p role="status" style={NOTE}>Asking your school whether dining is on…</p>
      </Page>
    );
  }
  if (loaded.status === 'error') {
    return (
      <Page blurb={BLURB}>
        <Notice alert>{loaded.message} Nothing was ordered or charged. Meal plan still has the readings you logged yourself.</Notice>
        <ActionButton onClick={() => { setLoaded({ status: 'loading' }); setAttempt((n) => n + 1); }}>Try again</ActionButton>
      </Page>
    );
  }
  const { opening } = loaded;
  if (opening.kind !== 'ready') {
    return (
      <Page blurb={BLURB}>
        <Notice>
          {opening.kind === 'no_service'
            ? 'Dining figures come from your school’s card office, and this copy of Semester has no account service to reach it. The card office controls your plan; Meal plan keeps the readings you type yourself.'
            : opening.kind === 'signed_out'
              ? 'Your meal plan and orders are private to you, so this needs you signed in. Sign in under You → Account with the address your school knows.'
              : 'Your account is not linked to a school yet, so there is no card office to read. Choose your school under You → Account.'}
        </Notice>
        <OpenMeals />
      </Page>
    );
  }
  const ctx = opening.context;
  if (!ctx.on) {
    return (
      <Page blurb={BLURB}>
        <Notice>
          {ctx.moduleState === 'off'
            ? 'Your school has not turned on dining in Semester. Your meal plan, balances and orders stay with your school’s card office, and nothing here changes them.'
            : 'Your school has paused dining in Semester for now. Nothing can be ordered or given here; your plan and balances are unchanged at the card office.'}
        </Notice>
        <p style={NOTE}>Meal plan still keeps the readings you log yourself, with the week they run out.</p>
        <OpenMeals />
      </Page>
    );
  }
  return <Home ctx={ctx} />;
}

function OpenMeals() {
  const { dispatch } = useStore();
  return (
    <button type="button" className="btn" style={{ marginTop: 'var(--sp-5)' }} onClick={() => dispatch({ type: 'go', screen: 'meals' })}>
      Open Meal plan
    </button>
  );
}

function Home({ ctx }: { ctx: DiningContext }) {
  const staff = ctx.capabilities.includes(DINING_STAFF);
  const [view, setView] = useState<'mine' | 'counter'>(staff ? 'counter' : 'mine');
  return (
    <Page blurb={BLURB}>
      {staff ? (
        <TabList
          label="Dining views"
          className="portal-tabs"
          value={view}
          onChange={setView}
          tabs={[{ id: 'mine', label: 'Your dining' }, { id: 'counter', label: 'The counter' }]}
        />
      ) : null}
      {view === 'counter' && staff ? <Counter /> : <YourDining />}
    </Page>
  );
}

// ── Words ──────────────────────────────────────────────────────────────────

export const STATUS_WORDS: Record<OrderStatus, string> = {
  placed: 'Placed — waiting for the counter',
  accepted: 'Accepted — being made',
  ready: 'Ready to pick up',
  picked_up: 'Picked up',
  cancelled: 'Cancelled, and refunded',
};

const PAY_WORDS: Record<PayKind, string> = {
  swipe: 'A swipe',
  pool_swipe: 'A shared swipe',
  dining_cents: 'Dining dollars',
  campus_cents: 'Campus cash',
};

const DAY = (weekday: number) => formatDate(new Date(2024, 0, 7 + weekday), { weekday: 'short' });

export function hoursLine(hours: readonly HoursWindow[]): string {
  if (hours.length === 0) return 'No hours on record.';
  return [...hours]
    .sort((a, b) => a.weekday - b.weekday || a.opensAt - b.opensAt)
    .map((h) => `${DAY(h.weekday)} ${clock(h.opensAt)}–${clock(h.closesAt)}`)
    .join(', ');
}

/** One balance: what it is, with its source and age under it, and the figure. */
function FigureRow({ label, f, now }: { label: string; f: Figure; now: number }) {
  return (
    <CustomRow>
      <div style={ROW}>
        <span style={WHAT}>
          {label}
          <span style={META}>
            <SourceBadge label={f.label} at={f.at} now={now} />
          </span>
        </span>
        <span style={AMOUNT}>{f.unit === 'cents' ? diningCents(f.value) : `${f.value} ${f.value === 1 ? 'swipe' : 'swipes'}`}</span>
      </div>
    </CustomRow>
  );
}

// ── The student's view ─────────────────────────────────────────────────────

interface Data {
  balances: Balances;
  plans: PlanSummary[];
  places: Places;
  orders: MyOrder[];
}

function YourDining() {
  const { say } = useStore();
  const now = useNow().getTime();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [where, setWhere] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [pay, setPay] = useState<PayKind>('swipe');
  const [give, setGive] = useState('1');
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState('');
  const keys = useRef(new IntentKeys()).current;
  const { confirmFirst, dialog } = useConfirm();

  useEffect(() => {
    let live = true;
    Promise.all([loadBalances(), loadMyPlans(), loadPlaces(), loadMyOrders()]).then(
      ([balances, plans, places, orders]) => { if (live) { setData({ balances, plans, places, orders }); setError(''); } },
      (e: unknown) => { if (live) setError(e instanceof Error ? e.message : 'Could not read dining.'); },
    );
    return () => { live = false; };
  }, [version]);

  const itemNames = useMemo(() => new Map((data?.places.menu ?? []).map((m) => [m.id, m.name])), [data]);

  if (error && !data) {
    return (
      <>
        <Notice alert>{error} Nothing was ordered or charged.</Notice>
        <ActionButton onClick={() => setVersion((n) => n + 1)}>Try again</ActionButton>
      </>
    );
  }
  if (!data) return <p role="status" style={NOTE}>Reading your plan, the locations and your orders…</p>;

  const { balances, plans, places, orders } = data;
  const figures = balanceFigures(balances, now);
  const live = balances.partnerStatus === 'live';
  const plan = plans.find((p) => p.term === balances.planTerm) ?? null;
  const location = places.locations.find((l) => l.id === where) ?? places.locations[0] ?? null;
  const menu = location ? menuToday(location, places.menu, now) : [];
  const picked = menu.filter((m) => chosen.includes(m.item.id));
  const swipeOk = picked.length > 0 && picked.every((m) => m.item.swipeEligible);
  const price = picked.reduce((n, m) => n + m.item.priceCents, 0);
  const open = location ? openAt(location, now) : null;

  const order = () => {
    if (!location) return;
    if (picked.length === 0) return setStatus('Choose at least one thing from the menu.');
    if ((pay === 'swipe' || pay === 'pool_swipe') && !swipeOk) return setStatus('A swipe does not cover everything chosen. Pay with dining dollars or campus cash, or choose again.');
    const items = picked.map((m) => m.item.id);
    const sig = `order:${location.id}:${pay}:${items.join(',')}`;
    confirmFirst({
      title: `Order from ${location.name}`,
      confirmLabel: 'Confirm the order',
      preview: (
        <>
          <p>{picked.map((m) => m.item.name).join(', ')}.</p>
          <p>
            Paid with {PAY_WORDS[pay].toLowerCase()}
            {pay === 'dining_cents' || pay === 'campus_cents' ? `: ${diningCents(price)} as the menu lists it; the card office’s price is the one charged` : ''}. You can
            cancel it until the counter accepts it, and a cancelled order is refunded.
          </p>
        </>
      ),
      run: async () => {
        setStatus('Placing the order…');
        try {
          await placeOrder(location.id, items, pay, keys.keyFor(sig));
          keys.settle(sig);
          setChosen([]);
          setStatus('');
          say(`Order placed at ${location.name}.`);
          setVersion((n) => n + 1);
        } catch (e) {
          setStatus(e instanceof Error ? e.message : 'The order was not placed.');
        }
      },
    });
  };

  const cancel = (o: MyOrder, name: string) =>
    confirmFirst({
      title: 'Cancel this order',
      confirmLabel: 'Cancel the order',
      preview: <p>Your order at {name} is cancelled, and what it took goes back to where it came from. The counter has not accepted it yet.</p>,
      run: async () => {
        setStatus('Cancelling…');
        try {
          await cancelOrder(o.id, 'Cancelled by the student.');
          setStatus('');
          say('Order cancelled and refunded.');
          setVersion((n) => n + 1);
        } catch (e) {
          setStatus(e instanceof Error ? e.message : 'The order was not cancelled.');
        }
      },
    });

  const donate = () => {
    const n = Number(give);
    if (!agreed) return setStatus('Giving swipes needs you to agree to the sentence above.');
    const sig = `give:${n}`;
    confirmFirst({
      title: `Give ${n} ${n === 1 ? 'swipe' : 'swipes'}`,
      confirmLabel: 'Give the swipes',
      preview: <p>{SHARE_CONSENT_TEXT}</p>,
      run: async () => {
        setStatus('Giving…');
        try {
          await donateSwipes(n, keys.keyFor(sig));
          keys.settle(sig);
          setAgreed(false);
          setStatus('');
          say(`Thank you. ${n} ${n === 1 ? 'swipe' : 'swipes'} given to the pool.`);
          setVersion((v) => v + 1);
        } catch (e) {
          setStatus(e instanceof Error ? e.message : 'The swipes were not given.');
        }
      },
    });
  };

  const locName = (id: string) => places.locations.find((l) => l.id === id)?.name ?? 'a dining location';

  return (
    <>
      {live ? null : (
        <Notice>
          Your school’s card office is not connected ({balances.partnerStatus.replace('_', ' ')}), so nothing here is its figure. The balances are
          Semester’s own sums of what it has recorded, labelled Estimated, and nothing can be ordered or given until the card office is live.
        </Notice>
      )}

      <Group header={plan ? `Your plan · ${plan.swipeKind === 'weekly' ? `${plan.perWeek} swipes a week` : plan.swipeKind === 'term' ? `${plan.perTerm} swipes a term` : 'dining dollars only'}` : 'Your plan'} framed={false}>
        {balances.planTerm === null ? (
          <CustomRow line={false}>
            <span style={NOTE}>No meal plan covers today. Campus cash, if you have any, is below.</span>
          </CustomRow>
        ) : null}
        {figures.swipes ? (
          <FigureRow label={plan?.swipeKind === 'term' ? 'Swipes left this term' : 'Swipes left this plan week'} f={figures.swipes} now={now} />
        ) : null}
        {figures.diningCents ? <FigureRow label="Dining dollars" f={figures.diningCents} now={now} /> : null}
        <FigureRow label="Campus cash" f={figures.campusCents} now={now} />
        {plan ? (
          <CustomRow line={false}>
            <span style={META}>
              Plan from the card office <SourceBadge label={plan.source} at={plan.sourceAt} now={now} />
            </span>
          </CustomRow>
        ) : null}
      </Group>

      <Group header="Your orders" framed={false}>
        {orders.length === 0 ? (
          <CustomRow line={false}>
            <span style={NOTE}>No mobile orders yet. Choose a location below to place one.</span>
          </CustomRow>
        ) : (
          orders.map((o) => (
            <CustomRow key={o.id}>
              <div style={ROW}>
                <span style={WHAT}>
                  {STATUS_WORDS[o.status]}
                  <span style={META}>
                    {locName(o.locationId)} · {o.items.map((i) => itemNames.get(i) ?? 'an item').join(', ')} · {PAY_WORDS[o.pay]} · {formatTime(o.placedAt, { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </span>
                {o.status === 'placed' ? (
                  <button type="button" className="btn" style={AMOUNT} onClick={() => cancel(o, locName(o.locationId))}>
                    Cancel order
                  </button>
                ) : null}
              </div>
            </CustomRow>
          ))
        )}
      </Group>

      {places.locations.length === 0 ? (
        <EmptyState inline title="No dining locations yet" body="Your school’s card office has not listed any locations. When it does, their hours and menus show here." />
      ) : (
        <>
          <Group header="Where to eat" framed={false}>
            {places.locations.map((l) => (
              <LocationRow key={l.id} l={l} now={now} chosen={location?.id === l.id} onChoose={() => { setWhere(l.id); setChosen([]); }} />
            ))}
          </Group>

          {location ? (
            <Group header={`Order from ${location.name}`} framed={false}>
              {!location.orderingEnabled ? (
                <CustomRow line={false}>
                  <span>This location has paused mobile orders. Order at the counter.</span>
                </CustomRow>
              ) : open && !open.ok ? (
                <CustomRow line={false}>
                  <span>{open.reason}</span>
                </CustomRow>
              ) : null}
              {menu.length === 0 ? (
                <CustomRow line={false}>
                  <span style={NOTE}>No menu for today from this location.</span>
                </CustomRow>
              ) : (
                menu.map((m) => (
                  <Toggle
                    key={m.item.id}
                    on={chosen.includes(m.item.id)}
                    label={`${m.item.name} · ${diningCents(m.item.priceCents)}${m.item.swipeEligible ? ' · a swipe covers it' : ''}`}
                    onChange={() =>
                      setChosen((c) => (c.includes(m.item.id) ? c.filter((x) => x !== m.item.id) : c.length >= MAX_ITEMS ? c : [...c, m.item.id]))
                    }
                  />
                ))
              )}
              {menu.length > 0 ? (
                <CustomRow line={false}>
                  <span style={META}>
                    Menu <SourceBadge label={menu[0].price.label} at={menu[0].price.at} now={now} /> · up to {MAX_ITEMS} things an order
                  </span>
                </CustomRow>
              ) : null}
              <Segmented
                options={[
                  { id: 'swipe', label: 'Swipe' },
                  { id: 'dining_cents', label: 'Dining $' },
                  { id: 'campus_cents', label: 'Campus cash' },
                  { id: 'pool_swipe', label: 'Shared swipe' },
                ] as const}
                value={pay}
                onChange={setPay}
              />
              <p style={META}>
                A shared swipe comes from the school’s basic-needs pool. Nobody at the counter or anywhere else is told you used one, and the pool allows
                two in any seven days.
              </p>
              <ActionButton tone="primary" onClick={order} disabled={!live || !location.orderingEnabled || menu.length === 0}>
                Place the order
              </ActionButton>
              {!live ? <p style={META}>Ordering opens when your school’s card office is connected.</p> : null}
            </Group>
          ) : null}
        </>
      )}

      <Group header="Give swipes to the basic-needs pool" framed={false}>
        <CustomRow line={false}>
          <p>{SHARE_CONSENT_TEXT}</p>
        </CustomRow>
        <Segmented options={Array.from({ length: MAX_DONATION }, (_, i) => ({ id: String(i + 1), label: String(i + 1) }))} value={give} onChange={setGive} />
        <Toggle on={agreed} label="I agree to the sentence above" onChange={() => setAgreed((a) => !a)} />
        <button type="button" className="btn" style={{ marginTop: 'var(--sp-4)' }} onClick={donate} disabled={!live}>
          Give swipes
        </button>
      </Group>

      {status ? <p role="status">{status}</p> : null}
      <OpenMeals />
      {dialog}
    </>
  );
}

function LocationRow({ l, now, chosen, onChoose }: { l: DiningLocation; now: number; chosen: boolean; onChoose: () => void }) {
  const open = openAt(l, now);
  return (
    <CustomRow>
      <div style={ROW}>
        <span style={WHAT}>
          {l.name} — {open.ok ? `open until ${clock(open.value.closesAt)}` : 'closed now'}
          {l.orderingEnabled ? '' : ' · mobile orders paused'}
          <span style={META}>{hoursLine(l.hours)}</span>
          <span style={META}>
            Hours <SourceBadge label={l.source} at={l.sourceAt} now={now} />
          </span>
        </span>
        <button type="button" className="btn" style={AMOUNT} aria-pressed={chosen} onClick={onChoose}>
          {chosen ? 'Menu shown' : 'Show the menu'}
        </button>
      </div>
    </CustomRow>
  );
}
