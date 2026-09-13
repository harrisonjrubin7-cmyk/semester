import { InboxIcon, ArchiveIcon, ClockIcon, EditIcon, NotesIcon, SendIcon, SpamIcon, StarIcon, TagIcon, TrashIcon } from '../Icons';
import { FOLDERS, type FolderId, type Mail, type Marks } from '../../lib/mailbox';
import { unread } from '../../lib/mailbox';

/**
 * The folder rail, which is the one part of a mail client nobody has ever had
 * to be shown how to use.
 *
 * Compose at the top because that is where it is in both clients and because
 * it is the only thing on this screen somebody arrives wanting to do. Then the
 * eight folders with their unread counts, then your courses as labels — the
 * app's own addition, and the reason this mailbox is in a study app at all: a
 * message that names ECON 1020 is filed under ECON 1020 without anybody
 * setting up a filter.
 */
export function Rail({
  folder,
  mails,
  marks,
  now,
  labels,
  label,
  onFolder,
  onLabel,
  onCompose,
}: {
  folder: FolderId;
  mails: Mail[];
  marks: Marks;
  now: number;
  /** Your courses, as labels. Code and id. */
  labels: { id: string; code: string }[];
  /** The label being filtered on, or ''. */
  label: string;
  onFolder: (id: FolderId) => void;
  onLabel: (code: string) => void;
  onCompose: () => void;
}) {
  const glyph = (id: FolderId) => {
    if (id === 'inbox') return <InboxIcon size={17} />;
    if (id === 'starred') return <StarIcon size={17} on={false} />;
    if (id === 'snoozed') return <ClockIcon size={17} />;
    if (id === 'drafts') return <NotesIcon size={17} />;
    if (id === 'sent') return <SendIcon size={17} />;
    if (id === 'archive') return <ArchiveIcon size={17} />;
    if (id === 'spam') return <SpamIcon size={17} />;
    return <TrashIcon size={17} />;
  };

  return (
    <nav className="mb-rail" aria-label="Folders">
      <button
        type="button"
        className="btn btn-primary"
        onClick={onCompose}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-3)', height: 44, marginBottom: 'var(--sp-4)' }}
      >
        <EditIcon size={17} />
        Compose
      </button>

      {FOLDERS.map((f) => {
        const n = unread(mails, f.id, marks, now);
        // Drafts and Sent count what is in them rather than what is unread:
        // nothing you wrote yourself is ever unread, and a Drafts folder with
        // no number beside it is one people forget they have things in.
        const held = f.id === 'drafts' || f.id === 'sent'
          ? mails.filter((m) => (marks[m.id]?.folder ?? m.folder) === f.id).length
          : n;
        return (
          <button
            key={f.id}
            type="button"
            className="mb-folder"
            aria-current={folder === f.id && !label}
            title={f.blurb}
            onClick={() => onFolder(f.id)}
          >
            {glyph(f.id)}
            <span className="mb-folder-name">{f.label}</span>
            {held > 0 && <span className="mb-folder-n">{held}</span>}
          </button>
        );
      })}

      {labels.length > 0 && (
        <>
          <div
            className="mb-folder-n"
            style={{ padding: 'var(--sp-5) var(--sp-4) var(--sp-2)', letterSpacing: '0.09em', textTransform: 'uppercase' }}
          >
            Your courses
          </div>
          {labels.map((c) => (
            <button
              key={c.id}
              type="button"
              className="mb-folder"
              aria-current={label === c.code}
              onClick={() => onLabel(c.code)}
            >
              <TagIcon size={17} />
              <span className="mb-folder-name">{c.code}</span>
            </button>
          ))}
        </>
      )}
    </nav>
  );
}
