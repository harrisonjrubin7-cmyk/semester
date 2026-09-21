import { finite, isoDay, obj, textValue } from './device-library';

/**
 * Three makers that had nowhere else to live: a form, a design, a video.
 *
 * The app already writes documents, decks and spreadsheets, and those have
 * their own libraries. These three do not fit any of them — a form collects
 * answers from other people, a design is a canvas, a video is a timeline —
 * so they share one project shape and one device library.
 *
 * One `CreativeProject` carries all three sub-shapes rather than a union,
 * which is the unusual decision here and a deliberate one: `kind` picks the
 * editor, and the other two stay empty. It means a project can be changed
 * from a form to a design without losing what was in it, it means the reader
 * validates one shape rather than three, and it means a `kind` this build
 * does not recognise is a bad project rather than an unreadable file.
 *
 * ## What is not in here
 *
 * Pixels and video frames. A design layer holds a `fileId` and a video clip
 * holds a `fileId`, both pointing into `lib/files.ts` — the library that
 * already stores what a student uploads. A JSON export therefore carries the
 * *project* and not the media, which is why importing one says the originals
 * are still needed. Base64 images inside a 3 MB JSON file would be a worse
 * version of a file store this app already has.
 */

export const QUESTION_TYPES = [
  'Short answer',
  'Paragraph',
  'Multiple choice',
  'Checkboxes',
  'Dropdown',
  'Rating',
  'Number',
  'Date',
  'Time',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface Question {
  id: string;
  title: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  /** The right answer, when this is a quiz. Empty means it is not marked. */
  answer: string;
  points: number;
  /** Shown only when an earlier question was answered a particular way. */
  condition: { questionId: string; equals: string } | null;
}

export interface FormResponse {
  id: string;
  at: string;
  answers: Record<string, string>;
  score: number;
  possible: number;
}

export interface FormData {
  description: string;
  questions: Question[];
  responses: FormResponse[];
  accepting: boolean;
  opens: string;
  closes: string;
  limit: number;
  quiz: boolean;
  /** The spreadsheet the responses were last sent to, if any. */
  sheetId: string | null;
  /**
   * The id this form is published under, if it is.
   *
   * Null is the ordinary state and the one every screen must draw. When it is
   * set, the id is both the row in `public.forms` and the whole of the
   * credential in the link — see `lib/formshare.ts`.
   */
  published: string | null;
}

export interface DesignLayer {
  id: string;
  kind: 'text' | 'rectangle' | 'ellipse' | 'triangle' | 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fill: string;
  fontSize: number;
  bold: boolean;
  /**
   * How solid this layer is, 0.1 to 1.
   *
   * The floor is not 0 on purpose. A layer at zero is invisible *and* still
   * selectable, which reads as a layer that has been deleted and will not go
   * away — and the only route back is a panel you reach by selecting the thing
   * you cannot see. A tenth is faint enough to be a wash and visible enough to
   * find.
   */
  opacity: number;
  /** Into `lib/files.ts`. The picture itself is never in here. */
  fileId: string;
}

export interface DesignData {
  width: number;
  height: number;
  background: string;
  layers: DesignLayer[];
}

export interface VideoClip {
  id: string;
  fileId: string;
  name: string;
  duration: number;
  start: number;
  end: number;
  speed: number;
  volume: number;
  caption: string;
}

export interface VideoData {
  clips: VideoClip[];
}

export interface CreativeProject {
  id: string;
  title: string;
  kind: 'form' | 'design' | 'video';
  courseId: string;
  itemId: string;
  updated: number;
  archived: boolean;
  form: FormData;
  design: DesignData;
  video: VideoData;
}

export interface CreationLibrary {
  version: 1;
  projects: CreativeProject[];
}

export const EMPTY_CREATIONS: CreationLibrary = { version: 1, projects: [] };

export const CREATION_LIMIT = 40;
export const PROJECT_KINDS = ['form', 'design', 'video'] as const;
export const LAYER_KINDS = ['text', 'rectangle', 'ellipse', 'triangle', 'image'] as const;

/** A six-digit hex colour, which is the only form anything here writes. */
const color = (x: unknown) => typeof x === 'string' && /^#[\da-f]{6}$/i.test(x);

/**
 * A creation library out of storage or a file, or an error.
 *
 * Long, and every clause earns its place — this reads a file a person chose,
 * and the shapes below feed a canvas renderer and a video timeline where a
 * bad number is a hang rather than a wrong pixel. Two are worth pointing at:
 *
 * **A condition may only name an earlier question.** `qids` is built as the
 * loop goes, so a question can only depend on one already seen. A form where
 * two questions each hide the other is not a form, and `visibleQuestions`
 * would have to detect the cycle at render time instead.
 *
 * **A clip's range must be inside its own duration, and non-empty.**
 * `end > start` strictly, and both inside `duration`, so `videoSeconds`
 * cannot produce a negative and `splitClip` always has somewhere to split.
 */
export function readCreations(value: unknown): CreationLibrary {
  if (!obj(value) || value.version !== 1 || !Array.isArray(value.projects) || value.projects.length > CREATION_LIMIT) {
    throw new Error(`Use a version 1 project library with up to ${CREATION_LIMIT} projects.`);
  }

  const ids = new Set<string>();
  for (const p of value.projects) {
    const shaped =
      obj(p) &&
      textValue(p.id, 100) &&
      !ids.has(p.id) &&
      textValue(p.title, 160) &&
      PROJECT_KINDS.includes(p.kind as CreativeProject['kind']) &&
      textValue(p.courseId, 100) &&
      textValue(p.itemId, 200) &&
      finite(p.updated, 0, 1e15) &&
      typeof p.archived === 'boolean';
    if (!shaped) throw new Error('Invalid project.');
    ids.add(p.id as string);

    const { form: f, design: d, video: v } = p as unknown as CreativeProject;

    /* ── The form ── */
    const formOk =
      obj(f) &&
      textValue(f.description, 4000) &&
      Array.isArray(f.questions) &&
      f.questions.length <= 20 &&
      Array.isArray(f.responses) &&
      f.responses.length <= 150 &&
      typeof f.accepting === 'boolean' &&
      typeof f.quiz === 'boolean' &&
      isoDay(f.opens) &&
      isoDay(f.closes) &&
      finite(f.limit, 1, 150) &&
      (f.sheetId === null || textValue(f.sheetId, 100)) &&
      // `undefined` is every project saved before publishing existed. Read as
      // null rather than refused: a field added to a stored shape has to have
      // an answer for the copies already on people's devices, and "this form
      // is not published" is the true one.
      (f.published === null || f.published === undefined || textValue(f.published, 100));
    if (!formOk) throw new Error('Invalid form.');
    f.published ??= null;

    const qids = new Set<string>();
    for (const q of f.questions) {
      const ok =
        obj(q) &&
        textValue(q.id, 100) &&
        !qids.has(q.id) &&
        textValue(q.title, 300) &&
        QUESTION_TYPES.includes(q.type as QuestionType) &&
        typeof q.required === 'boolean' &&
        Array.isArray(q.options) &&
        q.options.length <= 20 &&
        !q.options.some((o: unknown) => !textValue(o, 200)) &&
        textValue(q.answer, 1000) &&
        finite(q.points, 0, 100) &&
        // Only backwards, so conditions cannot form a cycle. See above.
        (q.condition === null ||
          (obj(q.condition) && qids.has(String(q.condition.questionId)) && textValue(q.condition.equals, 200)));
      if (!ok) throw new Error('Invalid question, or a condition on a later question.');
      qids.add(q.id);
    }

    const seen = new Set<string>();
    for (const r of f.responses) {
      const ok =
        obj(r) &&
        textValue(r.id, 100) &&
        !seen.has(r.id) &&
        textValue(r.at, 50) &&
        Number.isFinite(Date.parse(r.at)) &&
        obj(r.answers) &&
        !Object.entries(r.answers).some(([id, a]) => !qids.has(id) || !textValue(a, 5000)) &&
        finite(r.score, 0, 2000) &&
        finite(r.possible, 0, 2000);
      if (!ok) throw new Error('Invalid response.');
      seen.add(r.id);
    }

    /* ── The design ── */
    const designOk =
      obj(d) &&
      finite(d.width, 200, 2400) &&
      finite(d.height, 200, 2400) &&
      color(d.background) &&
      Array.isArray(d.layers) &&
      d.layers.length <= 60;
    if (!designOk) throw new Error('Invalid design.');

    const layerIds = new Set<string>();
    for (const l of d.layers) {
      /*
       * Every design saved before layers had an opacity has no such field,
       * and there is no version bump to hang a migration off — the library is
       * version 1 and the projects in it are the ones a student already made.
       * So the default is filled in here, on the way past, and the range check
       * below sees a number either way. Refusing those projects instead would
       * be this build calling every design made before it unreadable.
       */
      if (obj(l) && l.opacity === undefined) l.opacity = 1;

      const ok =
        obj(l) &&
        textValue(l.id, 100) &&
        !layerIds.has(l.id) &&
        LAYER_KINDS.includes(l.kind as DesignLayer['kind']) &&
        finite(l.x, 0, d.width) &&
        finite(l.y, 0, d.height) &&
        finite(l.w, 1, 2400) &&
        finite(l.h, 1, 2400) &&
        textValue(l.text, 2000) &&
        color(l.fill) &&
        finite(l.fontSize, 8, 200) &&
        typeof l.bold === 'boolean' &&
        finite(l.opacity, LAYER_OPACITY.min, LAYER_OPACITY.max) &&
        textValue(l.fileId, 100);
      if (!ok) throw new Error('Invalid design layer.');
      layerIds.add(l.id);
    }

    /* ── The video ── */
    if (!obj(v) || !Array.isArray(v.clips) || v.clips.length > 30) throw new Error('Invalid video.');
    const clipIds = new Set<string>();
    for (const c of v.clips) {
      const ok =
        obj(c) &&
        textValue(c.id, 100) &&
        !clipIds.has(c.id) &&
        textValue(c.fileId, 100) &&
        textValue(c.name, 300) &&
        finite(c.duration, 0.01, 21_600) &&
        finite(c.start, 0, c.duration) &&
        // Strictly after the start, and inside the source. See above.
        finite(c.end, c.start + 0.01, c.duration) &&
        finite(c.speed, 0.25, 4) &&
        finite(c.volume, 0, 1) &&
        textValue(c.caption, 500);
      if (!ok) throw new Error('Invalid clip range.');
      clipIds.add(c.id);
    }
  }

  return value as unknown as CreationLibrary;
}

export function newCreation(kind: CreativeProject['kind'], courseId = '', itemId = ''): CreativeProject {
  return {
    id: crypto.randomUUID(),
    title: `Untitled ${kind}`,
    kind,
    courseId,
    itemId,
    updated: Date.now(),
    archived: false,
    form: {
      description: '',
      questions: [],
      responses: [],
      accepting: true,
      opens: '',
      closes: '',
      limit: 100,
      quiz: false,
      sheetId: null,
      published: null,
    },
    design: { width: 900, height: 1200, background: '#ffffff', layers: [] },
    video: { clips: [] },
  };
}

/**
 * A layer as it arrives on the canvas.
 *
 * Here rather than in the editor because every number in it is *artwork*, in
 * canvas units, not a style: `fontSize` is the size of a headline inside a
 * poster the student is designing, and it happens to share a name with a CSS
 * property the app's own type scale governs. Keeping it in the data module is
 * what stops the two being confused — by a reader, and by the style budget in
 * `styles/rules.ts`, which is right to police the second and has no business
 * policing the first.
 */
export function newLayer(kind: DesignLayer['kind'], canvas: DesignData, fileId = ''): DesignLayer {
  return {
    id: crypto.randomUUID(),
    kind,
    x: 60,
    y: 80,
    w: Math.min(400, canvas.width - 60),
    h: 180,
    text: kind === 'text' ? 'Your headline' : '',
    fill: '#1a73e8',
    fontSize: 48,
    bold: true,
    opacity: 1,
    fileId,
  };
}

/**
 * The range a layer's opacity may hold, and a clamp onto it.
 *
 * Here rather than in the editor for the reason `newLayer`'s numbers are here:
 * a tenth is a property of the *artwork* — how faint a wash on a poster may be
 * before it stops being findable — and not an alpha somebody picked by eye to
 * dim a caption with. The style budget in `styles/rules.ts` counts the second
 * and is right to; it reads an `opacity:` with a decimal after it and cannot
 * tell the two apart, which is exactly what keeping this out of a component
 * settles.
 *
 * Single-sourced because the alternative is three copies — the clamp, the
 * slider's own bounds, and the range `readCreations` enforces — drifting until
 * the editor can produce a design the reader then refuses.
 */
export const LAYER_OPACITY = { min: 0.1, max: 1 } as const;

/** A number onto that range. Anything unreadable lands at full strength. */
export const clampOpacity = (n: number): number =>
  Number.isFinite(n) ? Math.max(LAYER_OPACITY.min, Math.min(LAYER_OPACITY.max, n)) : LAYER_OPACITY.max;

export function newQuestion(): Question {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled question',
    type: 'Short answer',
    required: false,
    options: ['Option 1', 'Option 2'],
    answer: '',
    points: 1,
    condition: null,
  };
}

