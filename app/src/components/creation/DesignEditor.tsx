import { useEffect, useRef, useState } from 'react';
import { ActionButton, FilePick, SectionLabel } from '../ui';
import { secondLine } from '../../lib/dim';
import { addFile, getFile } from '../../lib/files';
import { cloudConfigured } from '../../lib/cloud';
import { download } from '../../lib/deliver';
import { designSvg, newLayer, type CreativeProject, type DesignData, type DesignLayer } from '../../lib/creations';
import { TEMPLATES, apply as applyTemplate } from '../../lib/designtemplates';
import { changes, describe as describeCanvas, foldAll, type Seen } from '../../lib/coedit';
import { share, type Sharing } from '../../lib/cocanvas';

/**
 * A canvas: text, shapes and pictures on a page, exported as an image.
 *
 * For the poster, the diagram and the one slide that has to look like
 * something. Small on purpose — four layer kinds and a colour — because the
 * alternative is a worse version of a design tool the student already has,
 * and what is actually missing is somewhere to make a conference poster at
 * eleven at night without leaving the app their material is in.
 *
 * ## The picture is not in the project
 *
 * A layer holds a `fileId` into `lib/files.ts`. The data URI it draws with is
 * loaded on mount into `images` and never stored, which is why a project
 * export is small, and why importing one says the originals are still needed.
 *
 * ## Undo is a stack of whole canvases
 *
 * Thirty of them, and each drag pushes exactly one — recorded on
 * `pointerdown`, before the move, so undoing a drag returns to where it
 * started rather than to the last frame of it. The moves themselves call
 * `onChange` without recording, which is the whole trick.
 *
 * ## It works without a pointer
 *
 * Every layer is a focusable control with a name, Enter selects it, and the
 * arrow keys nudge it five units. A canvas editor that can only be used by
 * dragging is one a keyboard user cannot use at all.
 */

/** A blob as a data URI, for drawing into an `<image>`. */
const readData = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

const MAX_LAYERS = 60;
const UNDO = 30;

