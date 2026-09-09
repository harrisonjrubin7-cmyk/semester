import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useRowStyle } from '../components/shell/useShell';
import { Blueprint } from '../components/Blueprint';
import { EmptyState, SectionLabel } from '../components/ui';
import {
  addPart,
  dropPart,
  groupsIn,
  joinGroup,
  leaveGroup,
  membersOf,
  partsOf,
  setGroup,
  setPart,
  startGroup,
  termOf,
  type GroupRow,
  type PartRow,
  type Profile,
} from '../lib/classmates';
import {
  headline,
  isLate,
  paceLine,
  perPerson,
  standing,
  unclaimed,
  type Group,
  type Part,
} from '../lib/groupwork';

const asGroup = (g: GroupRow): Group => ({ id: g.id, name: g.name, about: g.about, due: g.due });
const asPart = (p: PartRow): Part => ({
  id: p.id,
  title: p.title,
  owner: p.owner ?? '',
  done: p.done,
  due: p.due,
  createdAt: new Date(p.created_at).getTime(),
});

/**
 * The four-person case, as something the app can hold.
 *
 * A group project was one deadline in the app and four people's worth of work
 * in life. This is the shared list — who has which part, what nobody has
 * claimed, and the one sentence that answers "are we going to make this"
 * without pretending to score anybody.
 *
 * Everything on screen is counted in `lib/groupwork.ts`. The policies that
 * make it safe are in `supabase/groups.sql`, and they follow the room's: you
 * are verified, you are in that class, and nobody can remove you from a group
 * but you.
 */
/** Stable empties, so a closed group does not hand out a new array each render. */
const NOBODY: Profile[] = [];
const NOTHING: PartRow[] = [];

