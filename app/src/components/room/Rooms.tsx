import { useState } from 'react';
import { ChevronRight, Plus, Search, StarIcon } from '../Icons';
import { badge, findRooms, type Listed } from '../../lib/roomchat';
import { initials, normaliseCode } from '../../lib/classmates';
import { secondLine } from '../../lib/dim';

/**
 * The list of class conversations: what is beside the room on a wide window,
 * and what the screen is on a phone.
 *
 * ## Why it is a list of rooms rather than a list of people
 *
 * Every chat app this is shaped like lists people, because in those apps a
 * conversation is with somebody. Here it is with a class — the app knows your
 * courses and nothing about who in them you would message — so a row is a
 * course, and what a row has to answer is the same question either way: has
 * anything happened in there since I looked, and was any of it aimed at me.
 *
 * ## The three things a row says
 *
 * The last line with a name on the front of it, so the row can be understood
 * without opening it. The stamp, which narrows from a clock to a weekday to a
 * date as it ages. And the count, which stops at 9+ because a number past that
 * is not read, only noticed.
 *
 * A mention is the exception that gets its own mark. An unread count is "the
 * room moved"; an `@` is "somebody is waiting on you", and those are not the
 * same news. It is the one thing here drawn in the warning colour.
 *
 * ## Rooms you are not in yet
 *
 * They sit in the same list rather than behind a "find a class" screen. The
 * classes on your timetable are the classes you would join, so hiding them
 * until you go looking is a second screen protecting nothing — and the row
 * says plainly that you are not in it, because appearing in a room tells forty
 * people you are in that class and should never be a thing that happened while
 * you were importing a syllabus.
 */
export function Rooms({
  rows,
  openKey,
  onOpen,
  onJoin,
  onPin,
  onMute,
  onLeave,
  onCopyLink,
  adding,
  onAdding,
  onAdd,
  busy,
}: {
  rows: Listed[];
  openKey: string;
  onOpen: (key: string) => void;
  onJoin: (key: string) => void;
  onPin: (key: string, pinned: boolean) => void;
  onMute: (key: string, muted: boolean) => void;
  onLeave: (key: string) => void;
  onCopyLink: (key: string) => void;
  /** The course code being typed into "another class". */
  adding: string;
  onAdding: (text: string) => void;
  onAdd: () => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState('');
  /** Which row has its menu open. One at a time, like every menu in the app. */
  const [menu, setMenu] = useState('');
  /** Whether the box for joining a class by code is showing. */
  const [joining, setJoining] = useState(false);

  const found = findRooms(rows, query);
  const pinned = found.filter((r) => r.pinned);
  const rest = found.filter((r) => !r.pinned);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          flex: 'none',
          display: 'flex',
          gap: 'var(--sp-4)',
          alignItems: 'center',
          paddingTop: 'var(--sp-4)',
          paddingBottom: 'var(--sp-4)',
        }}
      >
        <label
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-3)',
            background: 'var(--app-panel)',
            border: '1px solid var(--app-line)',
            borderRadius: 'var(--r-lg)',
            paddingLeft: 'var(--sp-5)',
            paddingRight: 'var(--sp-5)',
            height: 36,
          }}
        >
          <Search size={14} style={{ flex: 'none', color: 'var(--app-faint)' }} />
          <input
            aria-label="Search your class chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 0,
              outline: 'none',
              color: 'var(--app-fg)',
              fontSize: 'var(--type-base)',
            }}
          />
        </label>
        <button
          type="button"
          className="bare tappable"
          aria-label={joining ? 'Close the box for another class' : 'Chat with another class'}
          aria-expanded={joining}
          onClick={() => setJoining((s) => !s)}
          style={{
            flex: 'none',
            width: 36,
            height: 36,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--r-lg)',
            border: '1px solid var(--app-line)',
            background: joining ? 'var(--app-raise)' : 'var(--app-panel)',
          }}
        >
          <Plus size={15} />
        </button>
      </div>

      {joining && (
        <div style={{ flex: 'none', display: 'flex', gap: 'var(--sp-4)', paddingBottom: 'var(--sp-5)' }}>
          <input
            aria-label="Another class"
            className="input"
            value={adding}
            onChange={(e) => onAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && normaliseCode(adding)) onAdd();
            }}
            placeholder="ECON 1020"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy || !normaliseCode(adding)}
            onClick={onAdd}
            style={{ flex: 'none', paddingLeft: 'var(--sp-7)', paddingRight: 'var(--sp-7)', height: 44 }}
          >
            Join
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {found.length === 0 && (
          <div
            style={{
              fontSize: 'var(--type-base)',
              lineHeight: 'var(--leading-relaxed)',
              paddingTop: 'var(--sp-6)',
              ...secondLine(),
            }}
          >
            {query.trim()
              ? 'No class chat by that name.'
              : 'No courses yet. Add one from a syllabus, or type a code above.'}
          </div>
        )}

        {pinned.length > 0 && <Heading>Pinned</Heading>}
        {pinned.map((row) => (
          <Row
            key={row.key}
            row={row}
            open={row.key === openKey}
            menu={menu === row.key}
            onMenu={(on) => setMenu(on ? row.key : '')}
            onOpen={onOpen}
            onJoin={onJoin}
            onPin={onPin}
            onMute={onMute}
            onLeave={onLeave}
            onCopyLink={onCopyLink}
          />
        ))}

        {pinned.length > 0 && rest.length > 0 && <Heading>Recent</Heading>}
        {rest.map((row) => (
          <Row
            key={row.key}
            row={row}
            open={row.key === openKey}
            menu={menu === row.key}
            onMenu={(on) => setMenu(on ? row.key : '')}
            onOpen={onOpen}
            onJoin={onJoin}
            onPin={onPin}
            onMute={onMute}
            onLeave={onLeave}
            onCopyLink={onCopyLink}
          />
        ))}
      </div>
    </div>
  );
}

