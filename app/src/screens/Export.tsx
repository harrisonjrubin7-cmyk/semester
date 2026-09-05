import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { Snapshots } from '../components/Snapshots';
import { SectionLabel, TickBox } from '../components/ui';
import { PROVIDERS, tokens, type ProviderId } from '../lib/connect';
import { datedItems } from '../lib/select';
import {
  ALARMS,
  appointmentEvents,
  backupOf,
  coursesMarkdown,
  deadlineCsv,
  deadlineEvents,
  notesMarkdown,
  readBackup,
  stampedName,
  taskCsv,
  toIcs,
} from '../lib/export';
import { download, filePieces, sendTo, zipOf, type Piece } from '../lib/deliver';

type PartId = 'courses' | 'deadlines' | 'calendar' | 'notes' | 'tasks' | 'files' | 'backup';

const PARTS: { id: PartId; label: string; blurb: string; format: string }[] = [
  {
    id: 'courses',
    label: 'Courses',
    blurb: 'Each course, its professor, how the grade is built, every deadline.',
    format: 'Markdown',
  },
  {
    id: 'deadlines',
    label: 'Deadlines',
    blurb: 'One row each, with what it is worth and whether you did it.',
    format: 'CSV',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    blurb:
      'Deadlines and appointments, with a reminder the evening before and an hour before each.',
    format: 'ICS',
  },
  { id: 'notes', label: 'Notes', blurb: 'Everything you wrote, including transcripts and email drafts.', format: 'Markdown' },
  { id: 'tasks', label: 'Tasks', blurb: 'Your own to-do list, dated and dead.', format: 'CSV' },
  {
    id: 'files',
    label: 'Attachments',
    blurb: 'The PDFs, photos and recordings themselves. Zip only.',
    format: 'Files',
  },
  {
    id: 'backup',
    label: 'Everything, as data',
    blurb: 'The whole account in one file — the one to keep if you keep one.',
    format: 'JSON',
  },
];

/**
 * Getting your work back out.
 *
 * An app that holds a semester of notes, deadlines and transcripts and offers
 * no way to take them anywhere is a trap, however good it is. So: plain
 * formats, chosen because other software reads them — CSV a spreadsheet opens,
 * Markdown any editor reads, .ics every calendar imports, and one JSON file
 * that is the whole account.
 *
 * Drive and OneDrive are offered because that is where student work already
 * lives. Drive is asked for `drive.file`, the narrow scope that reaches only
 * files this app itself creates — saving an export there gives the app no
 * right to read anything else in your Drive, and that is worth knowing.
 */