/**
 * The questions somebody should be looking at, given what they have answered.
 *
 * A question with a condition appears only when the question it depends on is
 * *itself* visible and was answered the stated way. The second half is what
 * makes chains behave: hiding a question hides everything hanging off it,
 * rather than letting a grandchild reappear because its parent's stale answer
 * is still in the map.
 */
export function visibleQuestions(form: FormData, answers: Record<string, string>): Question[] {
  const visible = new Set<string>();
  return form.questions.filter((q) => {
    const show =
      !q.condition || (visible.has(q.condition.questionId) && answers[q.condition.questionId] === q.condition.equals);
    if (show) visible.add(q.id);
    return show;
  });
}

/**
 * One submitted response, validated and marked — or an error saying why not.
 *
 * The window is checked first and by *local calendar day*, so a form that
 * closes on the 4th is open all of somebody's 4th wherever they are.
 *
 * Only visible questions are validated and stored: a required question hidden
 * by a condition is not required, which is the only reading that makes
 * conditions usable at all.
 *
 * Marking is opt-in twice over — the form must be a quiz and the question
 * must have an answer recorded — so `possible` counts only what was actually
 * marked, and a quiz with one marked question out of six does not report the
 * other five as wrong.
 */
export function checkedAnswers(
  form: FormData,
  answers: Record<string, string>,
  now = new Date(),
): Record<string, string> {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const shut =
    !form.accepting ||
    (form.opens && today < form.opens) ||
    (form.closes && today > form.closes) ||
    form.responses.length >= form.limit;
  if (shut) throw new Error('This form is not accepting responses.');
  if (!form.questions.length) throw new Error('Add a question first.');

  const clean: Record<string, string> = {};

  for (const q of visibleQuestions(form, answers)) {
    const a = (answers[q.id] || '').trim();
    if (a.length > 5000) throw new Error('A response is too long.');
    if (q.required && !a) throw new Error(`Answer “${q.title}” before continuing.`);

    if (a) {
      if (['Multiple choice', 'Dropdown'].includes(q.type) && !q.options.includes(a)) {
        throw new Error('Choose a listed option.');
      }
      if (q.type === 'Checkboxes' && a.split('\n').some((v) => !q.options.includes(v))) {
        throw new Error('Choose listed options.');
      }
      if (q.type === 'Number' && !Number.isFinite(Number(a))) throw new Error('Enter a valid number.');
      if (q.type === 'Rating' && !['1', '2', '3', '4', '5'].includes(a)) {
        throw new Error('Choose a rating from 1 to 5.');
      }
      if (q.type === 'Date' && !isoDay(a)) throw new Error('Choose a valid date.');
      if (q.type === 'Time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(a)) throw new Error('Choose a valid time.');
    }
    clean[q.id] = a;
  }

  return clean;
}

/**
 * The mark, from answers that have already been checked.
 *
 * Separate from the checking above because the two halves run in different
 * places once a form is published: a respondent's browser validates what they
 * typed, and it must not be holding the answer key while it does. See
 * `lib/formshare.ts` — the key stays with the author, and a response is
 * marked when the author reads it.
 *
 * Marking is opt-in twice over — the form must be a quiz and the question
 * must have an answer recorded — so `possible` counts only what was actually
 * marked, and a quiz with one marked question out of six does not report the
 * other five as wrong.
 */
export function markAnswers(
  form: FormData,
  clean: Record<string, string>,
): { score: number; possible: number } {
  let score = 0;
  let possible = 0;

  for (const q of visibleQuestions(form, clean)) {
    if (!form.quiz || !q.answer.trim()) continue;
    possible += q.points;
    // Checkboxes are a set, so order must not decide the mark.
    const norm = (s: string) =>
      q.type === 'Checkboxes'
        ? s
            .split('\n')
            .map((x) => x.trim())
            .sort()
            .join('\n')
        : s.trim().toLowerCase();
    if (norm(clean[q.id] || '') === norm(q.answer)) score += q.points;
  }

  return { score, possible };
}

export function formResponse(
  form: FormData,
  answers: Record<string, string>,
  now = new Date(),
): FormResponse {
  const clean = checkedAnswers(form, answers, now);
  const { score, possible } = markAnswers(form, clean);
  return { id: crypto.randomUUID(), at: now.toISOString(), answers: clean, score, possible };
}

/**
 * Response text, made safe to put in a spreadsheet cell.
 *
 * A cell beginning `=`, `+`, `@` or `-` is a formula in every spreadsheet
 * there is, including the one in this app and the one somebody opens the
 * exported CSV in. A form collects text from *other people*, so a respondent
 * who types `=IMPORTXML(...)` into a short-answer box would otherwise have
 * written a formula into the form owner's sheet. The leading apostrophe is
 * the standard escape and keeps the text readable.
 *
 * Every path out of a form's responses goes through this. It is one line and
 * it is the reason the sheet export is safe.
 */
export const sheetText = (s: string) => (/^[=+@-]/.test(s.trim()) ? `'${s}` : s);

/** The responses as a grid — headers, then one row each. Escaped via `sheetText`. */
export function responseRows(p: CreativeProject): string[][] {
  return [
    ['Submitted at', ...p.form.questions.map((q) => q.title), 'Score', 'Possible'],
    ...p.form.responses.map((r) => [
      r.at,
      ...p.form.questions.map((q) => sheetText(r.answers[q.id] || '')),
      String(r.score),
      String(r.possible),
    ]),
  ];
}

/** How long the finished video runs, with each clip's trim and speed applied. */
export function videoSeconds(clips: VideoClip[]): number {
  return clips.reduce((n, c) => n + (c.end - c.start) / c.speed, 0);
}

/** One clip into two at a point inside its trim, or an error. */
export function splitClip(clip: VideoClip, at: number): VideoClip[] {
  if (at <= clip.start + 0.01 || at >= clip.end - 0.01) {
    throw new Error('Choose a split point inside the trimmed clip.');
  }
  return [
    { ...clip, end: at },
    { ...clip, id: crypto.randomUUID(), start: at },
  ];
}

/** The five characters that have to be entities inside an SVG. */
export const xml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

/**
 * The three corners of a triangle layer, as an SVG `points` list.
 *
 * Shared by the export and the editor's own canvas rather than written twice.
 * A triangle occupies the same `x`/`y`/`w`/`h` box every other layer does —
 * apex centred on the top edge, base along the bottom — so dragging, nudging,
 * the selection outline and the alignment buttons all work on it without
 * knowing it is not a rectangle.
 */
export const trianglePoints = (l: Pick<DesignLayer, 'x' | 'y' | 'w' | 'h'>): string =>
  `${l.x + l.w / 2},${l.y} ${l.x + l.w},${l.y + l.h} ${l.x},${l.y + l.h}`;

/**
 * A design as an SVG document.
 *
 * Every piece of text goes through `xml`, because a layer's text is typed by
 * a person and an unescaped `<` would end the element it is inside.
 *
 * Images are the careful part. `images` maps a `fileId` to a data URI the
 * caller read out of the file store, and the pattern test is a whitelist
 * rather than a sanity check: an `href` that is not a base64 PNG, JPEG or
 * WebP — a `javascript:` URI, an SVG carrying its own script — is dropped
 * entirely rather than rendered. A missing image is a gap in a poster; a
 * rendered one could be anything.
 */
export function designSvg(d: DesignData, images: Record<string, string> = {}): string {
  const layer = (l: DesignLayer): string => {
    /*
     * Omitted entirely at 1 rather than written as `opacity="1"`.
     *
     * An SVG export is a file somebody opens in something else, and every
     * design in the library is about to carry this attribute on every layer.
     * The default costs nothing to leave out and the export stays the document
     * it was before layers could be faded.
     */
    const fade = l.opacity < 1 ? ` opacity="${l.opacity}"` : '';

    if (l.kind === 'text') {
      const lines = l.text
        .split('\n')
        .map((t, i) => `<tspan x="${l.x}" dy="${i ? l.fontSize * 1.25 : 0}">${xml(t)}</tspan>`)
        .join('');
      return `<text x="${l.x}" y="${l.y + l.fontSize}" fill="${l.fill}" font-family="Arial,sans-serif" font-size="${l.fontSize}" font-weight="${l.bold ? '700' : '400'}"${fade}>${lines}</text>`;
    }
    if (l.kind === 'ellipse') {
      return `<ellipse cx="${l.x + l.w / 2}" cy="${l.y + l.h / 2}" rx="${l.w / 2}" ry="${l.h / 2}" fill="${l.fill}"${fade}/>`;
    }
    if (l.kind === 'triangle') {
      // Apex centred on the top edge, base on the bottom one — the same three
      // points `trianglePoints` gives the editor, so the export and the screen
      // cannot drift apart.
      return `<polygon points="${trianglePoints(l)}" fill="${l.fill}"${fade}/>`;
    }
    if (l.kind === 'image') {
      const src = images[l.fileId] || '';
      // Whitelist, not a sanity check. See above.
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(src)) return '';
      return `<image x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" href="${xml(src)}"${fade}/>`;
    }
    return `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="${l.fill}"${fade}/>`;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${d.width}" height="${d.height}" viewBox="0 0 ${d.width} ${d.height}"><rect width="100%" height="100%" fill="${d.background}"/>${d.layers.map(layer).join('')}</svg>`;
}