export function Groupwork() {
  const { state, dispatch, now, account, catalog } = useStore();
  // Spread rather than wrapped, so a button row stays one tap target.
  const rowStyle = useRowStyle(12);
  const rowNine = useRowStyle(9);
  const rowTen = useRowStyle(10);

  const [code, setCode] = useState(
    catalog.byId[state.courseId]?.code ?? catalog.courses[0]?.code ?? '',
  );
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [openId, setOpenId] = useState('');
  /**
   * The open group's roster, and the group it belongs to.
   *
   * One state rather than two, and carrying its own `id`, because the id is
   * what makes it readable: `openId` changes the instant somebody taps a
   * second group, and the fetch for that group lands later. Held separately,
   * `members` and `parts` lagged behind — the panel drew immediately, out of
   * `groups`, showing the *first* group's parts, its owners and its answer to
   * "am I in this one" until the request came back. One frame on a laptop,
   * several seconds on a phone in a basement library, showing somebody else's
   * work as yours.
   *
   * Stamped with the id it was loaded for, the mismatch is visible during
   * render and the stale roster is simply not read. Nothing has to be cleared,
   * so nothing depends on a cleanup running in time, and a slow answer for a
   * group you have already left is discarded rather than raced.
   */
  const [roster, setRoster] = useState<{ id: string; members: Profile[]; parts: PartRow[] }>({
    id: '',
    members: [],
    parts: [],
  });
  const members = roster.id === openId ? roster.members : NOBODY;
  const parts = roster.id === openId ? roster.parts : NOTHING;
  const [newName, setNewName] = useState('');
  const [newPart, setNewPart] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const term = termOf(now);
  const open = groups.find((g) => g.id === openId) ?? null;
  const iAmIn = members.some((m) => m.user_id === account?.id);

  const loadGroups = useCallback(async () => {
    if (!code) return;
    try {
      setGroups(await groupsIn(term, code));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [term, code]);

  /** One group's roster, on opening it and again after anything in it changes. */
  const loadOne = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const [who, what] = await Promise.all([membersOf(id), partsOf(id)]);
      setRoster({ id, members: who, parts: what });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    void loadOne(openId);
  }, [openId, loadOne]);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!account) {
    return (
      <Page>
        <Blueprint style={{ padding: '15px 16px' }}>
          <div className="kicker">Sign in first</div>
          <div style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)', opacity: 0.8 }}>
            A group is other people, so it needs an account. Everything else in the app works
            signed out.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => dispatch({ type: 'go', screen: 'account' })}
            style={{ height: 42, marginTop: 'var(--sp-6)' }}
          >
            Sign in
          </button>
        </Blueprint>
      </Page>
    );
  }

  const s = open ? standing(asGroup(open), parts.map(asPart), now) : null;

  return (
    <Page bottom={26}>
      <SectionLabel>Which class</SectionLabel>
      <select
        className="input"
        value={code}
        aria-label="Which class"
        onChange={(e) => {
          setCode(e.target.value);
          setOpenId('');
        }}
        style={{ width: '100%' }}
      >
        {catalog.courses.map((c) => (
          <option key={c.id} value={c.code}>
            {c.code}
          </option>
        ))}
      </select>

      {error ? (
        <div role="alert" style={{ fontSize: 'var(--type-base)', marginTop: 'var(--sp-6)', color: 'var(--app-warn)', lineHeight: 'var(--leading-normal)' }}>
          {error}
        </div>
      ) : null}

      {!open && (
        <>
          <SectionLabel>Groups in {code}</SectionLabel>
          {groups.length === 0 ? (
            <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, lineHeight: 'var(--leading-relaxed)' }}>
              None yet. Whoever starts one is in it, and anybody else in the class can join.
            </div>
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className="bare tappable"
                onClick={() => setOpenId(g.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  ...rowStyle,
                }}
              >
                <span style={{ display: 'block', fontSize: 'var(--type-lg)', lineHeight: 1.35 }}>{g.name}</span>
                {g.due ? (
                  <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 3 }}>
                    due {g.due}
                  </span>
                ) : null}
              </button>
            ))
          )}

          <SectionLabel>Start one</SectionLabel>
          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <input
              className="input"
              value={newName}
              aria-label="What the group is for"
              placeholder="Opera Philadelphia case"
              onChange={(e) => setNewName(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !newName.trim()}
              onClick={() =>
                void guard(async () => {
                  const id = await startGroup(account.id, term, code, newName);
                  setNewName('');
                  await loadGroups();
                  setOpenId(id);
                })
              }
              style={{ flex: 'none', height: 42 }}
            >
              Start
            </button>
          </div>
        </>
      )}

      {open && s && (
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setOpenId('')}
            style={{ height: 32, fontSize: 'var(--type-sm)', marginTop: 14 }}
          >
            ← All groups
          </button>

          <Blueprint style={{ padding: '15px 16px', marginTop: 'var(--sp-5)' }}>
            <div className="kicker">{code}</div>
            <div
              className="chrome-text"
              style={{ fontSize: 'calc(22px * var(--text-scale, 1))', lineHeight: 1.2, marginTop: 'var(--sp-3)', textWrap: 'pretty' }}
            >
              {open.name}
            </div>
            <div style={{ fontSize: 'var(--type-md)', opacity: 0.8, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
              {headline(s)}
            </div>
            {/* The sentence a group can argue with. See `lib/groupwork.ts`. */}
            {paceLine(asGroup(open), parts.map(asPart), now) ? (
              <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, marginTop: 7, lineHeight: 'var(--leading-relaxed)' }}>
                {paceLine(asGroup(open), parts.map(asPart), now)}
              </div>
            ) : null}
            {iAmIn && (
              <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 11, alignItems: 'center' }}>
                <span style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, flex: 'none' }}>Due</span>
                <input
                  className="input"
                  type="date"
                  value={open.due}
                  aria-label="When the whole thing is due"
                  onChange={(e) =>
                    void guard(async () => {
                      await setGroup(open.id, { due: e.target.value });
                      await loadGroups();
                    })
                  }
                  style={{ flex: 1, minWidth: 0, height: 34, fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
                />
              </div>
            )}
          </Blueprint>

          <SectionLabel>Who is in it</SectionLabel>
          {perPerson(
            members.map((m) => ({ userId: m.user_id, handle: m.handle })),
            parts.map(asPart),
          ).map((share) => (
            <div
              key={share.member.userId}
              style={{
                display: 'flex',
                gap: 'var(--sp-5)',
                alignItems: 'baseline',
                ...rowNine,
              }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>
                {share.member.handle}
                {share.member.userId === account.id ? (
                  <span style={{ opacity: 0.5 }}> · you</span>
                ) : null}
              </span>
              <span style={{ flex: 'none', fontSize: 'var(--type-sm)', opacity: 0.6 }}>
                {share.has === 0 ? 'nothing yet' : `${share.done}/${share.has}`}
              </span>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
            {iAmIn ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  void guard(async () => {
                    await leaveGroup(account.id, open.id);
                    await loadOne(open.id);
                  })
                }
                style={{ flex: 1, height: 38, fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
              >
                Leave the group
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  void guard(async () => {
                    await joinGroup(account.id, open.id);
                    await loadOne(open.id);
                  })
                }
                style={{ flex: 1, height: 38, fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
              >
                Join it
              </button>
            )}
          </div>

          {unclaimed(parts.map(asPart)).length > 0 && (
            <>
              <SectionLabel>Nobody has these</SectionLabel>
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginBottom: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
                The list a group actually has to divide.
              </div>
            </>
          )}

          <SectionLabel>The parts</SectionLabel>
          {parts.length === 0 ? (
            <EmptyState
              inline
              title="Nothing on the list yet"
              body="Write down the sections and the group can divide them."
            />
          ) : (
            parts.map(asPart).map((p) => {
              const owner = members.find((m) => m.user_id === p.owner);
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    gap: 'var(--sp-5)',
                    alignItems: 'baseline',
                    ...rowTen,
                  }}
                >
                  <button
                    type="button"
                    className="bare"
                    aria-label={p.done ? `Mark ${p.title} not done` : `Mark ${p.title} done`}
                    disabled={!iAmIn || busy}
                    onClick={() =>
                      void guard(async () => {
                        await setPart(p.id, { done: !p.done });
                        await loadOne(open.id);
                      })
                    }
                    style={{ flex: 'none', width: 22, fontSize: 'var(--type-md)', opacity: p.done ? 1 : 0.35 }}
                  >
                    {p.done ? '✓' : '○'}
                  </button>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 'calc(13.5px * var(--text-scale, 1))',
                      lineHeight: 1.35,
                      textDecoration: p.done ? 'line-through' : 'none',
                      opacity: p.done ? 0.5 : 1,
                    }}
                  >
                    {p.title}
                    {p.due ? (
                      <span
                        style={{ opacity: 0.55, color: isLate(p, now) ? 'var(--app-warn)' : undefined }}
                      >
                        {' · '}
                        {p.due}
                      </span>
                    ) : null}
                  </span>
                  {iAmIn && !p.done ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() =>
                        void guard(async () => {
                          await setPart(p.id, {
                            owner: p.owner === account.id ? null : account.id,
                          });
                          await loadOne(open.id);
                        })
                      }
                      style={{ flex: 'none', height: 28, fontSize: 'var(--type-xs)', padding: '0 8px' }}
                    >
                      {p.owner === account.id ? 'Yours' : owner ? owner.handle : 'Take it'}
                    </button>
                  ) : (
                    <span style={{ flex: 'none', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5 }}>
                      {owner?.handle ?? ''}
                    </span>
                  )}
                  {iAmIn ? (
                    <button
                      type="button"
                      className="bare"
                      aria-label={`Remove ${p.title}`}
                      disabled={busy}
                      onClick={() =>
                        void guard(async () => {
                          await dropPart(p.id);
                          await loadOne(open.id);
                        })
                      }
                      style={{ flex: 'none', width: 22, opacity: 0.4, fontSize: 'var(--type-md)' }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              );
            })
          )}

          {iAmIn && (
            <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
              <input
                className="input"
                value={newPart}
                aria-label="Another part"
                placeholder="Market sizing"
                onChange={(e) => setNewPart(e.target.value)}
                style={{ flex: 1, minWidth: 0 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy || !newPart.trim()}
                onClick={() =>
                  void guard(async () => {
                    await addPart(account.id, open.id, newPart);
                    setNewPart('');
                    await loadOne(open.id);
                  })
                }
                style={{ flex: 'none', height: 42 }}
              >
                Add
              </button>
            </div>
          )}

          <div style={{ fontSize: 'var(--type-xs)', opacity: 0.45, marginTop: 14, lineHeight: 'var(--leading-normal)' }}>
            Any member can claim a part, tick one or fix a title — group work does not survive a
            permission model where only the person who wrote a line may correct it. Nobody can
            remove anybody from a group but themselves.
          </div>
        </>
      )}
    </Page>
  );
}
