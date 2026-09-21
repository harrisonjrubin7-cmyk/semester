import { useEffect, useRef, useState } from 'react';
import { ActionButton, FilePick, SectionLabel } from '../ui';
import { secondLine } from '../../lib/dim';
import { ItemRow } from '../shell/Rows';
import { addFile, getFile } from '../../lib/files';
import { TOLERANCE, clearedShare, edgeColour, keyOut } from '../../lib/cutout';
import { cloudConfigured } from '../../lib/cloud';
import { download } from '../../lib/deliver';
import {
  LAYER_OPACITY,
  clampOpacity,
  designSvg,
  gradientEnds,
  gradientId,
  layerTransform,
  newLayer,
  trianglePoints,
  type CreativeProject,
  type DesignData,
  type DesignLayer,
} from '../../lib/creations';
import { TEMPLATES, apply as applyTemplate } from '../../lib/designtemplates';
import { changes, describe as describeCanvas, foldAll, type Seen } from '../../lib/coedit';
import { share, type Sharing } from '../../lib/cocanvas';

/**
 * A canvas: text, shapes and pictures on a page, exported as an image.
 *
 * For the poster, the diagram and the one slide that has to look like
 * something. Small on purpose — five layer kinds, a colour and an opacity —
 * because the alternative is a worse version of a design tool the student
 * already has, and what is actually missing is somewhere to make a conference
 * poster at eleven at night without leaving the app their material is in.
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

/** What a layer paints with: its gradient if it has one, else its colour. */
const paintOf = (l: DesignLayer) =>
  l.gradient && l.kind !== 'image' ? `url(#${gradientId(l.id)})` : l.fill;

const MAX_LAYERS = 60;
const UNDO = 30;

/**
 * Page sizes by the name somebody would ask for them by.
 *
 * Every one is inside the 200–2,400 the reader allows on both sides, which is
 * why 1080 × 1920 is here and a 4K anything is not: a preset that produced a
 * design the app then refused to reopen would be the worst kind of shortcut.
 */
