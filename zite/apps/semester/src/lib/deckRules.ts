// Make a deck: an outline (or a study guide) becomes slides, and slides become a real PowerPoint .pptx. No dependency.
import { zip } from './zip';
import type { Guide } from './guideRules';

export type Slide = { title: string; bullets: string[]; notes: string };
export const MAX_BULLETS = 6;
export const MAX_SLIDES = 80;

/** "# Slide title", "- bullet" (indent ignored), "> speaker note". Other text lines become bullets. */
export function parseOutline(md: string): Slide[] {
  const out: Slide[] = []; let cur: Slide | null = null;
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const l = raw.trim();
    if (!l) continue;
    const h = /^#{1,3}\s+(.*)$/.exec(l);
    if (h) { cur = { title: h[1].trim(), bullets: [], notes: '' }; out.push(cur); continue; }
    if (!cur) { cur = { title: '', bullets: [], notes: '' }; out.push(cur); }
    const n = /^>\s?(.*)$/.exec(l);
    if (n) { cur.notes = cur.notes ? `${cur.notes} ${n[1]}` : n[1]; continue; }
    cur.bullets.push(l.replace(/^([-*+]|\d+[.)])\s+/, '').replace(/\*\*|__|`/g, ''));
  }
  return paginate(out);
}

/** Slides with more than MAX_BULLETS bullets continue on a "(cont.)" slide; never more than MAX_SLIDES. */
export function paginate(slides: Slide[]): Slide[] {
  const out: Slide[] = [];
  for (const s of slides) {
    if (s.bullets.length <= MAX_BULLETS) { out.push(s); continue; }
    for (let i = 0; i < s.bullets.length; i += MAX_BULLETS) out.push({ title: i ? `${s.title} (cont.)` : s.title, bullets: s.bullets.slice(i, i + MAX_BULLETS), notes: i ? '' : s.notes });
  }
  return out.slice(0, MAX_SLIDES);
}

export function fromGuide(g: Guide): Slide[] {
  const s: Slide[] = [];
  for (const u of g.units) {
    s.push({ title: u.name, bullets: u.points.length ? u.points : u.cards.map((c) => c.q), notes: u.cards.map((c) => `${c.q} — ${c.a}`).join(' ') });
    for (const f of u.figures) s.push({ title: f.title, bullets: f.rows.map((r) => `${r.l}: ${r.v}`), notes: f.shows });
  }
  if (g.terms.length) s.push({ title: 'Key terms', bullets: g.terms.map((t) => `${t.t} — ${t.d}`), notes: '' });
  for (const c of g.cases) s.push({ title: c.title, bullets: [c.claim, c.test, c.verdict].filter(Boolean), notes: c.lesson });
  return paginate(s);
}

export function toOutline(slides: Slide[]): string {
  return slides.map((s) => [`# ${s.title}`, ...s.bullets.map((b) => `- ${b}`), ...(s.notes ? [`> ${s.notes}`] : [])].join('\n')).join('\n\n');
}

const x = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const rels = (items: [string, string, string][]) => `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
const W = 12192000; const H = 6858000; // 16:9
const box = (id: number, name: string, ph: string, xx: number, y: number, w: number, h: number, paras: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${xx}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr wrap="square"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
const para = (t: string, sz: number, opts: { b?: boolean; bullet?: boolean; color?: string } = {}) =>
  `<a:p><a:pPr${opts.bullet ? ' marL="342900" indent="-342900"' : ''}>${opts.bullet ? '<a:buFont typeface="Arial"/><a:buChar char="&#8226;"/>' : '<a:buNone/>'}</a:pPr><a:r><a:rPr lang="en-US" sz="${sz}"${opts.b ? ' b="1"' : ''} dirty="0"><a:solidFill><a:srgbClr val="${opts.color ?? '1F2933'}"/></a:solidFill></a:rPr><a:t>${x(t)}</a:t></a:r></a:p>`;
const slideXml = (shapes: string) => `${HEAD}<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;

export function toPptx(title: string, slides: Slide[], subtitle = ''): Uint8Array<ArrayBuffer> {
  const all = [
    slideXml(box(2, 'Title', '<p:ph type="ctrTitle"/>', 914400, 2286000, W - 1828800, 1371600, para(title || 'Untitled deck', 4400, { b: true }))
      + (subtitle ? box(3, 'Subtitle', '<p:ph type="subTitle" idx="1"/>', 914400, 3749040, W - 1828800, 914400, para(subtitle, 2000, { color: '52606D' })) : '')),
    ...slides.map((s) => slideXml(
      box(2, 'Title', '<p:ph type="title"/>', 609600, 365760, W - 1219200, 1097280, para(s.title || ' ', 3200, { b: true }))
      + box(3, 'Content', '<p:ph idx="1"/>', 609600, 1600200, W - 1219200, H - 2148840, s.bullets.length ? s.bullets.map((b) => para(b, s.bullets.length > 4 ? 2000 : 2400, { bullet: true })).join('') : para(' ', 2400)))),
  ];
  const notes = ['', ...slides.map((s) => s.notes)];
  const files: Record<string, string> = {};
  const ct: string[] = [];
  all.forEach((xml, i) => {
    const n = i + 1;
    files[`ppt/slides/slide${n}.xml`] = xml;
    const r: [string, string, string][] = [['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']];
    if (notes[i]) {
      r.push(['rId2', 'notesSlide', `../notesSlides/notesSlide${n}.xml`]);
      files[`ppt/notesSlides/notesSlide${n}.xml`] = `${HEAD}<p:notes ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${box(2, 'Notes', '<p:ph type="body" idx="1"/>', 685800, 4400550, 5486400, 4114800, para(notes[i], 1200))}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
      files[`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`] = rels([['rId1', 'notesMaster', '../notesMasters/notesMaster1.xml'], ['rId2', 'slide', `../slides/slide${n}.xml`]]);
      ct.push(`<Override PartName="/ppt/notesSlides/notesSlide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`);
    }
    files[`ppt/slides/_rels/slide${n}.xml.rels`] = rels(r);
    ct.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
  });
  const hasNotes = notes.some(Boolean);
  const emptyTree = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>';
  const clrMap = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';
  const theme = (name: string) => `${HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${name}"><a:themeElements><a:clrScheme name="Semester"><a:dk1><a:srgbClr val="1F2933"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="323F4B"/></a:dk2><a:lt2><a:srgbClr val="F5F7FA"/></a:lt2><a:accent1><a:srgbClr val="2F6B5E"/></a:accent1><a:accent2><a:srgbClr val="8A5A2B"/></a:accent2><a:accent3><a:srgbClr val="3E5C76"/></a:accent3><a:accent4><a:srgbClr val="7B6D8D"/></a:accent4><a:accent5><a:srgbClr val="9C4A3B"/></a:accent5><a:accent6><a:srgbClr val="5B7553"/></a:accent6><a:hlink><a:srgbClr val="1F5F99"/></a:hlink><a:folHlink><a:srgbClr val="6B4C8A"/></a:folHlink></a:clrScheme><a:fontScheme name="Semester"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Semester"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
  Object.assign(files, {
    '[Content_Types].xml': `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${hasNotes ? '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/><Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' : ''}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${ct.join('')}</Types>`,
    '_rels/.rels': `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    'docProps/core.xml': `${HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${x(title)}</dc:title></cp:coreProperties>`,
    'ppt/presentation.xml': `${HEAD}<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdM"/></p:sldMasterIdLst>${hasNotes ? '<p:notesMasterIdLst><p:notesMasterId r:id="rIdN"/></p:notesMasterIdLst>' : ''}<p:sldIdLst>${all.map((_, i) => `<p:sldId id="${256 + i}" r:id="rIdS${i + 1}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': rels([['rIdM', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rIdT', 'theme', 'theme/theme1.xml'], ...(hasNotes ? [['rIdN', 'notesMaster', 'notesMasters/notesMaster1.xml'] as [string, string, string]] : []), ...all.map((_, i) => [`rIdS${i + 1}`, 'slide', `slides/slide${i + 1}.xml`] as [string, string, string])]),
    'ppt/slideMasters/slideMaster1.xml': `${HEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>${emptyTree}</p:cSld>${clrMap}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2400"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']]),
    'ppt/slideLayouts/slideLayout1.xml': `${HEAD}<p:sldLayout ${NS} type="obj" preserve="1"><p:cSld name="Title and Content">${emptyTree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]),
    'ppt/theme/theme1.xml': theme('Semester'),
  });
  if (hasNotes) {
    files['ppt/notesMasters/notesMaster1.xml'] = `${HEAD}<p:notesMaster ${NS}><p:cSld>${emptyTree}</p:cSld>${clrMap}</p:notesMaster>`;
    files['ppt/notesMasters/_rels/notesMaster1.xml.rels'] = rels([['rId1', 'theme', '../theme/theme2.xml']]);
    files['ppt/theme/theme2.xml'] = theme('Semester notes');
  }
  const enc = new TextEncoder();
  return zip(Object.entries(files).map(([n, s]) => ({ name: n, data: enc.encode(s) })));
}