export function DesignEditor({
  project,
  onChange,
}: {
  project: CreativeProject;
  onChange: (patch: Partial<CreativeProject>) => void;
}) {
  const d = project.design;
  const [selected, setSelected] = useState('');
  const [images, setImages] = useState<Record<string, string>>({});
  /*
   * Sharing this canvas.
   *
   * `me` is this tab, not this account — the same model `lib/mesh.ts` uses and
   * for the same reason: somebody with the canvas open on a laptop and a phone
   * really is two editors, and the id is what settles a collision between
   * them. `seen` is what this device has applied per layer, including the
   * tombstones; `wire` is the channel, in a ref because `change` is rebuilt on
   * every render and must not restart the connection.
   */
  const [me] = useState(() => crypto.randomUUID());
  const [sharing, setSharing] = useState(false);
  /*
   * Why sharing stopped, shown *at the switch*.
   *
   * The first draft sent this to `notice`, which renders a hundred lines of
   * JSX further down the page. Switching sharing on with no connection made
   * the box tick, untick itself, and say nothing anybody could see without
   * scrolling — which reads exactly like a broken switch. A failure has to
   * appear where the thing that failed is.
   */
  const [shareTrouble, setShareTrouble] = useState('');
  /* `remote` rebuilt every render; the effect below is made once. */
  const remoteRef = useRef<(next: DesignData) => void>(() => {});
  const [alsoHere, setAlsoHere] = useState<string[]>([]);
  const seen = useRef<Seen>({});
  const wire = useRef<Sharing | null>(null);
  /* The canvas as the effect last saw it, so a late arrival can be described. */
  const latest = useRef(project.design);
  latest.current = project.design;
  const [notice, setNotice] = useState('');
  const [past, setPast] = useState<DesignData[]>([]);
  const [future, setFuture] = useState<DesignData[]>([]);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  /*
   * Keyed on the file ids rather than on `d.layers`, so moving a layer does
   * not re-read every picture off disk on every frame of a drag.
   */
  const fileKey = d.layers.map((l) => l.fileId).join('|');
  useEffect(() => {
    let alive = true;
    void Promise.all(
      d.layers
        .filter((l) => l.kind === 'image')
        .map(async (l) => {
          const f = await getFile(l.fileId);
          return [l.fileId, f ? await readData(f.blob) : ''] as const;
        }),
    )
      .then((entries) => {
        if (alive) setImages(Object.fromEntries(entries));
      })
      .catch(() => setNotice('An image could not be loaded. Its file may have been removed from Files.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey]);

  /*
   * Joining and leaving.
   *
   * On arrival this device asks for the canvas — `ask` — and anybody already
   * here answers with `describe`. A device that has layers of its own ignores
   * the answer, which is the rule in `lib/coedit.ts` that stops a joiner
   * flattening somebody's afternoon.
   */
  useEffect(() => {
    if (!sharing) return;
    let live = true;
    let joined: Sharing | null = null;

    /*
     * No name is sent.
     *
     * The call asks for one in its green room; a canvas has no such moment,
     * and the app has no global display name to reach for. Inventing one — an
     * email prefix, "Student" — would be putting a name on somebody that they
     * never chose. So presence carries nothing and the screen says how many
     * other people are here rather than who, which is the true statement.
     */
    void share(project.id, me, '', {
      onEdits: (edits) => {
        if (!live) return;
        const out = foldAll(latest.current, seen.current, edits);
        seen.current = out.seen;
        if (out.changed) remoteRef.current(out.canvas);
      },
      onAsked: () => joined?.send([describeCanvas(latest.current, me, Date.now())]),
      onHere: (names) => live && setAlsoHere(names),
      onTrouble: (said) => {
        if (!live) return;
        setShareTrouble(said);
        setSharing(false);
      },
    })
      .then((s) => {
        if (!live) {
          s.leave();
          return;
        }
        joined = s;
        wire.current = s;
        s.ask();
      })
      .catch((e: unknown) => {
        if (!live) return;
        setShareTrouble(e instanceof Error ? e.message : 'The shared canvas could not be reached.');
        setSharing(false);
      });

    return () => {
      live = false;
      wire.current = null;
      joined?.leave();
      setAlsoHere([]);
    };
    // `project.id` cannot change without this component being rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing]);

  /** A change worth undoing. Drags record once, on the way in. */
  const change = (next: DesignData, record = true) => {
    if (record) {
      setPast((p) => [...p.slice(-(UNDO - 1)), d]);
      setFuture([]);
    }
    // What changed here, to whoever else is on this canvas. Worked out by
    // comparing rather than by the editor knowing — see `lib/coedit.ts`.
    if (wire.current) wire.current.send(changes(d, next, me, Date.now()));
    onChange({ design: next });
  };

  /**
   * Somebody else's change, applied without touching undo.
   *
   * This is the distinction that matters, and it is one line: a remote edit
   * never goes on `past`. Undo is *your* history — a stack that also held your
   * collaborator's moves would let you undo their work, which is not what the
   * button says and not a thing anybody wants to discover.
   */
  const remote = (next: DesignData) => onChange({ design: next });
  remoteRef.current = remote;

  const patch = (p: Partial<DesignLayer>) =>
    change({ ...d, layers: d.layers.map((l) => (l.id === selected ? { ...l, ...p } : l)) });

  const add = (kind: DesignLayer['kind'], fileId = '') => {
    if (d.layers.length >= MAX_LAYERS) return setNotice(`A design holds ${MAX_LAYERS} layers.`);
    // Its numbers are artwork rather than style — see `newLayer`.
    const layer = newLayer(kind, d, fileId);
    change({ ...d, layers: [...d.layers, layer] });
    setSelected(layer.id);
  };

  /**
   * The canvas as a file.
   *
   * SVG is the document itself. PNG and JPG go through an `<img>` and a
   * canvas, because that is the only way a browser rasterises SVG — and the
   * object URL is revoked in a `finally`, since the failure path is a picture
   * that would not decode and leaking on exactly that path is how a long
   * editing session ends up holding every failed export.
   */
  const exportDesign = async (format: 'svg' | 'png' | 'jpeg', save = false) => {
    try {
      const body = designSvg(d, images);
      let blob: Blob;

      if (format === 'svg') {
        blob = new Blob([body], { type: 'image/svg+xml' });
      } else {
        const img = new Image();
        const url = URL.createObjectURL(new Blob([body], { type: 'image/svg+xml' }));
        try {
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('The image could not be rendered.'));
            img.src = url;
          });
          const canvas = document.createElement('canvas');
          canvas.width = d.width;
          canvas.height = d.height;
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed.'))), `image/${format}`, 0.94),
          );
        } finally {
          URL.revokeObjectURL(url);
        }
      }

      const name = `${project.title}.${format === 'jpeg' ? 'jpg' : format}`;
      if (save) {
        await addFile(new File([blob], name, { type: blob.type }), project.courseId || null, null, '', project.itemId || null);
        setNotice('Saved in Files, against this project’s course and assignment.');
      } else {
        download({ name, body: blob, mime: blob.type });
      }
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const l = d.layers.find((x) => x.id === selected);
  const line = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
  const field = { display: 'block', marginBottom: 'var(--sp-5)' } as const;
  const input = { width: '100%', marginTop: 'var(--sp-2)' } as const;

  /** Where a pointer is, in canvas units. */
  const at = (clientX: number, clientY: number) => {
    const rect = svg.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) * (d.width / rect.width), y: (clientY - rect.top) * (d.height / rect.height) };
  };

  return (
    <>
      {/*
        * Sharing this canvas.
        *
        * A switch rather than a link to copy, because the id a collaborator
        * needs is the project's own and it is already in the export and the
        * backup — there is nothing new to hand out, and a "copy link" button
        * would imply this canvas has an address on the web, which it does not.
        * What somebody else needs is this app, this project imported, and the
        * switch turned on.
        */}
      {cloudConfigured && (
        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-4)',
              fontSize: 'var(--type-base)',
              lineHeight: 'var(--leading-normal)',
            }}
          >
            <input
              type="checkbox"
              checked={sharing}
              onChange={(e) => {
                setShareTrouble('');
                setSharing(e.target.checked);
              }}
            />
            <span>Edit this with other people</span>
          </label>
          <div
            style={{
              fontSize: 'var(--type-xs)',
              ...secondLine(),
              marginTop: 'var(--sp-3)',
              lineHeight: 'var(--leading-normal)',
              textWrap: 'pretty',
            }}
          >
            {sharing
              ? alsoHere.length === 0
                ? 'On. Nobody else has this canvas open yet. Anybody with this project’s id and the app can join it, the way anybody with a call’s code can walk into the call.'
                : `${alsoHere.length === 1 ? 'One other person is' : `${alsoHere.length} other people are`} editing this canvas. Two people moving different layers never collide; two moving the same one end with the later change, and the earlier is lost.`
              : 'Off. This canvas is on this device only.'}
          </div>
          {shareTrouble && (
            <p
              role="status"
              style={{
                fontSize: 'var(--type-sm)',
                lineHeight: 'var(--leading-normal)',
                marginTop: 'var(--sp-3)',
                textWrap: 'pretty',
              }}
            >
              {shareTrouble}
            </p>
          )}
        </div>
      )}

      {/*
        * Somewhere to start.
        *
        * Offered only while the canvas is empty, and that is the whole of the
        * interaction design here: a template replaces everything, so a button
        * that could throw away an afternoon's work needs either a confirm or a
        * reason it cannot. This is the reason it cannot. Anybody who wants a
        * different template after starting makes a new design, which is one
        * tap and loses nothing.
        */}
      {d.layers.length === 0 && (
        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <SectionLabel style={{ marginBlock: '0 var(--sp-4)' }}>Start from</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            {TEMPLATES.map((t) => (
              <ActionButton
                key={t.id}
                onClick={() => change(applyTemplate(t))}
                title={t.about}
                style={{ flex: '1 1 auto' }}
              >
                {t.name}
              </ActionButton>
            ))}
          </div>
          <div
            style={{
              fontSize: 'var(--type-xs)',
              ...secondLine(),
              marginTop: 'var(--sp-4)',
              lineHeight: 'var(--leading-normal)',
              textWrap: 'pretty',
            }}
          >
            Every one of these is ordinary layers once it lands — move them, recolour them, delete the
            ones you do not want. Or start with a blank canvas and the three buttons below.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
        {(['text', 'rectangle', 'ellipse'] as const).map((k) => (
          <ActionButton key={k} onClick={() => add(k)} style={{ flex: '1 1 auto' }}>
            {k}
          </ActionButton>
        ))}
        <ActionButton
          disabled={!past.length}
          onClick={() => {
            setFuture((f) => [d, ...f]);
            onChange({ design: past[past.length - 1] });
            setPast((p) => p.slice(0, -1));
          }}
          style={{ flex: '1 1 auto' }}
        >
          Undo
        </ActionButton>
        <ActionButton
          disabled={!future.length}
          onClick={() => {
            setPast((p) => [...p, d]);
            onChange({ design: future[0] });
            setFuture((f) => f.slice(1));
          }}
          style={{ flex: '1 1 auto' }}
        >
          Redo
        </ActionButton>
      </div>

      <FilePick
        accept="image/png,image/jpeg,image/webp"
        multiple={false}
        onPick={async (files) => {
          try {
            const f = files[0];
            if (!f) return;
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size > 10_000_000) {
              throw new Error('Choose a PNG, JPG or WebP smaller than 10 MB.');
            }
            const saved = await addFile(f, project.courseId || null, null, '', project.itemId || null);
            add('image', saved.id);
          } catch (e) {
            setNotice((e as Error).message);
          }
        }}
      >
        Add a picture
      </FilePick>

      {notice && (
        <p
          role="status"
          style={{
            fontSize: 'var(--type-base)',
            lineHeight: 'var(--leading-normal)',
            border: '1px solid var(--app-line)',
            borderRadius: 'var(--r-md)',
            padding: 'var(--sp-5)',
            marginBlock: 'var(--sp-4)',
          }}
        >
          {notice}
        </p>
      )}

      <div
        style={{
          border: '1px solid var(--app-line)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--sp-4)',
          marginBlock: 'var(--sp-5)',
          overflow: 'hidden',
        }}
      >
        <svg
          ref={svg}
          viewBox={`0 0 ${d.width} ${d.height}`}
          role="group"
          aria-label="Design canvas"
          style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
          onPointerMove={(e) => {
            const g = drag.current;
            if (!g || !svg.current) return;
            const p = at(e.clientX, e.clientY);
            const x = Math.max(0, Math.min(d.width, p.x - g.dx));
            const y = Math.max(0, Math.min(d.height, p.y - g.dy));
            // Not recorded: `pointerdown` already pushed one undo step.
            onChange({ design: { ...d, layers: d.layers.map((l) => (l.id === g.id ? { ...l, x, y } : l)) } });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <rect width={d.width} height={d.height} fill={d.background} />
          {d.layers.map((layer, i) => (
            <g
              key={layer.id}
              role="button"
              tabIndex={0}
              aria-label={`${layer.kind} ${layer.text || i + 1}`}
              onClick={() => setSelected(layer.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(layer.id);
                }
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                  e.preventDefault();
                  const dx = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
                  const dy = e.key === 'ArrowDown' ? 5 : e.key === 'ArrowUp' ? -5 : 0;
                  change({
                    ...d,
                    layers: d.layers.map((x) =>
                      x.id === layer.id
                        ? {
                            ...x,
                            x: Math.max(0, Math.min(d.width, x.x + dx)),
                            y: Math.max(0, Math.min(d.height, x.y + dy)),
                          }
                        : x,
                    ),
                  });
                }
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setSelected(layer.id);
                const p = at(e.clientX, e.clientY);
                // One undo step for the whole drag, before it starts.
                setPast((old) => [...old.slice(-(UNDO - 1)), d]);
                setFuture([]);
                drag.current = { id: layer.id, dx: p.x - layer.x, dy: p.y - layer.y };
              }}
            >
              {layer.kind === 'text' ? (
                <text
                  x={layer.x}
                  y={layer.y + layer.fontSize}
                  fill={layer.fill}
                  fontSize={layer.fontSize}
                  fontFamily="Arial,sans-serif"
                  fontWeight={layer.bold ? 700 : 400}
                >
                  {layer.text.split('\n').map((t, j) => (
                    <tspan key={j} x={layer.x} dy={j ? layer.fontSize * 1.25 : 0}>
                      {t}
                    </tspan>
                  ))}
                </text>
              ) : layer.kind === 'ellipse' ? (
                <ellipse cx={layer.x + layer.w / 2} cy={layer.y + layer.h / 2} rx={layer.w / 2} ry={layer.h / 2} fill={layer.fill} />
              ) : layer.kind === 'image' ? (
                <image x={layer.x} y={layer.y} width={layer.w} height={layer.h} href={images[layer.fileId]} />
              ) : (
                <rect x={layer.x} y={layer.y} width={layer.w} height={layer.h} fill={layer.fill} />
              )}
              {layer.id === selected && (
                <rect
                  x={layer.x}
                  y={layer.y}
                  width={layer.w}
                  height={layer.h}
                  fill="none"
                  stroke="#1a73e8"
                  strokeWidth={3}
                  strokeDasharray="8 4"
                />
              )}
            </g>
          ))}
        </svg>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
        {(['svg', 'png', 'jpeg'] as const).map((k) => (
          <ActionButton key={k} onClick={() => void exportDesign(k)} style={{ flex: '1 1 auto' }}>
            {k === 'jpeg' ? 'JPG' : k.toUpperCase()}
          </ActionButton>
        ))}
        <ActionButton tone="primary" onClick={() => void exportDesign('png', true)} style={{ flex: '1 1 auto' }}>
          Save in Files
        </ActionButton>
      </div>

      <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>The page</SectionLabel>
      <label style={field}>
        <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Background</span>
        <input
          type="color"
          value={d.background}
          onChange={(e) => change({ ...d, background: e.target.value })}
          style={input}
        />
      </label>
      {(['width', 'height'] as const).map((k) => (
        <label key={k} style={field}>
          <span style={{ fontSize: 'var(--type-sm)', ...secondLine(), textTransform: 'capitalize' }}>{k}</span>
          <input
            type="number"
            min={200}
            max={2400}
            value={d[k]}
            onChange={(e) => {
              const n = Math.max(200, Math.min(2400, Number(e.target.value) || 200));
              // Shrinking the page pulls anything outside it back in, so a
              // layer cannot be stranded off-canvas with no way to select it.
              change({
                ...d,
                [k]: n,
                layers: d.layers.map((l) => ({
                  ...l,
                  x: k === 'width' ? Math.min(n, l.x) : l.x,
                  y: k === 'height' ? Math.min(n, l.y) : l.y,
                })),
              });
            }}
            style={input}
          />
        </label>
      ))}

      {d.layers.length > 0 && (
        <>
          <SectionLabel aside={`${d.layers.length}`} style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>
            Layers
          </SectionLabel>
          {d.layers.map((layer, i) => (
            <button
              key={layer.id}
              type="button"
              className="bare tappable"
              aria-pressed={layer.id === selected}
              onClick={() => setSelected(layer.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                paddingBlock: 'var(--sp-3)',
                borderBottom: '1px solid var(--app-line)',
                fontSize: 'var(--type-base)',
                color: layer.id === selected ? 'var(--app-accent)' : 'var(--app-fg)',
              }}
            >
              {i + 1}. {layer.text || layer.kind}
            </button>
          ))}
        </>
      )}

      {l && (
        <>
          <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>Selected {l.kind}</SectionLabel>
          {l.kind === 'text' && (
            <label style={field}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Text</span>
              <textarea
                rows={3}
                maxLength={2000}
                value={l.text}
                onChange={(e) => patch({ text: e.target.value })}
                style={input}
              />
            </label>
          )}
          {(['x', 'y', 'w', 'h', 'fontSize'] as const)
            .filter((k) => l.kind === 'text' || k !== 'fontSize')
            .map((k) => {
              const min = k === 'x' || k === 'y' ? 0 : k === 'fontSize' ? 8 : 1;
              const max = k === 'fontSize' ? 200 : k === 'x' ? d.width : k === 'y' ? d.height : 2400;
              return (
                <label key={k} style={field}>
                  <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>{k}</span>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={Math.round(l[k])}
                    onChange={(e) => patch({ [k]: Math.max(min, Math.min(max, Number(e.target.value) || 0)) })}
                    style={input}
                  />
                </label>
              );
            })}
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Colour</span>
            <input type="color" value={l.fill} onChange={(e) => patch({ fill: e.target.value })} style={input} />
          </label>
          {l.kind === 'text' && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-4)',
                marginBottom: 'var(--sp-5)',
                fontSize: 'var(--type-base)',
              }}
            >
              <input type="checkbox" checked={l.bold} onChange={(e) => patch({ bold: e.target.checked })} />
              <span>Bold</span>
            </label>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            <ActionButton onClick={() => patch({ x: Math.max(0, (d.width - l.w) / 2) })} style={{ flex: '1 1 auto' }}>
              Centre
            </ActionButton>
            <ActionButton
              onClick={() => change({ ...d, layers: [...d.layers.filter((x) => x.id !== l.id), l] })}
              style={{ flex: '1 1 auto' }}
            >
              To front
            </ActionButton>
            <ActionButton
              onClick={() => change({ ...d, layers: [l, ...d.layers.filter((x) => x.id !== l.id)] })}
              style={{ flex: '1 1 auto' }}
            >
              To back
            </ActionButton>
            <ActionButton
              onClick={() => {
                change({ ...d, layers: d.layers.filter((x) => x.id !== l.id) });
                setSelected('');
              }}
              style={{ flex: '1 1 auto' }}
            >
              Remove
            </ActionButton>
          </div>
        </>
      )}

      <p style={{ ...line, marginBlock: 'var(--sp-5)', textWrap: 'pretty' }}>
        Pictures stay in Files — this project stores a reference, so an export of it is small and needs the
        originals on whatever device opens it.
      </p>
    </>
  );
}
