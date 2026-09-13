import { useState } from 'react';
import {
  ArchiveIcon,
  ChevronLeft,
  ClockIcon,
  ForwardIcon,
  MoreIcon,
  OpenedIcon,
  Paperclip,
  ReplyAllIcon,
  ReplyIcon,
  StarIcon,
  TrashIcon,
} from '../Icons';
import { CourseTag } from '../CourseTag';
import { secondLine } from '../../lib/dim';
import {
  fullStamp,
  initials,
  shown,
  splitQuote,
  type Mail,
  type Thread,
} from '../../lib/mailbox';

/**
 * The message, open.
 *
 * The conversation top to bottom, the way both clients show it: the subject
 * once at the top, then each message with who sent it and when, with the
 * quoted copy of the message before it folded behind a small control. Replying
 * is three buttons at the bottom and the same three in the header, because
 * which one somebody reaches for depends on whether they have finished reading.
 *
 * The two rows of actions above it are the ones that act on the whole thread —
 * archive, delete, snooze, mark unread — and they are the same actions as the
 * ones on the row, doing the same thing to the same marks.
 */
export function Reader({
  thread,
  narrow,
  onClose,
  onStar,
  onRead,
  onArchive,
  onTrash,
  onSnooze,
  onReply,
  onTask,
  onChanges,
}: {
  thread: Thread;
  /** True when the reader is the whole screen rather than a pane. */
  narrow: boolean;
  onClose: () => void;
  onStar: () => void;
  onRead: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onSnooze: () => void;
  onReply: (mail: Mail, mode: 'reply' | 'replyAll' | 'forward') => void;
  /** Make one of your own tasks out of it. */
  onTask: (mail: Mail) => void;
  /** Hand it to the screen that turns an announcement into dates. */
  onChanges: (mail: Mail) => void;
}) {
  const last = thread.mails[thread.mails.length - 1];
  const [more, setMore] = useState(false);

  return (
    <div className="mb-read">
      <div className="mb-read-top">
        {narrow && (
          <button type="button" className="mb-ico" aria-label="Back to the list" onClick={onClose}>
            <ChevronLeft size={19} />
          </button>
        )}
        <button type="button" className="mb-ico" aria-label="Archive" title="Archive" onClick={onArchive}>
          <ArchiveIcon size={18} />
        </button>
        <button type="button" className="mb-ico" aria-label="Delete" title="Delete" onClick={onTrash}>
          <TrashIcon size={18} />
        </button>
        <button type="button" className="mb-ico" aria-label="Snooze" title="Snooze" onClick={onSnooze}>
          <ClockIcon size={18} />
        </button>
        <button
          type="button"
          className="mb-ico"
          aria-label={thread.unread ? 'Mark read' : 'Mark unread'}
          title={thread.unread ? 'Mark read' : 'Mark unread'}
          onClick={onRead}
        >
          <OpenedIcon size={18} />
        </button>
        <button
          type="button"
          className={thread.starred ? 'mb-ico is-on' : 'mb-ico'}
          aria-label={thread.starred ? 'Unstar' : 'Star'}
          aria-pressed={thread.starred}
          onClick={onStar}
        >
          <StarIcon size={18} on={thread.starred} />
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="mb-ico"
          aria-label="More to do with this"
          aria-expanded={more}
          onClick={() => setMore(!more)}
        >
          <MoreIcon size={18} />
        </button>
        {!narrow && (
          <button type="button" className="mb-ico" aria-label="Close the message" onClick={onClose}>
            <ChevronLeft size={19} style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
      </div>

      {/*
        What only this mailbox can do with a message, kept behind the dots
        rather than in the row of four: they are the app's own verbs, not a
        mail client's, and somebody looking for Archive should not have to
        read past them.
      */}
      {more && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--sp-3)',
            padding: 'var(--sp-4)',
            borderBottom: '1px solid var(--app-line)',
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={() => onTask(last)}>
            Make a task from this
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onChanges(last)}>
            Read it into my dates
          </button>
          {last.link && (
            <a className="btn btn-secondary" href={last.link} target="_blank" rel="noreferrer">
              Open in {last.source === 'google' ? 'Gmail' : 'Outlook'}
            </a>
          )}
          <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}>
            Print
          </button>
        </div>
      )}

      <div className="mb-read-in">
        <h2 className="mb-subject-big">{thread.mails[0].subject}</h2>
        {last.courseId && (
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <CourseTag id={last.courseId} />
          </div>
        )}

        {thread.mails.map((mail) => (
          <Message key={mail.id} mail={mail} />
        ))}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginTop: 'var(--sp-7)' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onReply(last, 'reply')}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', height: 40 }}
          >
            <ReplyIcon size={16} />
            Reply
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onReply(last, 'replyAll')}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', height: 40 }}
          >
            <ReplyAllIcon size={16} />
            Reply all
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onReply(last, 'forward')}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', height: 40 }}
          >
            <ForwardIcon size={16} />
            Forward
          </button>
        </div>
      </div>
    </div>
  );
}

/** One message inside the conversation. */
function Message({ mail }: { mail: Mail }) {
  const { said, quote } = splitQuote(mail.body || mail.snippet);
  const [showing, setShowing] = useState(false);

  return (
    <article style={{ marginTop: 'var(--sp-7)' }}>
      <div className="mb-from">
        <span className="mb-face">{initials(mail.from)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--type-base)' }}>
            <strong>{shown(mail.from)}</strong>{' '}
            <span style={secondLine()}>&lt;{mail.from.address}&gt;</span>
          </div>
          <div style={{ fontSize: 'var(--type-xs)', ...secondLine() }}>
            to {mail.to.length ? mail.to.map(shown).join(', ') : 'you'}
            {mail.cc.length > 0 && `, cc ${mail.cc.map(shown).join(', ')}`}
          </div>
        </div>
        <div style={{ fontSize: 'var(--type-xs)', flex: 'none', ...secondLine() }}>{fullStamp(mail.at)}</div>
      </div>

      <div className="mb-text">{said}</div>

      {quote && (
        <>
          <button
            type="button"
            className="mb-ico"
            aria-label={showing ? 'Hide the quoted message' : 'Show the quoted message'}
            aria-expanded={showing}
            onClick={() => setShowing(!showing)}
            style={{ marginTop: 'var(--sp-4)', width: 40 }}
          >
            <MoreIcon size={16} />
          </button>
          {showing && <div className="mb-text mb-quote">{quote}</div>}
        </>
      )}

      {mail.attachments > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-3)',
            marginTop: 'var(--sp-5)',
            fontSize: 'var(--type-sm)',
            ...secondLine(),
          }}
        >
          <Paperclip size={15} />
          {mail.attachments} {mail.attachments === 1 ? 'attachment' : 'attachments'} — open the
          message in {mail.source === 'google' ? 'Gmail' : 'Outlook'} to download{' '}
          {mail.attachments === 1 ? 'it' : 'them'}.
        </div>
      )}
    </article>
  );
}
