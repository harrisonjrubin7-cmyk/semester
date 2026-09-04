import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
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
export function Groupwork() {
  const { state, dispatch, now, account, catalog } = useStore();

  const [code, setCode] = useState(
    catalog.byId[state.courseId]?.code ?? catalog.courses[0]?.code ?? '',
  );
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [openId, setOpenId] = useState('');
  const [members, setMembers] = useState<Profile[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
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

  const loadOne = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const [who, what] = await Promise.all([membersOf(id), partsOf(id)]);
      setMembers(who);
      setParts(what);
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
      <div style={{ padding: 18 }}>
        <Blueprint style={{ padding: '15px 16px' }}>
          <div className="kicker">Sign in first</div>
          <div style={{ fontSize: 14, marginTop: 8, lineHeight: 1.5, opacity: 0.8 }}>
            A group is other people, so it needs an account. Everything else in the app works
            signed out.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => dispatch({ type: 'go', screen: 'account' })}
            style={{ height: 42, marginTop: 12 }}
          >
            Sign in
          </button>
        </Blueprint>
      </div>
    );
  }

  const s = open ? standing(asGroup(open), parts.map(asPart), now) : null;

  return (
    <div style={{ padding: 18 }}>
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
        <div style={{ fontSize: 13, marginTop: 12, color: 'var(--app-warn)', lineHeight: 1.45 }}>
          {error}
        </div>
      ) : null}

      {!open && (
        <>
          <SectionLabel>Groups in {code}</SectionLabel>
          {groups.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.65, lineHeight: 1.5 }}>
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
                  padding: '12px 0',
                  borderBottom: '1px solid var(--app-line)',
                }}
              >
                <span style={{ display: 'block', fontSize: 15, lineHeight: 1.35 }}>{g.name}</span>
                {g.due ? (
                  <span style={{ display: 'block', fontSize: 11.5, opacity: 0.55, marginTop: 3 }}>
                    due {g.due}
                  </span>
                ) : null}
              </button>
            ))
          )}

          <SectionLabel>Start one</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
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
            style={{ height: 32, fontSize: 12, marginTop: 14 }}
          >
            ← All groups
          </button>

          <Blueprint style={{ padding: '15px 16px', marginTop: 10 }}>
            <div className="kicker">{code}</div>
            <div
              className="chrome-text"
              style={{ fontSize: 22, lineHeight: 1.2, marginTop: 6, textWrap: 'pretty' }}
            >
              {open.name}
            </div>
            <div style={{ fontSize: 14, opacity: 0.8, marginTop: 8, lineHeight: 1.45 }}>
              {headline(s)}
            </div>
            {/* The sentence a group can argue with. See `lib/groupwork.ts`. */}
            {paceLine(asGroup(open), parts.map(asPart), now) ? (
              <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 7, lineHeight: 1.5 }}>
                {paceLine(asGroup(open), parts.map(asPart), now)}
              </div>
            ) : null}
            {iAmIn && (
              <div style={{ display: 'flex', gap: 8, marginTop: 11, alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, opacity: 0.55, flex: 'none' }}>Due</span>
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
                  style={{ flex: 1, minWidth: 0, height: 34, fontSize: 12.5 }}
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
                gap: 10,
                alignItems: 'baseline',
                padding: '9px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>
                {share.member.handle}
                {share.member.userId === account.id ? (
                  <span style={{ opacity: 0.5 }}> · you</span>
                ) : null}
              </span>
              <span style={{ flex: 'none', fontSize: 12, opacity: 0.6 }}>
                {share.has === 0 ? 'nothing yet' : `${share.done}/${share.has}`}
              </span>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
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
                style={{ flex: 1, height: 38, fontSize: 12.5 }}
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
                style={{ flex: 1, height: 38, fontSize: 12.5 }}
              >
                Join it
              </button>
            )}
          </div>

          {unclaimed(parts.map(asPart)).length > 0 && (
            <>
              <SectionLabel>Nobody has these</SectionLabel>
              <div style={{ fontSize: 11.5, opacity: 0.55, marginBottom: 6, lineHeight: 1.45 }}>
                The list a group actually has to divide.
              </div>
            </>
          )}

          <SectionLabel>The parts</SectionLabel>
          {parts.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.65, lineHeight: 1.5 }}>
              Nothing on the list yet. Write down the sections and the group can divide them.
            </div>
          ) : (
            parts.map(asPart).map((p) => {
              const owner = members.find((m) => m.user_id === p.owner);
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'baseline',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--app-line)',
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
                    style={{ flex: 'none', width: 22, fontSize: 14, opacity: p.done ? 1 : 0.35 }}
                  >
                    {p.done ? '✓' : '○'}
                  </button>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13.5,
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
                      style={{ flex: 'none', height: 28, fontSize: 11, padding: '0 8px' }}
                    >
                      {p.owner === account.id ? 'Yours' : owner ? owner.handle : 'Take it'}
                    </button>
                  ) : (
                    <span style={{ flex: 'none', fontSize: 11.5, opacity: 0.5 }}>
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
                      style={{ flex: 'none', width: 22, opacity: 0.4, fontSize: 14 }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              );
            })
          )}

          {iAmIn && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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

          <div style={{ fontSize: 11, opacity: 0.45, marginTop: 14, lineHeight: 1.45 }}>
            Any member can claim a part, tick one or fix a title — group work does not survive a
            permission model where only the person who wrote a line may correct it. Nobody can
            remove anybody from a group but themselves.
          </div>
        </>
      )}
      <div style={{ height: 26 }} />
    </div>
  );
}