const PAGE_SIZES = [
  { name: 'Square post', width: 1080, height: 1080 },
  { name: 'Story', width: 1080, height: 1920 },
  { name: 'Poster', width: 1600, height: 1200 },
  { name: 'Slide', width: 1600, height: 900 },
  { name: 'Flyer', width: 900, height: 1200 },
  { name: 'Letter page', width: 1275, height: 1650 },
] as const;

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
  /*
   * The tolerance the background lift will use, kept on the editor rather than
   * on the layer. It is a setting for an *action*, not a property of the
   * artwork: once the lift has run, the layer is a picture with a hole in it
   * and the number that made the hole is history. Storing it on the layer
   * would put it in the file, the export and the shared canvas, all describing
   * something that already happened.
   */
  const [tolerance, setTolerance] = useState<number>(TOLERANCE.deft);
  const [lifting, setLifting] = useState(false);
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

  /**
   * Lift a flat background off the selected picture.
   *
   * Non-destructive, and that is the whole shape of it: the cut-out is written
   * to Files as a *new* PNG and the layer is pointed at it, so the original
   * upload is still there. A background lift that overwrote the only copy of
   * somebody's picture would be a one-way door with a slider on it, and the
   * tolerance that was right is found by trying one that was not.
   *
   * The result is refused rather than applied when it would take nearly
   * everything: at that point the key has matched the subject too, and the
   * honest outcome is a sentence about the tolerance rather than a layer that
   * has silently become a blank rectangle.
   */
  const liftBackground = async (layer: DesignLayer) => {
    setLifting(true);
    try {
      const stored = await getFile(layer.fileId);
      if (!stored) throw new Error('That picture is no longer in Files.');

      const bitmap = await createImageBitmap(stored.blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const key = edgeColour(frame.data, canvas.width, canvas.height);
      const cleared = keyOut(frame.data, key, tolerance);
      const took = clearedShare(cleared, canvas.width * canvas.height);

      if (took > 0.97) {
        setNotice('That would have taken nearly the whole picture — the background and the subject are too close in colour at this tolerance. Try a lower one.');
        return;
      }
      if (cleared === 0) {
        setNotice('Nothing matched the edges of that picture closely enough to lift. Try a higher tolerance.');
        return;
      }

      ctx.putImageData(frame, 0, 0);
      // PNG, always: the format is the point. A JPEG has no alpha, so the
      // hole this just made would come back as black on the way out.
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The cut-out could not be written.'))), 'image/png'),
      );
      const saved = await addFile(
        new File([blob], `${stored.name.replace(/\.[^.]+$/, '')} (background lifted).png`, { type: 'image/png' }),
        project.courseId || null,
        null,
        '',
        project.itemId || null,
      );

      change({ ...d, layers: d.layers.map((x) => (x.id === layer.id ? { ...x, fileId: saved.id } : x)) });
      setNotice(`Lifted ${Math.round(took * 100)}% of that picture. The original is still in Files — undo puts the layer back on it.`);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setLifting(false);
    }
  };

  const l = d.layers.find((x) => x.id === selected);
  const line = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
  const field = { display: 'block', marginBottom: 'var(--sp-5)' } as const;
  const input = { width: '100%', marginTop: 'var(--sp-2)' } as const;

  /**
   * A new page size, from the fields or from a preset.
   *
   * Shrinking the page pulls anything outside it back in, so a layer cannot
   * be stranded off-canvas with no way to select it. Both axes are clamped on
   * every call even when only one changed, which costs nothing — a coordinate
   * already inside the page is its own minimum.
   */
  const resize = (width: number, height: number) => {
    const w = Math.max(200, Math.min(2400, Math.round(width) || 200));
    const h = Math.max(200, Math.min(2400, Math.round(height) || 200));
    change({
      ...d,
      width: w,
      height: h,
      layers: d.layers.map((l) => ({ ...l, x: Math.min(w, l.x), y: Math.min(h, l.y) })),
    });
  };

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
            ones you do not want. Or start with a blank canvas and the four buttons below.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
        {(['text', 'rectangle', 'ellipse', 'triangle'] as const).map((k) => (
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
          {/*
            * The same `<defs>` the export writes, for the same reason: an SVG
            * cannot paint with a gradient it has not declared. Built from the
            * same two helpers, so the canvas and the file cannot disagree
            * about which way a gradient runs.
            */}
          <defs>
            {d.layers
              .filter((x) => x.gradient && x.kind !== 'image')
              .map((x) => {
                const ends = gradientEnds(x.gradient!.angle);
                return (
                  <linearGradient key={x.id} id={gradientId(x.id)} {...ends}>
                    <stop offset="0" stopColor={x.fill} />
                    <stop offset="1" stopColor={x.gradient!.to} />
                  </linearGradient>
                );
              })}
          </defs>
          <rect width={d.width} height={d.height} fill={d.background} />
          {d.layers.map((layer, i) => (
            <g
              key={layer.id}
              role="button"
              tabIndex={0}
              /*
               * The rotation goes on the `<g>`, and the opacity below goes on
               * the shape. The difference is the selection outline, which is
               * in here too: it has to *turn* with the layer to keep framing
               * it, and it has to not fade with it, or a layer taken down to a
               * tenth would be one you could no longer see you had selected.
               */
              transform={layerTransform(layer) || undefined}
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
              {/*
                * The opacity goes on the shape and never on the `<g>`.
                *
                * The group also holds the selection outline, so fading it
                * would fade the one thing that has to stay visible: a layer
                * taken down to a tenth would be a layer you could no longer
                * see you had selected, which is precisely when you need the
                * outline most.
                */}
              {layer.kind === 'text' ? (
                <text
                  x={layer.x}
                  y={layer.y + layer.fontSize}
                  fill={paintOf(layer)}
                  fontSize={layer.fontSize}
                  fontFamily="Arial,sans-serif"
                  fontWeight={layer.bold ? 700 : 400}
                  opacity={layer.opacity}
                >
                  {layer.text.split('\n').map((t, j) => (
                    <tspan key={j} x={layer.x} dy={j ? layer.fontSize * 1.25 : 0}>
                      {t}
                    </tspan>
                  ))}
                </text>
              ) : layer.kind === 'ellipse' ? (
                <ellipse cx={layer.x + layer.w / 2} cy={layer.y + layer.h / 2} rx={layer.w / 2} ry={layer.h / 2} fill={paintOf(layer)} opacity={layer.opacity} />
              ) : layer.kind === 'triangle' ? (
                // `trianglePoints` is the export's own, so what is on screen
                // and what lands in the SVG are the same three corners.
                <polygon points={trianglePoints(layer)} fill={paintOf(layer)} opacity={layer.opacity} />
              ) : layer.kind === 'image' ? (
                <image x={layer.x} y={layer.y} width={layer.w} height={layer.h} href={images[layer.fileId]} opacity={layer.opacity} />
              ) : (
                <rect x={layer.x} y={layer.y} width={layer.w} height={layer.h} fill={paintOf(layer)} opacity={layer.opacity} />
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
            onChange={(e) =>
              resize(
                k === 'width' ? Number(e.target.value) : d.width,
                k === 'height' ? Number(e.target.value) : d.height,
              )
            }
            style={input}
          />
        </label>
      ))}

      {/*
        * The sizes somebody actually asks for, by name.
        *
        * Nobody knows that a story is 1080 by 1920; they know it is a story.
        * These go through `resize` rather than setting the numbers directly,
        * so a preset clamps and pulls stranded layers back in exactly the way
        * typing the numbers does — the one path, not a second one that has to
        * be remembered when the first changes.
        */}
      <SectionLabel style={{ marginBlock: 'var(--sp-5) var(--sp-4)' }}>Common sizes</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
        {PAGE_SIZES.map((p) => (
          <ActionButton
            key={p.name}
            onClick={() => resize(p.width, p.height)}
            title={`${p.width} × ${p.height}`}
            style={{ flex: '1 1 auto' }}
          >
            {p.name}
          </ActionButton>
        ))}
      </div>

      {d.layers.length > 0 && (
        <>
          <SectionLabel aside={`${d.layers.length}`} style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>
            Layers
          </SectionLabel>
          {d.layers.map((layer, i) => (
            <ItemRow
              key={layer.id}
              ariaPressed={layer.id === selected}
              onClick={() => setSelected(layer.id)}
              // The accent stays on the title rather than on the row: it is
              // the layer's name that is selected, and `ItemRow` has no colour
              // of its own to override.
              title={
                <span style={{ color: layer.id === selected ? 'var(--app-accent)' : undefined }}>
                  {i + 1}. {layer.text || layer.kind}
                </span>
              }
            />
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
          {/*
            * A gradient is offered for everything that has a fill, which is
            * everything but a picture — an image layer paints with its pixels
            * and a second colour has nowhere to go on it.
            *
            * `fill` above stays the first stop rather than becoming a "from"
            * field of its own. So the switch adds a colour instead of
            * replacing one, and turning it off leaves the layer exactly the
            * flat colour it was before.
            */}
          {l.kind !== 'image' && (
            <>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-4)',
                  marginBottom: 'var(--sp-5)',
                  fontSize: 'var(--type-base)',
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(l.gradient)}
                  onChange={(e) =>
                    patch({ gradient: e.target.checked ? { to: '#ffffff', angle: 90 } : null })
                  }
                />
                <span>Fade to a second colour</span>
              </label>
              {l.gradient && (
                <>
                  <label style={field}>
                    <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Second colour</span>
                    <input
                      type="color"
                      value={l.gradient.to}
                      onChange={(e) => patch({ gradient: { to: e.target.value, angle: l.gradient!.angle } })}
                      style={input}
                    />
                  </label>
                  <label style={field}>
                    <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
                      Direction · {Math.round(l.gradient.angle)}°
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      step={5}
                      value={l.gradient.angle}
                      onChange={(e) =>
                        patch({
                          gradient: {
                            to: l.gradient!.to,
                            angle: Math.max(0, Math.min(360, Math.round(Number(e.target.value)) || 0)),
                          },
                        })
                      }
                      style={input}
                    />
                  </label>
                </>
              )}
            </>
          )}

          {/*
            * The number is said next to the slider because a slider on its own
            * cannot be read back. Somebody matching two layers to the same
            * wash needs to know they are both at 40%, and a thumb position is
            * not an answer to that.
            */}
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
              Opacity · {Math.round(l.opacity * 100)}%
            </span>
            <input
              type="range"
              min={LAYER_OPACITY.min}
              max={LAYER_OPACITY.max}
              step={0.05}
              value={l.opacity}
              onChange={(e) => patch({ opacity: clampOpacity(Number(e.target.value)) })}
              style={input}
            />
          </label>
          {/*
            * Only for a picture, and named for what it does.
            *
            * "Lift a flat background", not "Remove background": this keys out
            * a colour, it does not know what a person is. Calling it the
            * second thing would have somebody try it on a photo of themselves
            * against a room and conclude the feature is broken, when what it
            * is, is a different feature. See `lib/cutout.ts`.
            */}
          {l.kind === 'image' && (
            <>
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
                  How close a colour counts as the background · {tolerance}
                </span>
                <input
                  type="range"
                  min={TOLERANCE.min}
                  max={TOLERANCE.max}
                  step={1}
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value) || TOLERANCE.deft)}
                  style={input}
                />
              </label>
              <ActionButton
                disabled={lifting}
                onClick={() => void liftBackground(l)}
                style={{ marginBottom: 'var(--sp-5)' }}
              >
                {lifting ? 'Lifting…' : 'Lift a flat background'}
              </ActionButton>
              <p style={{ ...line, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
                Finds the colour around the edges of this picture and clears it. Made for a logo, a
                scanned figure or a plot on plain paper — not for a photograph of somebody against a
                room, which needs a tool that knows what a person is. The original picture stays in
                Files either way.
              </p>
            </>
          )}
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
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
              Rotation · {Math.round(l.rotation)}°
            </span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={l.rotation}
              onChange={(e) => patch({ rotation: Math.max(-180, Math.min(180, Math.round(Number(e.target.value)) || 0)) })}
              style={input}
            />
          </label>
          {l.rotation !== 0 && (
            <ActionButton onClick={() => patch({ rotation: 0 })} style={{ marginBottom: 'var(--sp-5)' }}>
              Straighten
            </ActionButton>
          )}

          {/*
            * Against the page, not against another layer.
            *
            * A layer's box is `x`/`y`/`w`/`h` for every kind, including text —
            * where the renderer draws from `x` with no line box, so `w` is the
            * width somebody set rather than the width the words came out. That
            * makes right and centre an approximation for text and exact for
            * everything else, which is the same approximation the one Centre
            * button here always made, now said out loud.
            *
            * And it is the box for a rotated layer too: a tilted layer aligned
            * right has its *box* against the right edge, so a corner of the
            * layer itself pokes past it. Aligning the turned shape's true
            * extent would need its bounding box after rotation, which is a
            * different and larger thing than the one every other control here
            * moves — so the box stays the box, and Straighten is next to the
            * slider for anybody who wanted the other answer.
            */}
          <SectionLabel style={{ marginBlock: 'var(--sp-5) var(--sp-4)' }}>Align on the page</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            {(
              [
                ['Left', { x: 0 }],
                ['Centre', { x: Math.max(0, (d.width - l.w) / 2) }],
                ['Right', { x: Math.max(0, d.width - l.w) }],
                ['Top', { y: 0 }],
                ['Middle', { y: Math.max(0, (d.height - l.h) / 2) }],
                ['Bottom', { y: Math.max(0, d.height - l.h) }],
              ] as const
            ).map(([name, to]) => (
              <ActionButton key={name} onClick={() => patch(to)} style={{ flex: '1 1 auto' }}>
                {name}
              </ActionButton>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            {/*
              * "Duplicate layer", not "Duplicate".
              *
              * The screen this panel sits on already has a Duplicate button,
              * and that one copies the whole project. Two buttons a thumb apart
              * reading the same word, doing things an order of magnitude
              * different in size, is a trap — found by opening the screen, not
              * by reading this file.
              */}
            <ActionButton
              onClick={() => {
                if (d.layers.length >= MAX_LAYERS) return setNotice(`A design holds ${MAX_LAYERS} layers.`);
                // Offset so the copy is visibly a second thing rather than
                // sitting exactly on top of the original, and clamped so it
                // cannot be nudged off the page by the offset itself.
                const copy = {
                  ...l,
                  id: crypto.randomUUID(),
                  x: Math.min(d.width, l.x + 20),
                  y: Math.min(d.height, l.y + 20),
                };
                const i = d.layers.findIndex((x) => x.id === l.id);
                change({ ...d, layers: [...d.layers.slice(0, i + 1), copy, ...d.layers.slice(i + 1)] });
                setSelected(copy.id);
              }}
              style={{ flex: '1 1 auto' }}
            >
              Duplicate layer
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
