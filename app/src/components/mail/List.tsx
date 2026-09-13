import { ArchiveIcon, ClockIcon, OpenedIcon, Paperclip, StarIcon, TrashIcon } from '../Icons';
import { TickBox } from '../ui';
import { CourseTag } from '../CourseTag';
import {
  CATEGORIES,
  buckets,
  initials,
  participants,
  shown,
  stamp,
  type Category,
  type FolderId,
  type Thread,
} from '../../lib/mailbox';

/**
 * The list, which is the screen.
 *
 * Everything about a mail row is a decision somebody else already got right,
 * so this copies it: sender, subject, the first line of the body in the same
 * line greyed, the date on the right, unread in bold, a star you can hit
 * without opening anything, and four actions that appear under the pointer
 * where the date was. The only addition is the course chip, which is the one
 * thing this mailbox knows that Gmail does not.
 *
 * Rows are conversations rather than messages — both clients gather them and
 * the provider hands back the thread, so nothing here is guessed.
 */
export function List({
  threads,
  folder,
  category,
  onCategory,
  open,
  picked,
  onOpen,
  onPick,
  onStar,
  onRead,
  onArchive,
  onTrash,
  onSnooze,
  now,
  empty,
}: {
  threads: Thread[];
  folder: FolderId;
  /** Null on every folder but the inbox, where Gmail's tabs are drawn. */
  category: Category | null;
  onCategory: (c: Category) => void;
  /** The thread open in the reader. */
  open: string | null;
  picked: string[];
  onOpen: (t: Thread) => void;
  onPick: (t: Thread) => void;
  onStar: (t: Thread) => void;
  onRead: (t: Thread) => void;
  onArchive: (t: Thread) => void;
  onTrash: (t: Thread) => void;
  onSnooze: (t: Thread) => void;
  now: Date;
  /** What to say when there is nothing here. */
  empty: React.ReactNode;
}) {
  const runs = buckets(
    threads.map((t) => t.last),
    now,
  );
  const byId = new Map(threads.map((t) => [t.last.id, t]));

  return (
    <div className="mb-list">
      {category !== null && folder === 'inbox' && (
        <div className="mb-tabs" role="tablist" aria-label="Inbox categories">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              className="mb-tab"
              aria-current={category === c.id}
              aria-selected={category === c.id}
              onClick={() => onCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {threads.length === 0 && empty}

      {runs.map((run) => (
        <div key={run.label}>
          <div className="mb-when">{run.label}</div>
          {run.mails.map((last) => {
            const thread = byId.get(last.id);
            if (!thread) return null;
            return (
              <Row
                key={thread.id}
                thread={thread}
                open={open === thread.id}
                picked={picked.includes(thread.id)}
                now={now}
                onOpen={() => onOpen(thread)}
                onPick={() => onPick(thread)}
                onStar={() => onStar(thread)}
                onRead={() => onRead(thread)}
                onArchive={() => onArchive(thread)}
                onTrash={() => onTrash(thread)}
                onSnooze={() => onSnooze(thread)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Row({
  thread,
  open,
  picked,
  now,
  onOpen,
  onPick,
  onStar,
  onRead,
  onArchive,
  onTrash,
  onSnooze,
}: {
  thread: Thread;
  open: boolean;
  picked: boolean;
  now: Date;
  onOpen: () => void;
  onPick: () => void;
  onStar: () => void;
  onRead: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onSnooze: () => void;
}) {
  const last = thread.last;
  // Who the row is about: the other people in a normal folder, and who it went
  // to in the ones you wrote — a Sent list of your own name is no use.
  const outgoing = last.folder === 'sent' || last.folder === 'drafts';
  const who = outgoing
    ? last.to.length
      ? `To: ${last.to.map(shown).join(', ')}`
      : 'To: nobody yet'
    : participants(thread.mails);

  const classes = ['mb-row'];
  if (thread.unread) classes.push('is-unread');
  if (open) classes.push('is-open');
  if (picked) classes.push('is-picked');

  return (
    <div className={classes.join(' ')}>
      <button
        type="button"
        className="mb-ico"
        aria-label={picked ? `Deselect ${last.subject}` : `Select ${last.subject}`}
        aria-pressed={picked}
        onClick={onPick}
      >
        <TickBox on={picked} size={17} />
      </button>

      <button
        type="button"
        className={thread.starred ? 'mb-ico is-on' : 'mb-ico'}
        aria-label={thread.starred ? `Unstar ${last.subject}` : `Star ${last.subject}`}
        aria-pressed={thread.starred}
        onClick={onStar}
      >
        <StarIcon size={17} on={thread.starred} />
      </button>

      <button
        type="button"
        className="mb-lines"
        onClick={onOpen}
        aria-label={`${who}. ${last.subject}. ${stamp(last.at, now)}${thread.unread ? '. Unread' : ''}`}
      >
        <div className="mb-line">
          <span className="mb-who">{who}</span>
          {thread.mails.length > 1 && <span className="mb-count">{thread.mails.length}</span>}
          <span className="mb-when-cell">{stamp(last.at, now)}</span>
        </div>
        <div className="mb-line">
          <span className="mb-subject">{last.subject}</span>
          {thread.attachments > 0 && <Paperclip size={13} />}
        </div>
        <div className="mb-snippet">{last.snippet || last.body.slice(0, 200)}</div>
        {last.courseId && (
          <div style={{ marginTop: 'var(--sp-2)' }}>
            <CourseTag id={last.courseId} />
          </div>
        )}
      </button>

      {/* Where the date was. Hidden on a touch device by the stylesheet — the
          same four are in the toolbar and in the message itself. */}
      <div className="mb-hover">
        <button type="button" className="mb-ico" aria-label={`Archive ${last.subject}`} onClick={onArchive}>
          <ArchiveIcon size={17} />
        </button>
        <button type="button" className="mb-ico" aria-label={`Delete ${last.subject}`} onClick={onTrash}>
          <TrashIcon size={17} />
        </button>
        <button type="button" className="mb-ico" aria-label={`Snooze ${last.subject}`} onClick={onSnooze}>
          <ClockIcon size={17} />
        </button>
        <button
          type="button"
          className="mb-ico"
          aria-label={thread.unread ? `Mark ${last.subject} read` : `Mark ${last.subject} unread`}
          onClick={onRead}
        >
          <OpenedIcon size={17} />
        </button>
      </div>
    </div>
  );
}

/** The monogram, where a client would fetch somebody's photograph. */
export function Face({ mail }: { mail: Thread['last'] }) {
  return <span className="mb-face">{initials(mail.from)}</span>;
}
