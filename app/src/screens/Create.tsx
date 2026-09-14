import { useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { ActionButton, FilePick, Notice, SectionLabel } from '../components/ui';
import { CardGrid, GridCard } from '../components/GridCard';
import { secondLine } from '../lib/dim';
import { FormBuilder } from '../components/creation/FormBuilder';
import { DesignEditor } from '../components/creation/DesignEditor';
import { VideoEditor } from '../components/creation/VideoEditor';
import { useDeviceLibrary } from '../lib/device-library';
import { CREATION_LIMIT, EMPTY_CREATIONS, newCreation, readCreations, type CreativeProject } from '../lib/creations';
import { download } from '../lib/deliver';
import { addFile } from '../lib/files';
import type { Screen } from '../lib/types';

/**
 * One door to everything that makes something.
 *
 * The app could already write a document, build a deck and fill a
 * spreadsheet, on three screens a student had to know the names of. This is
 * the place you go when you know what you want to *make* and not which screen
 * makes it — and it adds the three that had nowhere to live: a form, a
 * design, a video.
 *
 * ## Nine tiles, six of which go somewhere else
 *
 * Documents, decks, spreadsheets, maths activities, study guides and notes
 * all have real homes, and tapping those tiles dispatches straight to them
 * rather than reimplementing anything. Only forms, designs and videos are
 * *this* screen's: they share the `CreativeProject` shape and the device
 * library in `lib/creations.ts`.
 *
 * That asymmetry is the honest arrangement, not an oversight. A second
 * document editor here would be a second place documents could live.
 *
 * ## A project remembers which course it is for
 *
 * Chosen before it is created, so an export lands in Files against the right
 * course and assignment without anybody filing it afterwards.
 */

/** The nine, and where each one goes. `kind` means this screen owns it. */
const MAKE: { title: string; sub: string; kind?: CreativeProject['kind']; go?: Screen; act?: 'write' | 'sheet' | 'deck' }[] = [
  { title: 'Document', sub: 'Papers, notes and research', act: 'write' },
  { title: 'Presentation', sub: 'Slides and speaker notes', act: 'deck' },
  { title: 'Spreadsheet', sub: 'Data, formulas and charts', act: 'sheet' },
  { title: 'Form', sub: 'Questions and practice quizzes', kind: 'form' },
  { title: 'Design', sub: 'Posters, graphics and diagrams', kind: 'design' },
  { title: 'Video', sub: 'Trim, arrange and caption clips', kind: 'video' },
  { title: 'Maths', sub: 'Functions, graphs and tables', go: 'draw' },
  { title: 'Study guide', sub: 'One course, eleven ways', go: 'study' },
  { title: 'Notes', sub: 'Catch and connect ideas', go: 'mine' },
];

export function Create() {
  const { state, account } = useStore();
  const scope = `${account?.id || 'device'}:${state.term}`;
  return <Workspace key={scope} storageKey={`semester.creations.v1:${scope}`} />;
}

function Workspace({ storageKey }: { storageKey: string }) {
  const { dispatch, catalog } = useStore();
  const lib = useDeviceLibrary(storageKey, readCreations, EMPTY_CREATIONS);

  const [id, setId] = useState('');
  const [query, setQuery] = useState('');
  const [archive, setArchive] = useState(false);
  const [notice, setNotice] = useState('');
  const [courseId, setCourseId] = useState('');
  const [itemId, setItemId] = useState('');

  const project = lib.value.projects.find((p) => p.id === id);

  const update = (patch: Partial<CreativeProject>) =>
    lib.update((old) => ({
      ...old,
      projects: old.projects.map((p) => (p.id === id ? { ...p, ...patch, updated: Date.now() } : p)),
    }));

  const create = (kind: CreativeProject['kind']) => {
    if (lib.value.projects.length >= CREATION_LIMIT) {
      setNotice(`This library holds ${CREATION_LIMIT} projects. Export a backup and archive some.`);
      return;
    }
    const p = newCreation(kind, courseId, itemId);
    if (lib.update((old) => ({ ...old, projects: [p, ...old.projects] }))) setId(p.id);
  };

  const line = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
  const field = { display: 'block', marginBottom: 'var(--sp-5)' } as const;
  const input = { width: '100%', marginTop: 'var(--sp-2)' } as const;
  const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' } as const;

  const showing = lib.value.projects.filter(
    (p) => p.archived === archive && `${p.title} ${p.kind}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Page>
      {(lib.error || notice) && (
        <Notice>
          {lib.error || notice}
          {lib.blocked && (
            <ActionButton
              onClick={() =>
                download({ name: 'Creative project recovery.json', body: lib.recovery(), mime: 'application/json' })
              }
              style={{ marginTop: 'var(--sp-4)' }}
            >
              Download recovery copy
            </ActionButton>
          )}
        </Notice>
      )}

      {project ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <ActionButton onClick={() => setId('')} style={{ flex: '1 1 auto' }}>
              ← Everything
            </ActionButton>
            <ActionButton
              onClick={() => {
                if (lib.value.projects.length >= CREATION_LIMIT) return setNotice('The library is full.');
                const copy = structuredClone(project);
                copy.id = crypto.randomUUID();
                copy.title = `${project.title} copy`.slice(0, 160);
                /*
                 * A duplicate starts with no responses and no linked sheet.
                 * This is what the form builder offers instead of letting
                 * somebody edit questions people have already answered, so
                 * carrying the answers across would defeat the whole point.
                 */
                copy.form.responses = [];
                copy.form.sheetId = null;
                if (lib.update((old) => ({ ...old, projects: [copy, ...old.projects] }))) setId(copy.id);
              }}
              style={{ flex: '1 1 auto' }}
            >
              Duplicate
            </ActionButton>
            <ActionButton
              onClick={async () => {
                try {
                  await addFile(
                    new File([JSON.stringify({ version: 1, projects: [project] }, null, 2)], `${project.title}.semester.json`, {
                      type: 'application/json',
                    }),
                    project.courseId || null,
                    null,
                    project.title,
                    project.itemId || null,
                  );
                  setNotice('An editable backup is in Files. Pictures and footage stay there separately.');
                } catch (e) {
                  setNotice((e as Error).message);
                }
              }}
              style={{ flex: '1 1 auto' }}
            >
              Back it up
            </ActionButton>
            <ActionButton
              onClick={() => {
                update({ archived: !project.archived });
                setId('');
              }}
              style={{ flex: '1 1 auto' }}
            >
              {project.archived ? 'Restore' : 'Archive'}
            </ActionButton>
          </div>

          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Title</span>
            <input
              value={project.title}
              maxLength={160}
              onChange={(e) => update({ title: e.target.value })}
              style={input}
            />
          </label>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Course</span>
            <select
              value={project.courseId}
              onChange={(e) => update({ courseId: e.target.value, itemId: '' })}
              style={input}
            >
              <option value="">Nothing in particular</option>
              {catalog.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </label>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>For</span>
            <select value={project.itemId} onChange={(e) => update({ itemId: e.target.value })} style={input}>
              <option value="">No deadline</option>
              {catalog.items
                .filter((i) => !project.courseId || i.c === project.courseId)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
            </select>
          </label>

          <fieldset disabled={lib.blocked} style={{ border: 0, padding: 0, minWidth: 0 }}>
            {project.kind === 'form' ? (
              <FormBuilder key={project.id} project={project} onChange={update} />
            ) : project.kind === 'design' ? (
              <DesignEditor key={project.id} project={project} onChange={update} />
            ) : (
              <VideoEditor key={project.id} project={project} onChange={update} />
            )}
          </fieldset>
        </>
      ) : (
        <>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>For which course</span>
            <select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setItemId('');
              }}
              style={input}
            >
              <option value="">Nothing in particular</option>
              {catalog.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </label>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>For which deadline</span>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} style={input}>
              <option value="">No deadline</option>
              {catalog.items
                .filter((i) => !courseId || i.c === courseId)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
            </select>
          </label>

          <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>Make</SectionLabel>
          <CardGrid min={150}>
            {MAKE.map((m) => (
              <GridCard
                key={m.title}
                label={m.title}
                title={m.sub}
                onClick={() => {
                  if (m.kind) return create(m.kind);
                  if (m.act === 'write') return dispatch({ type: 'newDocument', courseId: courseId || null, itemId: itemId || null });
                  if (m.act === 'sheet') return dispatch({ type: 'newSheet', courseId: courseId || null, itemId: itemId || null });
                  if (m.act === 'deck') return dispatch({ type: 'newDeck', courseId: courseId || null, itemId: itemId || null });
                  if (m.go) dispatch({ type: 'go', screen: m.go });
                }}
              />
            ))}
          </CardGrid>

          <SectionLabel
            aside={`${showing.length}`}
            style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}
          >
            {archive ? 'Archived' : 'Yours'}
          </SectionLabel>
          <input
            aria-label="Search your projects"
            placeholder="Search forms, designs and videos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', marginBottom: 'var(--sp-4)' }}
          />
          {showing.length === 0 ? (
            <p style={{ ...body, ...secondLine(), textWrap: 'pretty' }}>
              {archive
                ? 'Nothing archived.'
                : 'Nothing yet. Start a form, a design or a video above — documents, presentations and spreadsheets stay in their own libraries.'}
            </p>
          ) : (
            <CardGrid min={150}>
              {showing.map((p) => (
                <GridCard
                  key={p.id}
                  label={p.title}
                  meta={catalog.courses.find((c) => c.id === p.courseId)?.code || p.kind}
                  title={`${p.kind} · edited ${new Date(p.updated).toLocaleDateString()}`}
                  onClick={() => setId(p.id)}
                />
              ))}
            </CardGrid>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBlock: 'var(--sp-6)' }}>
            <ActionButton onClick={() => setArchive(!archive)} aria-pressed={archive} style={{ flex: '1 1 auto' }}>
              {archive ? 'Show yours' : 'Show archive'}
            </ActionButton>
            <ActionButton
              onClick={() =>
                download({
                  name: 'Semester creative projects.json',
                  body: JSON.stringify(lib.value, null, 2),
                  mime: 'application/json',
                })
              }
              style={{ flex: '1 1 auto' }}
            >
              Export
            </ActionButton>
          </div>
          <FilePick
            accept=".json"
            multiple={false}
            onPick={async (files) => {
              try {
                const f = files[0];
                if (!f) return;
                if (f.size > 3_000_000) throw new Error('Choose an export smaller than 3 MB.');
                const got = readCreations(JSON.parse(await f.text()));
                if (got.projects.length + lib.value.projects.length > CREATION_LIMIT) {
                  throw new Error(`That would go past ${CREATION_LIMIT} projects.`);
                }
                lib.update((old) => ({
                  ...old,
                  // New ids so an import adds; no linked sheet, because the
                  // sheet it named belongs to whoever exported it.
                  projects: [
                    ...got.projects.map((p) => ({ ...p, id: crypto.randomUUID(), form: { ...p.form, sheetId: null } })),
                    ...old.projects,
                  ],
                }));
                setNotice('Imported as new copies. Pictures and footage need their original files on this device.');
              } catch (e) {
                setNotice((e as Error).message);
              }
            }}
          >
            Import projects
          </FilePick>

          <p style={{ ...line, marginBlock: 'var(--sp-5)', textWrap: 'pretty' }}>
            These live on this device, under your account and this term. Export a backup to carry them
            somewhere else.
          </p>
        </>
      )}
    </Page>
  );
}
