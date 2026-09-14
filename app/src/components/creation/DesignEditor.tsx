import { useEffect, useRef, useState } from 'react';
import { ActionButton, FilePick, SectionLabel } from '../ui';
import { secondLine } from '../../lib/dim';
import { addFile, getFile } from '../../lib/files';
import { download } from '../../lib/deliver';
import { designSvg, newLayer, type CreativeProject, type DesignData, type DesignLayer } from '../../lib/creations';

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

  /** A change worth undoing. Drags record once, on the way in. */
  const change = (next: DesignData, record = true) => {
    if (record) {
      setPast((p) => [...p.slice(-(UNDO - 1)), d]);
      setFuture([]);
    }
    onChange({ design: next });
  };

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