export function Export() {
  const { state, dispatch, now, catalog } = useStore();
  const [picked, setPicked] = useState<Record<PartId, boolean>>({
    courses: true,
    deadlines: true,
    calendar: true,
    notes: true,
    tasks: true,
    files: false,
    backup: true,
  });
  const [busy, setBusy] = useState('');
  const [offered, setOffered] = useState<{ parts: string[]; data: Record<string, unknown> } | null>(
    null,
  );
  const restoreInput = useRef<HTMLInputElement>(null);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const code = (id: string) => catalog.byId[id]?.code ?? id;
  const items = datedItems(catalog, now);
  const stem = stampedName('semester', now);

  const build = async (forZip: boolean): Promise<Piece[]> => {
    const out: Piece[] = [];
    if (picked.courses) {
      out.push({
        name: `${stem}-courses.md`,
        body: coursesMarkdown(catalog, items),
        mime: 'text/markdown',
      });
    }
    if (picked.deadlines) {
      out.push({
        name: `${stem}-deadlines.csv`,
        body: deadlineCsv(items, state.done, code),
        mime: 'text/csv',
      });
    }
    if (picked.calendar) {
      out.push({
        name: `${stem}.ics`,
        body: toIcs(
          [...deadlineEvents(items, code, ALARMS), ...appointmentEvents(state.appointments)],
          'Semester',
        ),
        mime: 'text/calendar',
      });
    }
    if (picked.notes) {
      out.push({
        name: `${stem}-notes.md`,
        body: notesMarkdown(state.notes, code),
        mime: 'text/markdown',
      });
    }
    if (picked.tasks) {
      out.push({
        name: `${stem}-tasks.csv`,
        body: taskCsv(state.tasks, code),
        mime: 'text/csv',
      });
    }
    if (picked.backup) {
      out.push({
        name: `${stem}-backup.json`,
        body: JSON.stringify(backupOf(state), null, 2),
        mime: 'application/json',
      });
    }
    if (picked.files && forZip) {
      const got = await filePieces();
      out.push(...got.pieces);
      if (got.missing > 0) {
        setError(
          `${got.missing} attachment${got.missing === 1 ? '' : 's'} could not be read and ` +
            'were left out — the browser has reclaimed that storage.',
        );
      }
    }
    return out;
  };

  const run = async (what: string, fn: () => Promise<string>) => {
    setBusy(what);
    setError('');
    setDone('');
    try {
      setDone(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  const saveSeparately = () =>
    void run('Saving…', async () => {
      const pieces = await build(false);
      if (pieces.length === 0) throw new Error('Nothing is ticked.');
      for (const piece of pieces) download(piece);
      return `${pieces.length} file${pieces.length === 1 ? '' : 's'} saved to this device.`;
    });

  const saveZip = () =>
    void run('Packing…', async () => {
      const pieces = await build(true);
      if (pieces.length === 0) throw new Error('Nothing is ticked.');
      const zip = await zipOf(pieces);
      download({ name: `${stem}.zip`, body: zip, mime: 'application/zip' });
      return `${pieces.length} things packed into ${stem}.zip.`;
    });

  const push = (id: ProviderId) =>
    void run(`Sending to ${PROVIDERS[id].name}…`, async () => {
      const pieces = await build(true);
      if (pieces.length === 0) throw new Error('Nothing is ticked.');
      const zip = await zipOf(pieces);
      const landed = await sendTo(id, { name: `${stem}.zip`, body: zip, mime: 'application/zip' });
      return landed.link
        ? `Saved to ${PROVIDERS[id].name} as ${landed.name}. It is at ${landed.link}`
        : `Saved to ${PROVIDERS[id].name} as ${landed.name}.`;
    });

  const counts: Record<PartId, number> = {
    courses: catalog.courses.length,
    deadlines: items.length,
    calendar: items.length + state.appointments.length,
    notes: state.notes.length,
    tasks: state.tasks.length,
    files: 0,
    backup: 1,
  };

  const held = tokens();
  const clouds = (['google', 'microsoft'] as ProviderId[]).filter((id) => !!held[id]);

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        Plain formats, chosen because other software reads them. Nothing here is a bundle only this
        app understands — that would be the same trap with extra steps.
      </div>

      <SectionLabel>What to take</SectionLabel>
      {PARTS.map((part) => (
        <div
          key={part.id}
          style={{
            display: 'flex',
            gap: 11,
            alignItems: 'center',
            borderBottom: '1px solid var(--app-line)',
          }}
        >
          <button
            type="button"
            className="bare tappable"
            onClick={() => setPicked((p) => ({ ...p, [part.id]: !p[part.id] }))}
            aria-label={`${picked[part.id] ? 'Leave out' : 'Include'} ${part.label}`}
            style={{ flex: 'none', width: 30, padding: '13px 2px 13px 0' }}
          >
            <TickBox on={picked[part.id]} />
          </button>
          <div style={{ flex: 1, minWidth: 0, padding: '12px 0' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontSize: 'calc(14.5px * var(--text-scale, 1))' }}>{part.label}</span>
              <span className="tag tag-neutral" style={{ flex: 'none' }}>
                {part.format}
              </span>
              {counts[part.id] > 0 && part.id !== 'backup' && (
                <span style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45 }}>{counts[part.id]}</span>
              )}
            </div>
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2, lineHeight: 1.4 }}>
              {part.blurb}
            </div>
          </div>
        </div>
      ))}

      <SectionLabel>Where it goes</SectionLabel>
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!!busy}
        onClick={saveZip}
        style={{ height: 46, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {busy === 'Packing…' ? 'Packing…' : 'Download as one zip'}
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-block"
        disabled={!!busy}
        onClick={saveSeparately}
        style={{ height: 44, marginTop: 8 }}
      >
        Download as separate files
      </button>

      {clouds.map((id) => (
        <button
          key={id}
          type="button"
          className="btn btn-secondary btn-block"
          disabled={!!busy}
          onClick={() => push(id)}
          style={{ height: 44, marginTop: 8 }}
        >
          {busy.startsWith('Sending') ? busy : `Save to ${PROVIDERS[id].name}`}
        </button>
      ))}

      {clouds.length === 0 && (
        <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55, marginTop: 12, lineHeight: 1.5 }}>
          Connect Google or Microsoft under Me → Connect accounts and the zip can go straight to
          Drive or OneDrive. Drive is asked only for permission to touch files this app creates —
          it gains no right to read what is already there.
        </div>
      )}

      {done ? (
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', marginTop: 14, lineHeight: 1.5, opacity: 0.85 }}>{done}</div>
      ) : null}
      {error ? (
        <div
          style={{ fontSize: 'calc(13px * var(--text-scale, 1))', marginTop: 14, lineHeight: 1.5, color: 'var(--app-warn)' }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 22 }}>
        <Snapshots />
      </div>

      <SectionLabel>Bring one back</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5, marginBottom: 10 }}>
        A backup file from this app, from any device. An export nobody can import is a museum
        piece.
      </div>
      <input
        ref={restoreInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setError('');
          setDone('');
          setOffered(null);
          void file
            .text()
            .then((raw) => setOffered(readBackup(raw)))
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : String(err)),
            );
        }}
      />
      <button
        type="button"
        className="btn btn-secondary btn-block"
        disabled={!!busy}
        onClick={() => restoreInput.current?.click()}
        style={{ height: 44 }}
      >
        Restore from a backup file
      </button>

      {offered && (
        <Blueprint style={{ padding: '13px 14px', marginTop: 10 }}>
          <div className="kicker">Ready to restore</div>
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', marginTop: 7, lineHeight: 1.5 }}>
            {offered.parts.length > 0 ? offered.parts.join(', ') : 'an empty backup'}.
          </div>
          <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.65, marginTop: 8, lineHeight: 1.5 }}>
            This replaces what is on this device for each of those, rather than merging — merging
            two semesters produces duplicate courses sharing an id and no way to tell which
            deadline belonged to which. Anything the file does not cover is left alone.
            Attachments are not in a backup; they are in the zip beside it.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOffered(null)}
              style={{ flex: 1, height: 42 }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                dispatch({ type: 'restore', persisted: offered.data as never });
                setOffered(null);
                setDone('Restored. Everything in the file is in place.');
              }}
              style={{ flex: 1, height: 42 }}
            >
              Replace and restore
            </button>
          </div>
        </Blueprint>
      )}

      <Blueprint style={{ padding: '13px 14px', marginTop: 18 }}>
        <div className="kicker">The backup file</div>
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.75, marginTop: 6, lineHeight: 1.5 }}>
          It holds your courses, notes, tasks, appointments, grades, saved places and what you have
          ticked off — everything except the attachments, which are in the zip beside it. Keys and
          the tokens for connected accounts are deliberately left out: a backup that carries your
          credentials is a liability, not a safety net.
        </div>
      </Blueprint>
      <div style={{ height: 26 }} />
    </div>
  );
}
