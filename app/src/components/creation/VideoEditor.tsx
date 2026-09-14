import { useEffect, useRef, useState } from 'react';
import { ActionButton, FilePick, Notice, SectionLabel } from '../ui';
import { secondLine } from '../../lib/dim';
import { addFile, getFile } from '../../lib/files';
import { download } from '../../lib/deliver';
import { splitClip, videoSeconds, type CreativeProject, type VideoClip } from '../../lib/creations';

/**
 * Trim, arrange and caption clips, and record the result.
 *
 * The editing is ordinary: a list of clips, each with a trim, a speed, a
 * volume and a caption. `lib/creations.ts` holds the arithmetic and the
 * bounds. What is worth reading here is the export.
 *
 * ## The export plays the video in real time, and has to
 *
 * A browser has no frame-accurate video encoder. What it has is
 * `MediaRecorder` over a canvas stream — so exporting means playing each clip
 * at its own speed, drawing every frame onto a 1280×720 canvas, mixing its
 * audio into one destination, and recording the lot. A four-minute sequence
 * takes four minutes, the screen has to stay open, and the message says so
 * rather than leaving somebody watching a spinner.
 *
 * It is also the reason for the care below. A real-time pipeline holds an
 * `AudioContext`, a `MediaRecorder`, a capture stream, a `<video>` element
 * and an object URL, and every one of them survives a thrown error unless
 * something releases it. So the whole thing sits in a `try`/`finally` that
 * stops the tracks, closes the context and revokes the URL on every path,
 * including cancellation.
 *
 * ## It can be cancelled, and cancelling is a real path
 *
 * `cancel` is a ref rather than state because the draw loop and the waiters
 * read it between renders. Every wait and every frame checks it, and the
 * unmount effect sets it — closing the screen mid-export must not leave a
 * recorder running against a canvas nothing is drawing to.
 *
 * ## What is not verified
 *
 * The source package's own verification notes record that end-to-end browser
 * video rendering was never confirmed. Nothing in this port changes that: the
 * arithmetic is tested, the pipeline is not, and it degrades to a stated
 * message where the browser lacks the pieces.
 */

const MAX_CLIPS = 30;
const MAX_BYTES = 300_000_000;
const MAX_SECONDS = 21_600;
const UNDO = 20;
const WAIT_MS = 15_000;

/** A clip's duration, or an error. Times out rather than hanging on a bad file. */
function metadata(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    const timeout = window.setTimeout(() => {
      end();
      reject(new Error('Reading that video timed out. Try a smaller or more common format.'));
    }, WAIT_MS);
    const end = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      v.removeAttribute('src');
      v.load();
    };
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const n = v.duration;
      end();
      if (Number.isFinite(n) && n > 0) resolve(n);
      else reject(new Error('That video has no readable duration.'));
    };
    v.onerror = () => {
      end();
      reject(new Error('This browser cannot read that video format.'));
    };
    v.src = url;
  });
}

/**
 * Wait for one video event, with a timeout and a cancel check.
 *
 * The polling interval is what makes cancellation work: a `seeked` that never
 * arrives would otherwise hold the export open until the tab closed.
 */
function waitVideo(
  video: HTMLVideoElement,
  event: string,
  canceled: () => boolean,
  start?: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const since = Date.now();
    const clean = () => {
      clearInterval(timer);
      video.removeEventListener(event, ok);
      video.removeEventListener('error', fail);
    };
    const ok = () => {
      clean();
      resolve();
    };
    const fail = () => {
      clean();
      reject(new Error('That video could not load or seek. Try a more common format.'));
    };
    const timer = window.setInterval(() => {
      if (canceled() || Date.now() - since > WAIT_MS) {
        clean();
        reject(new Error(canceled() ? 'Export cancelled. Your clips are unchanged.' : 'Video loading timed out.'));
      }
    }, 200);
    video.addEventListener(event, ok, { once: true });
    video.addEventListener('error', fail, { once: true });
    start?.();
  });
}

