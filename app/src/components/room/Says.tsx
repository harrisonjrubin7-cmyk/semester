import { useState } from 'react';
import { FACES, clockAt, pieces, mentionsMe, type Run, type Tally } from '../../lib/roomchat';
import { initials } from '../../lib/classmates';
import { secondLine } from '../../lib/dim';

/**
 * One person talking, and everything that can be done about it.
 *
 * A run rather than a message: four lines sent in one minute are one person
 * talking, so they carry one avatar, one name and one time between them. The
 * grouping itself is `conversation` in `lib/roomchat.ts`; this draws what it
 * decided.
 *
 * ## Why the controls are a button and not a hover
 *
 * Every desktop chat reveals its reactions and its delete on hover. Half the
 * people here are on a phone, where there is no hover at all and the
 * equivalent is a long press nobody discovers. So each message has one quiet
 * control that opens the same row on both — reactions, and the one destructive
 * or reporting action that applies to whose message it is.
 *
 * ## What a mention looks like
 *
 * A name in the accent, and — when the name is yours — a coloured edge down
 * the whole message. The edge is the part that matters: a mention is a claim
 * that somebody is waiting on you, and it should be findable by scrolling
 * rather than by reading.
 */
export function Says({
  run,
  name,
  mine,
  present,
  handles,
  myHandle,
  tallies,
  onReact,
  onDelete,
  onReport,
  onPaper,
  paperOf,
  markId,
  hitId,
}: {
  run: Run;
  name: string;
  mine: boolean;
  /** Whether this person has the room open right now. */
  present: boolean;
  handles: string[];
  myHandle: string;
  tallies: Record<string, Tally[]>;
  onReact: (messageId: string, emoji: string, mine: boolean) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  onPaper: (code: string) => void;
  paperOf: (body: string) => string | null;
  /** The first message you have not seen — the one the New rule goes above. */
  markId: string | null;
  /** A message just jumped to from Find in chat, lit until something else is. */
  hitId: string;
}) {
  const [open, setOpen] = useState('');

  return (
    <div style={{ display: 'flex', gap: 'var(--sp-5)', paddingTop: 'var(--sp-5)' }}>
      <span style={{ flex: 'none', position: 'relative' }}>
        <span
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--r-lg)',
            background: mine ? 'var(--app-accent-wash)' : 'var(--app-raise)',
            border: `1px solid ${mine ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
            fontSize: 'var(--type-xs)',
          }}
        >
          {initials(name)}
        </span>
        {/*
          The dot that says somebody has the room open.

          Not green, and not four states. The palette is one ink and one
          warning colour, so a borrowed green would be the only hue on the
          screen for the least important thing on it — and "away" and "busy"
          are things this app cannot know, so a dot that showed them would read
          as informative while being invented. Here, or nothing.
        */}
        {present && (
          <span
            aria-label={`${name} is here now`}
            role="img"
            style={{
              position: 'absolute',
              right: -1,
              bottom: -1,
              width: 10,
              height: 10,
              borderRadius: 'var(--r-lg)',
              background: 'var(--app-accent)',
              border: '2px solid var(--app-bg)',
            }}
          />
        )}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-4)' }}>
          <span style={{ fontSize: 'var(--type-base)' }}>{mine ? 'You' : name}</span>
          <span style={{ fontSize: 'var(--type-xs)', ...secondLine() }}>{clockAt(run.at)}</span>
        </div>

        {run.says.map((say) => {
          const at = mentionsMe(say.body, myHandle, handles);
          const faces = tallies[say.id] ?? [];
          const code = paperOf(say.body);
          return (
            <div key={say.id}>
              {markId === say.id && <NewHere />}
              <div
                id={`say-${say.id}`}
                style={{
                  marginTop: 'var(--sp-2)',
                  paddingTop: 'var(--sp-3)',
                  paddingBottom: 'var(--sp-3)',
                  paddingLeft: 'var(--sp-5)',
                  paddingRight: 'var(--sp-5)',
                  borderRadius: 'var(--r-lg)',
                  borderLeft: at ? '2px solid var(--app-warn)' : '2px solid transparent',
                  background:
                    hitId === say.id
                      ? 'var(--app-accent-wash)'
                      : at
                        ? 'var(--app-warn-wash)'
                        : 'var(--app-panel)',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--type-md)',
                    lineHeight: 'var(--leading-relaxed)',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {pieces(say.body, handles).map((piece, i) =>
                    piece.mention === undefined ? (
                      <span key={i}>{piece.text}</span>
                    ) : (
                      <span
                        key={i}
                        style={{
                          color: 'var(--app-accent-bright)',
                          background: 'var(--app-accent-wash)',
                          borderRadius: 'var(--r-sm)',
                          paddingLeft: 'var(--sp-1)',
                          paddingRight: 'var(--sp-1)',
                        }}
                      >
                        {piece.text}
                      </span>
                    ),
                  )}
                </div>

                {/*
                  A message carrying a paper code gets a way to sit it. The code
                  reproduces the questions exactly, so two people in a room can
                  answer the same paper without either one's answers leaving
                  their device.
                */}
                {code && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => onPaper(code)}
                    style={{
                      height: 34,
                      marginTop: 'var(--sp-4)',
                      width: 'auto',
                      paddingLeft: 'var(--sp-7)',
                      paddingRight: 'var(--sp-7)',
                      fontSize: 'var(--type-sm)',
                    }}
                  >
                    Sit paper {code}
                  </button>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 'var(--sp-3)',
                    marginTop: faces.length > 0 ? 'var(--sp-4)' : 'var(--sp-2)',
                  }}
                >
                  {faces.map((face) => (
                    <button
                      key={face.emoji}
                      type="button"
                      className="bare tap-y"
                      aria-label={`${face.emoji} from ${face.who.join(', ')}`}
                      onClick={() => onReact(say.id, face.emoji, face.mine)}
                      style={{
                        width: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--sp-2)',
                        height: 22,
                        paddingLeft: 'var(--sp-3)',
                        paddingRight: 'var(--sp-3)',
                        borderRadius: 'var(--r-lg)',
                        border: `1px solid ${face.mine ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                        background: face.mine ? 'var(--app-accent-wash)' : 'var(--app-raise)',
                        fontSize: 'var(--type-xs)',
                      }}
                    >
                      <span aria-hidden="true">{face.emoji}</span>
                      <span>{face.count}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="bare tap"
                    aria-label={open === say.id ? 'Close this message’s actions' : 'React or report'}
                    aria-expanded={open === say.id}
                    onClick={() => setOpen(open === say.id ? '' : say.id)}
                    style={{
                      width: 'auto',
                      // At the far end of the row, where a control belongs. In
                      // the middle it read as three full stops left in the
                      // text rather than as the way to react to it.
                      marginLeft: 'auto',
                      fontSize: 'var(--type-xs)',
                      letterSpacing: '0.06em',
                      ...secondLine(),
                    }}
                  >
                    ⋯
                  </button>
                </div>

                {open === say.id && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 'var(--sp-3)',
                      marginTop: 'var(--sp-4)',
                      paddingTop: 'var(--sp-4)',
                      borderTop: '1px solid var(--app-line-soft)',
                    }}
                  >
                    {FACES.map((face) => (
                      <button
                        key={face}
                        type="button"
                        className="bare tap"
                        aria-label={`React with ${face}`}
                        onClick={() => {
                          onReact(say.id, face, faces.some((f) => f.emoji === face && f.mine));
                          setOpen('');
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 'var(--r-lg)',
                          border: '1px solid var(--app-line)',
                          background: 'var(--app-raise)',
                          fontSize: 'var(--type-base)',
                        }}
                      >
                        {face}
                      </button>
                    ))}
                    <span style={{ flex: 1 }} />
                    {mine ? (
                      <button
                        type="button"
                        className="bare tap-y"
                        onClick={() => {
                          onDelete(say.id);
                          setOpen('');
                        }}
                        style={{
                          width: 'auto',
                          fontSize: 'var(--type-xs)',
                          letterSpacing: '0.06em',
                          color: 'var(--app-warn)',
                        }}
                      >
                        DELETE
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="bare tap-y"
                        onClick={() => {
                          onReport(say.id);
                          setOpen('');
                        }}
                        style={{
                          width: 'auto',
                          fontSize: 'var(--type-xs)',
                          letterSpacing: '0.06em',
                          ...secondLine(),
                        }}
                      >
                        REPORT
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The rule above the first thing you have not seen.
 *
 * It is drawn from the mark the room was opened with and does not move while
 * you are reading, which is the whole point: a line that chased the newest
 * message would never be above anything.
 */
function NewHere() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        marginTop: 'var(--sp-5)',
      }}
    >
      <span style={{ flex: 'none', fontSize: 'var(--type-xs)', color: 'var(--app-warn)' }}>NEW</span>
      <span style={{ flex: 1, height: 1, background: 'var(--app-warn-line)' }} />
    </div>
  );
}