/** Pinned / Recent. Only drawn when there is a second section to separate from. */
function Heading({ children }: { children: string }) {
  return (
    <div
      className="kicker"
      style={{
        paddingTop: 'var(--sp-5)',
        paddingBottom: 'var(--sp-3)',
        fontSize: 'var(--type-xs)',
        ...secondLine(),
      }}
    >
      {children}
    </div>
  );
}

function Row({
  row,
  open,
  menu,
  onMenu,
  onOpen,
  onJoin,
  onPin,
  onMute,
  onLeave,
  onCopyLink,
}: {
  row: Listed;
  open: boolean;
  menu: boolean;
  onMenu: (on: boolean) => void;
  onOpen: (key: string) => void;
  onJoin: (key: string) => void;
  onPin: (key: string, pinned: boolean) => void;
  onMute: (key: string, muted: boolean) => void;
  onLeave: (key: string) => void;
  onCopyLink: (key: string) => void;
}) {
  const unread = row.unread > 0 && !row.muted;
  return (
    <div
      style={{
        borderRadius: 'var(--r-lg)',
        background: open ? 'var(--app-raise)' : 'transparent',
        marginBottom: 'var(--sp-1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
        <button
          type="button"
          className="bare tappable"
          onClick={() => (row.joined ? onOpen(row.key) : onJoin(row.key))}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            gap: 'var(--sp-5)',
            alignItems: 'center',
            textAlign: 'left',
            paddingTop: 'var(--sp-4)',
            paddingBottom: 'var(--sp-4)',
            paddingLeft: 'var(--sp-4)',
          }}
        >
          <Tile code={row.code} joined={row.joined} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-4)' }}>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 'var(--type-md)',
                  fontWeight: unread ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.code}
              </span>
              <span style={{ flex: 'none', fontSize: 'var(--type-xs)', ...secondLine() }}>
                {row.when}
              </span>
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                marginTop: 'var(--sp-1)',
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 'var(--type-sm)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  ...(unread ? { color: 'var(--app-fg)' } : secondLine()),
                }}
              >
                {row.preview}
              </span>
              {row.mentions > 0 && (
                <span
                  aria-label={`${row.mentions} ${row.mentions === 1 ? 'mention' : 'mentions'}`}
                  style={{
                    flex: 'none',
                    fontSize: 'var(--type-xs)',
                    color: 'var(--app-warn)',
                    border: '1px solid var(--app-warn-line)',
                    borderRadius: 'var(--r-sm)',
                    paddingLeft: 'var(--sp-2)',
                    paddingRight: 'var(--sp-2)',
                  }}
                >
                  @
                </span>
              )}
              {unread && (
                <span
                  aria-label={`${row.unread} unread`}
                  style={{
                    flex: 'none',
                    minWidth: 18,
                    height: 18,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 'var(--r-lg)',
                    background: 'var(--app-accent)',
                    color: 'var(--app-void)',
                    fontSize: 'var(--type-xs)',
                    paddingLeft: 'var(--sp-2)',
                    paddingRight: 'var(--sp-2)',
                  }}
                >
                  {badge(row.unread)}
                </span>
              )}
              {row.muted && (
                <span style={{ flex: 'none', fontSize: 'var(--type-xs)', ...secondLine() }}>
                  muted
                </span>
              )}
            </span>
          </span>
        </button>

        {row.joined ? (
          <button
            type="button"
            className="bare tap"
            aria-label={`More for ${row.code}`}
            aria-expanded={menu}
            onClick={() => onMenu(!menu)}
            style={{
              flex: 'none',
              width: 28,
              fontSize: 'var(--type-md)',
              textAlign: 'center',
              ...secondLine(),
            }}
          >
            ⋯
          </button>
        ) : (
          <ChevronRight size={14} style={{ flex: 'none', color: 'var(--app-faint)' }} />
        )}
      </div>

      {menu && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--sp-4)',
            paddingLeft: 'var(--sp-4)',
            paddingBottom: 'var(--sp-5)',
          }}
        >
          <Item onClick={() => onPin(row.key, !row.pinned)}>
            <StarIcon on={row.pinned} size={12} /> {row.pinned ? 'Unpin' : 'Pin'}
          </Item>
          <Item onClick={() => onMute(row.key, !row.muted)}>{row.muted ? 'Unmute' : 'Mute'}</Item>
          <Item onClick={() => onCopyLink(row.key)}>Copy link</Item>
          <Item onClick={() => onLeave(row.key)}>Leave</Item>
        </div>
      )}
    </div>
  );
}

/**
 * The square with the course's letters in it.
 *
 * The department rather than the whole code — "ECON", not "ECON 1020" — which
 * is the part that differs between two rooms at a glance. Dimmed where you are
 * not in the room yet, so the list reads as what it is: the classes you have,
 * with the ones you have joined lit.
 */
function Tile({ code, joined }: { code: string; joined: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        flex: 'none',
        width: 34,
        height: 34,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 'var(--r-lg)',
        background: joined ? 'var(--app-accent-wash)' : 'var(--app-panel)',
        border: `1px solid ${joined ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
        color: joined ? 'var(--app-accent)' : 'var(--app-faint)',
        fontSize: 'var(--type-xs)',
        letterSpacing: '0.04em',
      }}
    >
      {initials(code.split(' ')[0] ?? code)}
    </span>
  );
}

/** One line of a row's menu. */
function Item({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="bare tap-y"
      onClick={onClick}
      style={{
        width: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        fontSize: 'var(--type-xs)',
        letterSpacing: '0.06em',
        ...secondLine(),
      }}
    >
      {children}
    </button>
  );
}