export function VideoEditor({
  project,
  onChange,
}: {
  project: CreativeProject;
  onChange: (p: Partial<CreativeProject>) => boolean;
}) {
  const clips = project.video.clips;
  const [selected, setSelected] = useState(clips[0]?.id || '');
  const [url, setUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [past, setPast] = useState<VideoClip[][]>([]);
  const [time, setTime] = useState(0);
  const [playingAll, setPlayingAll] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  const cancel = useRef(false);

  const clip = clips.find((c) => c.id === selected) || clips[0];

  /* The selected clip's own file, as an object URL, revoked on the way out. */
  useEffect(() => {
    let alive = true;
    let objectUrl = '';
    if (clip) {
      void getFile(clip.fileId)
        .then((f) => {
          if (!f) throw new Error('That clip’s original file is missing from Files.');
          objectUrl = URL.createObjectURL(f.blob);
          if (alive) setUrl(objectUrl);
          else URL.revokeObjectURL(objectUrl);
        })
        .catch((e) => setNotice((e as Error).message));
    } else {
      setUrl('');
    }
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip?.fileId]);

  /* Leaving mid-export must stop it. See the note at the top. */
  useEffect(
    () => () => {
      cancel.current = true;
    },
    [],
  );

  useEffect(() => {
    if (player.current && clip) {
      player.current.playbackRate = clip.speed;
      player.current.volume = clip.volume;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip?.speed, clip?.volume]);

  const change = (next: VideoClip[]) => {
    if (!onChange({ video: { clips: next } })) {
      setNotice('That could not be saved. Your original files are still in Files.');
      return;
    }
    setPast((p) => [...p.slice(-(UNDO - 1)), clips]);
  };

  const patch = (p: Partial<VideoClip>) => {
    if (clip) change(clips.map((c) => (c.id === clip.id ? { ...c, ...p } : c)));
  };

  const loaded = () => {
    const v = player.current;
    if (!v || !clip) return;
    v.currentTime = clip.start;
    v.playbackRate = clip.speed;
    v.volume = clip.volume;
    if (playingAll) void v.play().catch(() => setPlayingAll(false));
  };

  const exportVideo = async () => {
    if (!clips.length) return;

    /* Every capability named, so the message can say which one is missing. */
    if (!('MediaRecorder' in window) || !('AudioContext' in window) || !HTMLCanvasElement.prototype.captureStream) {
      setNotice('This browser cannot record a canvas. The project and the originals still export.');
      return;
    }
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    if (!mime) {
      setNotice('This browser cannot write WebM. Export the project and finish in another browser.');
      return;
    }

    let audio: AudioContext;
    try {
      audio = new AudioContext();
    } catch {
      setNotice('This browser could not start audio for the export. Your project is unchanged.');
      return;
    }

    setBusy(true);
    cancel.current = false;
    setPlayingAll(false);
    player.current?.pause();

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const context = canvas.getContext('2d')!;
    const stream = canvas.captureStream(30);
    const mix = audio.createMediaStreamDestination();
    mix.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const finished = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      recorder.onerror = () => reject(new Error('The browser could not finish recording.'));
    });
    // Attached now so a rejection later is never unhandled.
    void finished.catch(() => {});

    let started = false;
    let active: HTMLVideoElement | null = null;
    let objectUrl = '';

    try {
      await audio.resume();
      recorder.start(500);
      started = true;

      for (const c of clips) {
        if (cancel.current) throw new Error('Export cancelled. Your clips are unchanged.');
        const file = await getFile(c.fileId);
        if (!file) throw new Error(`The original is missing: ${c.name}`);

        const video = document.createElement('video');
        active = video;
        video.playsInline = true;
        video.preload = 'auto';
        objectUrl = URL.createObjectURL(file.blob);
        video.src = objectUrl;
        await waitVideo(video, 'loadedmetadata', () => cancel.current);

        const source = audio.createMediaElementSource(video);
        const gain = audio.createGain();
        gain.gain.value = c.volume;
        source.connect(gain).connect(mix);
        video.playbackRate = c.speed;

        if (c.start > 0) {
          await waitVideo(video, 'seeked', () => cancel.current, () => {
            video.currentTime = c.start;
          });
        }

        setNotice(`Recording ${c.name} in real time — keep this screen open.`);
        await video.play();

        await new Promise<void>((resolve, reject) => {
          const draw = () => {
            if (cancel.current) {
              video.pause();
              reject(new Error('Export cancelled. Your clips are unchanged.'));
              return;
            }
            if (video.currentTime >= c.end || video.ended) {
              video.pause();
              resolve();
              return;
            }
            context.fillStyle = '#000000';
            context.fillRect(0, 0, 1280, 720);
            // Letterboxed rather than stretched — a 4:3 clip in a 16:9 frame
            // should have bars, not people a third wider than they are.
            const scale = Math.min(1280 / video.videoWidth, 720 / video.videoHeight);
            context.drawImage(
              video,
              (1280 - video.videoWidth * scale) / 2,
              (720 - video.videoHeight * scale) / 2,
              video.videoWidth * scale,
              video.videoHeight * scale,
            );
            if (c.caption) {
              context.fillStyle = 'rgba(0,0,0,.75)';
              context.fillRect(40, 600, 1200, 90);
              context.fillStyle = '#ffffff';
              context.font = '32px Arial';
              context.textAlign = 'center';
              context.fillText(c.caption, 640, 651, 1160);
            }
            requestAnimationFrame(draw);
          };
          draw();
        });

        source.disconnect();
        gain.disconnect();
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(objectUrl);
        objectUrl = '';
      }

      recorder.stop();
      const blob = await finished;
      await addFile(
        new File([blob], `${project.title}.webm`, { type: 'video/webm' }),
        project.courseId || null,
        null,
        '',
        project.itemId || null,
      );
      download({ name: `${project.title}.webm`, body: blob, mime: 'video/webm' });
      setNotice('Exported and saved in Files. Check the audio and captions before you hand it in.');
    } catch (e) {
      setNotice((e as Error).message);
      if (recorder.state !== 'inactive') recorder.stop();
      if (started) await finished.catch(() => {});
    } finally {
      active?.pause();
      if (active) {
        active.removeAttribute('src');
        active.load();
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      stream.getTracks().forEach((t) => t.stop());
      await audio.close();
      setBusy(false);
    }
  };

  const line = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
  const field = { display: 'block', marginBottom: 'var(--sp-5)' } as const;
  const input = { width: '100%', marginTop: 'var(--sp-2)' } as const;

  return (
    <>
      <FilePick
        accept="video/*"
        multiple
        disabled={busy || clips.length >= MAX_CLIPS}
        onPick={async (files) => {
          setBusy(true);
          try {
            const additions: VideoClip[] = [];
            for (const f of files.slice(0, MAX_CLIPS - clips.length)) {
              if (f.size > MAX_BYTES) throw new Error('Choose clips smaller than 300 MB.');
              const duration = await metadata(f);
              if (duration > MAX_SECONDS) throw new Error('Each clip has to be under six hours.');
              const saved = await addFile(f, project.courseId || null, null, '', project.itemId || null);
              additions.push({
                id: crypto.randomUUID(),
                fileId: saved.id,
                name: f.name,
                duration,
                start: 0,
                end: duration,
                speed: 1,
                volume: 1,
                caption: '',
              });
            }
            change([...clips, ...additions]);
            setSelected(additions[0]?.id || '');
            setNotice('Originals saved in Files. Trimming here never touches the footage itself.');
          } catch (e) {
            setNotice((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Import clips
      </FilePick>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBlock: 'var(--sp-5)' }}>
        <ActionButton
          disabled={!past.length || busy}
          onClick={() => {
            onChange({ video: { clips: past[past.length - 1] } });
            setPast((p) => p.slice(0, -1));
          }}
          style={{ flex: '1 1 auto' }}
        >
          Undo
        </ActionButton>
        <ActionButton
          disabled={!clips.length || busy}
          onClick={() => {
            setPlayingAll(true);
            setSelected(clips[0].id);
            if (clip?.id === clips[0].id) {
              loaded();
              void player.current?.play();
            }
          }}
          style={{ flex: '1 1 auto' }}
        >
          Play it through
        </ActionButton>
        <ActionButton
          tone="primary"
          disabled={!clips.length || busy}
          onClick={() => void exportVideo()}
          style={{ flex: '1 1 auto' }}
        >
          Export
        </ActionButton>
        {busy && (
          <ActionButton
            onClick={() => {
              cancel.current = true;
            }}
            style={{ flex: '1 1 auto' }}
          >
            Cancel
          </ActionButton>
        )}
      </div>

      <p style={{ ...line, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
        {clips.length} clips · {Math.round(videoSeconds(clips))} seconds · exports as 720p WebM, recorded in
        real time, so it takes as long as the video runs. A caption covers its whole clip. The footage stays
        on this device.
      </p>

      {notice && (
        <Notice>
          {notice}
        </Notice>
      )}

      {url && clip ? (
        <>
          <video
            ref={player}
            src={url}
            controls
            playsInline
            onLoadedMetadata={loaded}
            onTimeUpdate={() => {
              const v = player.current;
              if (!v) return;
              setTime(v.currentTime);
              if (v.currentTime >= clip.end) {
                v.pause();
                if (playingAll) {
                  const next = clips[clips.findIndex((c) => c.id === clip.id) + 1];
                  if (next) setSelected(next.id);
                  else setPlayingAll(false);
                }
              }
            }}
            style={{ width: '100%', borderRadius: 'var(--r-md)', background: '#000' }}
          />
          {clip.caption && <p style={{ ...line, marginBlock: 'var(--sp-3)' }}>{clip.caption}</p>}
        </>
      ) : (
        <p style={{ fontSize: 'var(--type-base)', ...secondLine(), lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
          Nothing here yet. Import some footage, trim it, put the clips in order and add captions.
        </p>
      )}

      {clip && (
        <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0, marginTop: 'var(--sp-6)' }}>
          <SectionLabel style={{ marginBlock: '0 var(--sp-4)' }}>{clip.name}</SectionLabel>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Start, seconds</span>
            <input
              type="number"
              step=".1"
              min={0}
              max={clip.end - 0.01}
              value={clip.start}
              onChange={(e) => patch({ start: Math.max(0, Math.min(clip.end - 0.01, Number(e.target.value) || 0)) })}
              style={input}
            />
          </label>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>End, seconds</span>
            <input
              type="number"
              step=".1"
              min={clip.start + 0.01}
              max={clip.duration}
              value={clip.end}
              onChange={(e) =>
                patch({ end: Math.max(clip.start + 0.01, Math.min(clip.duration, Number(e.target.value) || clip.duration)) })
              }
              style={input}
            />
          </label>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Speed</span>
            <select value={clip.speed} onChange={(e) => patch({ speed: Number(e.target.value) })} style={input}>
              {[0.25, 0.5, 1, 1.25, 1.5, 2, 4].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
          </label>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={clip.volume}
              onChange={(e) => patch({ volume: Number(e.target.value) })}
              style={input}
            />
          </label>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Caption</span>
            <textarea
              rows={2}
              maxLength={500}
              value={clip.caption}
              onChange={(e) => patch({ caption: e.target.value })}
              style={input}
            />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            <ActionButton
              disabled={clips.length >= MAX_CLIPS}
              onClick={() => {
                try {
                  change(clips.flatMap((c) => (c.id === clip.id ? splitClip(c, time) : [c])));
                } catch (e) {
                  setNotice((e as Error).message);
                }
              }}
              style={{ flex: '1 1 auto' }}
            >
              Split at {time.toFixed(1)}s
            </ActionButton>
            <ActionButton onClick={() => change(clips.filter((c) => c.id !== clip.id))} style={{ flex: '1 1 auto' }}>
              Remove
            </ActionButton>
          </div>
        </fieldset>
      )}

      {clips.length > 0 && (
        <>
          <SectionLabel aside={`${clips.length}`} style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}>
            In order
          </SectionLabel>
          {clips.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-4)',
                paddingBlock: 'var(--sp-3)',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <button
                type="button"
                className="bare tappable"
                aria-pressed={clip?.id === c.id}
                onClick={() => {
                  setPlayingAll(false);
                  setSelected(c.id);
                }}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  minWidth: 0,
                  fontSize: 'var(--type-base)',
                  color: clip?.id === c.id ? 'var(--app-accent)' : 'var(--app-fg)',
                }}
              >
                {i + 1}. {c.name}
                <span style={{ display: 'block', ...line }}>{((c.end - c.start) / c.speed).toFixed(1)}s</span>
              </button>
              <button
                type="button"
                className="bare tappable"
                disabled={i === 0 || busy}
                aria-label={`Move ${c.name} earlier`}
                onClick={() => {
                  const a = [...clips];
                  [a[i - 1], a[i]] = [a[i], a[i - 1]];
                  change(a);
                }}
                style={secondLine()}
              >
                ↑
              </button>
              <button
                type="button"
                className="bare tappable"
                disabled={i === clips.length - 1 || busy}
                aria-label={`Move ${c.name} later`}
                onClick={() => {
                  const a = [...clips];
                  [a[i], a[i + 1]] = [a[i + 1], a[i]];
                  change(a);
                }}
                style={secondLine()}
              >
                ↓
              </button>
            </div>
          ))}
        </>
      )}
    </>
  );
}
