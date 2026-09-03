/**
 * Drawing the thing you cannot picture.
 *
 * A supply curve shifting, the branches of a federal system, a payoff matrix,
 * the causal chain in an argument — these are the parts of an ECON, PSCI or
 * BUS course that a paragraph explains badly and a picture explains in one
 * look. Claude cannot make an image; it can write the code for one, which for
 * this kind of diagram is better, because the result is text you can edit,
 * label differently and hand in.
 *
 * Two languages, chosen for what each is good at. **Mermaid** for anything
 * whose meaning is its structure — flows, hierarchies, timelines, states — and
 * it lays itself out, which is most of the work. **SVG** for anything with
 * axes or a shape that means something: a demand curve has to slope down and a
 * Mermaid box cannot.
 *
 * ## The dangerous part
 *
 * Rendering generated markup is how a study app becomes an XSS hole. An SVG is
 * a full document: it can carry <script>, event handlers on any element, and
 * <foreignObject> containing arbitrary HTML. So nothing generated is trusted.
 * `cleanSvg` strips those, and it strips them by walking a parsed document
 * rather than by matching patterns in a string — a regex-based sanitiser is
 * defeated by things as ordinary as a newline inside an attribute name, and
 * the browser's own parser is the only thing that agrees with the browser's
 * own renderer about what a document contains.
 */

export type Language = 'mermaid' | 'svg';

export interface Kind {
  id: string;
  label: string;
  /** What it is for, in the second person. */
  blurb: string;
  language: Language;
  /** Told to the model. */
  brief: string;
}

export const KINDS: Kind[] = [
  {
    id: 'curves',
    label: 'A graph with axes',
    blurb: 'Supply and demand, a budget line, a cost curve — anything where the slope means something.',
    language: 'svg',
    brief:
      'Draw a labelled graph with axes. Both axes named with what they measure, curves labelled ' +
      'where they sit, equilibrium or intersection points marked and their coordinates named if ' +
      'the student gave numbers. If a shift is being shown, draw both the before and after curve ' +
      'and put an arrow between them.',
  },
  {
    id: 'flow',
    label: 'A process or a flow',
    blurb: 'How a bill becomes law, how a firm decides, the steps in a proof.',
    language: 'mermaid',
    brief:
      'Draw the process as a Mermaid flowchart, top to bottom. One box per step, arrows labelled ' +
      'with the condition that leads down them. Decisions as diamonds.',
  },
  {
    id: 'cause',
    label: 'Causes and effects',
    blurb: 'What leads to what, and which way the arrow points.',
    language: 'mermaid',
    brief:
      'Draw the causal structure as a Mermaid flowchart, left to right. Each arrow labelled with ' +
      'the mechanism, not just pointing. Where the direction is contested or the effect is ' +
      'disputed, label that arrow as such rather than drawing it as settled.',
  },
  {
    id: 'structure',
    label: 'A structure or hierarchy',
    blurb: 'Branches of government, a firm’s organisation, how a system is divided.',
    language: 'mermaid',
    brief: 'Draw the structure as a Mermaid flowchart, top to bottom, grouping siblings.',
  },
  {
    id: 'timeline',
    label: 'A timeline',
    blurb: 'Events in order, with what changed at each.',
    language: 'mermaid',
    brief:
      'Draw a Mermaid timeline. Each entry a date or period and what happened, in order. Only ' +
      'dates the student gave or that are uncontested historical fact.',
  },
  {
    id: 'matrix',
    label: 'A table or payoff matrix',
    blurb: 'Game theory, a comparison, two things along two dimensions.',
    language: 'svg',
    brief:
      'Draw a grid. Row and column headers named with the players or dimensions, each cell ' +
      'holding its value. For a payoff matrix put both payoffs in each cell in the conventional ' +
      '(row, column) order and say which is which in a note under the grid.',
  },
  {
    id: 'compare',
    label: 'A comparison',
    blurb: 'Two or three things side by side on the same criteria.',
    language: 'mermaid',
    brief:
      'Draw a Mermaid flowchart with one branch per thing being compared and the criteria as ' +
      'leaves under each, so the same criteria line up across branches.',
  },
];

export function kind(id: string): Kind {
  return KINDS.find((k) => k.id === id) ?? KINDS[0];
}

/**
 * What the model is told.
 *
 * The rules about honesty are the same ones the rest of the app runs on, and
 * they matter more here: a diagram looks authoritative in a way a paragraph
 * does not, so an invented number inside a neat little chart is more likely to
 * be believed and repeated in an exam.
 */
export function systemFor(k: Kind): string {
  const shared = [
    'You draw diagrams for a university student, as code.',
    '',
    'Rules:',
    '· Only draw what you were told or what is uncontested in the field. Never invent a figure, ',
    '  a date, a percentage or a source. A number inside a neat diagram is believed more readily ',
    '  than the same number in a sentence, which makes making one up worse here, not better.',
    '· Where the student has not given a value, label the axis or the point with the name of the ',
    '  quantity rather than a made-up number.',
    '· Label everything. An unlabelled curve or box is not a diagram, it is a decoration.',
    '· Keep it to what fits on a phone: at most about a dozen nodes.',
    '· Output the code and nothing else — no explanation, no markdown fence, no preamble.',
  ];

  if (k.language === 'mermaid') {
    return [
      ...shared,
      '',
      'Output Mermaid, starting with the diagram type on the first line.',
      'Quote any node label containing a bracket, a comma or a colon, because unquoted they end ',
      'the node and produce a parse error.',
    ].join('\n');
  }

  return [
    ...shared,
    '',
    'Output one SVG element and nothing else. Requirements:',
    '· A viewBox of "0 0 600 420" and no width or height attributes, so it scales to the screen.',
    '· No script, no event handlers, no foreignObject, no external references, no CSS import. ',
    '  These are stripped before rendering and their absence is what lets the drawing be shown ',
    '  at all.',
    '· Draw for a dark background: use currentColor for lines and text so it inherits the page, ',
    '  or the palette #d4d9e2 for structure, #7fb8e8 and #c8785f for the two things being ',
    '  contrasted. Never fill a large area with white.',
    '· Font-size at least 13 on labels, and font-family "inherit".',
  ].join('\n');
}

/** Strip a markdown fence, which the model adds despite being asked not to. */
export function unfence(text: string): string {
  const fenced = /^\s*```(?:mermaid|svg|xml|html)?\s*\n([\s\S]*?)```\s*$/i.exec(text.trim());
  return (fenced ? fenced[1] : text).trim();
}

const BANNED_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'link',
  'style',
  'animate',
  'set',
  'handler',
]);

/**
 * A generated SVG, made safe to put in the page.
 *
 * Walks the parsed document rather than the string. Removes the tags that can
 * execute or load, every attribute beginning `on`, and any URL reference that
 * is not a same-document fragment — an `xlink:href` to an outside address is
 * both a tracking pixel and, historically, a script vector.
 *
 * Returns null when the text is not an SVG at all, which is the right answer
 * for a model that replied with an apology.
 */
export function cleanSvg(text: string): string | null {
  if (typeof DOMParser === 'undefined') return null;
  const source = unfence(text);
  if (!/<svg[\s>]/i.test(source)) return null;

  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') return null;

  const walk = (node: Element) => {
    for (const child of [...node.children]) {
      if (BANNED_TAGS.has(child.nodeName.toLowerCase())) {
        child.remove();
        continue;
      }
      for (const attr of [...child.attributes]) {
        if (unsafeAttribute(attr.name, attr.value)) child.removeAttribute(attr.name);
      }
      walk(child);
    }
  };
  for (const attr of [...svg.attributes]) {
    if (unsafeAttribute(attr.name, attr.value)) svg.removeAttribute(attr.name);
  }
  walk(svg);

  // Scale to the container rather than to whatever size it asked for.
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 600 420');
  svg.setAttribute('style', 'width:100%;height:auto;display:block');

  return new XMLSerializer().serializeToString(svg);
}

function unsafeAttribute(name: string, value: string): boolean {
  const n = name.toLowerCase();
  if (n.startsWith('on')) return true;
  if (n === 'style' && /expression|url\s*\(/i.test(value)) return true;
  if (n === 'href' || n === 'xlink:href' || n === 'src') {
    // A fragment points inside this document — a gradient, a marker. Anything
    // else reaches out, and a generated diagram has no business doing that.
    return !value.trim().startsWith('#');
  }
  return false;
}

/**
 * Mermaid, checked before it is handed to the renderer.
 *
 * Mermaid's own errors are unhelpful, and one thing goes wrong far more often
 * than anything else: a `%%{init}%%` directive, which can set arbitrary
 * configuration including things that load fonts from elsewhere. It is
 * stripped, and a first line that names no known diagram type is refused
 * before the library has a chance to render a cryptic red box.
 */
const TYPES = [
  'graph',
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'quadrantChart',
  'timeline',
  'mindmap',
  'gitGraph',
  'requirementDiagram',
  'sankey-beta',
  'xychart-beta',
  'block-beta',
];

export function cleanMermaid(text: string): string | null {
  const body = unfence(text)
    .split('\n')
    .filter((line) => !/^\s*%%\{/.test(line))
    .join('\n')
    .trim();
  if (!body) return null;
  const first = body.split('\n')[0].trim();
  return TYPES.some((t) => first.startsWith(t)) ? body : null;
}

/** A filename for the drawing, from what was asked for. */
export function drawingName(prompt: string, language: Language): string {
  const stem =
    prompt
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .split(/\s+/)
      .slice(0, 5)
      .join('-') || 'diagram';
  return `${stem}.${language === 'svg' ? 'svg' : 'mmd'}`;
}
