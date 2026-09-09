/**
 * A place to paste anything and have it read back.
 *
 * The panel is available under the boxes the app owns — an email, a note, a
 * draft — but most of what a student writes is written somewhere else: a
 * discussion board, an application form, a document. So there is also a box.
 *
 * It keeps nothing. What is pasted here lives in this screen's own state and
 * is gone when the screen is left, because a scratch box that quietly
 * accumulated every cover letter somebody ever checked would be a surprise,
 * and the app already has a Notes screen for text that is meant to be kept.
 * A reading dropped in to check quotations against goes the same way.
 *
 * ## Two questions of the same box
 *
 * The rules read the writing back: spelling, grammar, the punctuation nobody
 * catches in their own prose. The quotation check answers a different one —
 * *did the person you are quoting actually write that?* — by looking for every
 * quoted passage in the readings on this device. Both run on the text already
 * in the box, so neither asks for it twice, and both are arithmetic on the
 * string with nothing leaving. `lib/quotes.ts` has the reasoning, in
 * particular why a quote the app cannot find is reported as a source it has
 * not seen rather than as a quote that is wrong.
 */

import { useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { CheckIt } from '../components/CheckIt';
import { PickChips, SectionLabel } from '../components/ui';
import { extractText } from '../lib/extract';
import { liveGuide } from '../lib/live';
import { checkDraft, report, sourcesFrom, verdictLine, type Source } from '../lib/quotes';
import type { Stance } from '../lib/essay';
import type { CourseId } from '../lib/types';

export function Proof() {
  const { state, catalog, courseCode } = useStore();
  const [text, setText] = useState('');
  const [courseId, setCourseId] = useState('');
  /*
   * A file dropped in for this check and kept nowhere.
   *
   * The app holds a fraction of what a student reads, and the honest verdict
   * for the rest is "not in anything here" — which is true and unhelpful when
   * the reading is a PDF sitting in their downloads. Dropping it in makes the
   * check work on the material the quote actually came from, and it lives in
   * this screen's state exactly as long as the draft above it does. See the
   * note at the top of this file.
   */
  const [dropped, setDropped] = useState<Source[]>([]);
  const [reading, setReading] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const course = catalog.courses.find((c) => c.id === courseId);
  const stance = (course?.ai?.stance ?? 'unstated') as Stance;

  /*
   * What a quote can honestly be checked against: the readings added to a
   * course and the guides built from them, narrowed by the course picker
   * below, plus whatever was dropped in. Live guides, so a reading added an
   * hour ago counts. Your own notes are deliberately not in here —
   * `lib/quotes.ts` has why.
   */
  const sources = useMemo(() => {
    const held = sourcesFrom({
      updates: state.updates.map((u) => ({
        courseId: u.courseId,
        title: u.title,
        source: u.source,
        body: u.body,
      })),
      guides: catalog.courses.map((c) => ({
        courseId: c.id,
        code: c.code,
        guide: state.updates.length ? liveGuide(catalog, c.id, state.updates) : catalog.guides[c.id],
      })),
      courseId: courseId || null,
      codeOf: courseCode,
    });
    return [...dropped, ...held];
  }, [state.updates, catalog, courseId, courseCode, dropped]);

  const quotes = useMemo(() => checkDraft(text, sources), [text, sources]);

  const take = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setReading(true);
    try {
      const read: Source[] = [];
      for (const file of Array.from(files)) {
        const out = await extractText(file);
        if (out.text.trim()) read.push({ label: out.name, text: out.text });
      }
      setDropped((was) => [...read, ...was]);
    } catch {
      // A file the browser cannot read is not an error worth a dialog: the
      // list below simply does not grow, and everything else still works.
    } finally {
      setReading(false);
    }
  };

  return (
    <Page>
      <SectionLabel style={{ margin: '0 0 9px' }}>Paste it in</SectionLabel>
      <textarea
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck
        placeholder="An email, a discussion post, a paragraph you are not sure about."
        aria-label="The writing to check"
        style={{
          width: '100%',
          minHeight: 220,
          resize: 'vertical',
          fontSize: 'var(--type-md)',
          lineHeight: 1.6,
        }}
      />

      <CheckIt
        text={text}
        onChange={setText}
        stance={stance}
        courseCode={course?.code}
        label="Check it"
      />

      {/*
        The quotations, checked against what is on the device.

        Under the writing rules rather than beside them, because they answer
        different questions — the rules are about how a sentence reads, this
        is about whether somebody else really wrote it. Both run on the text
        already in the box, so neither asks for anything twice.
      */}
      <SectionLabel style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-4)' }}>
        The quotations in it
      </SectionLabel>
      <div
        style={{
          fontSize: 'var(--type-xs)',
          opacity: 0.55,
          marginBottom: 'var(--sp-4)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        Every passage in double quotes, looked for in the readings you have added and the guides
        built from them. Nothing leaves the device, and a quote the app cannot find is a source it
        has not seen rather than a quote that is wrong.
      </div>

      <div
        style={{
          fontSize: 'var(--type-base)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        {report(quotes, sources)}
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', marginTop: 'var(--sp-5)', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => picker.current?.click()}
          style={{ height: 44 }}
        >
          {reading ? 'Reading…' : 'Add the reading itself'}
        </button>
        <span style={{ fontSize: 'var(--type-xs)', opacity: 0.55 }}>
          {dropped.length > 0
            ? `${dropped.map((d) => d.label).join(', ')} — kept only while this screen is open`
            : 'A PDF or Word file, read here and stored nowhere'}
        </span>
        <input
          ref={picker}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,.md,.rtf,.pptx"
          aria-label="A reading to check the quotations against"
          onChange={(e) => {
            void take(e.target.files);
            e.target.value = '';
          }}
          style={{ display: 'none' }}
        />
      </div>

      {quotes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
          {quotes.map((q) => (
            <div
              key={`${q.at}-${q.text.slice(0, 24)}`}
              style={{
                border: '1px solid var(--app-line)',
                borderRadius: 'var(--r-md)',
                padding: 'var(--sp-6)',
                // Nothing is coloured like an error. A quote the app has never
                // seen the source of is not a finding against the student, and
                // a red rule down the side would say it was.
                opacity: q.verdict === 'missing' ? 0.75 : 1,
              }}
            >
              <div
                style={{
                  fontSize: 'var(--type-base)',
                  lineHeight: 'var(--leading-relaxed)',
                  textWrap: 'pretty',
                }}
              >
                “{q.text}”
              </div>
              <div
                style={{
                  marginTop: 'var(--sp-3)',
                  fontSize: 'var(--type-xs)',
                  opacity: 0.62,
                  lineHeight: 'var(--leading-relaxed)',
                  textWrap: 'pretty',
                }}
              >
                {verdictLine(q)}
              </div>
              {q.says && q.verdict !== 'found' ? (
                <div
                  style={{
                    marginTop: 'var(--sp-3)',
                    fontSize: 'var(--type-base)',
                    lineHeight: 'var(--leading-relaxed)',
                    textWrap: 'pretty',
                    borderLeft: '2px solid var(--app-line)',
                    paddingLeft: 'var(--sp-5)',
                  }}
                >
                  {q.says}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {catalog.courses.length > 0 ? (
        <>
          <SectionLabel style={{ margin: '22px 0 8px' }}>Is this for a course?</SectionLabel>
          <PickChips
            options={['', ...catalog.courses.map((c) => c.id)]}
            value={courseId}
            onChange={(id) => setCourseId(id as typeof courseId)}
            labels={(id) =>
              id === '' ? 'Not for a course' : (catalog.byId[id as CourseId]?.code ?? String(id))
            }
          />
          <p
            style={{
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
              opacity: 0.55,
              marginTop: 9,
              lineHeight: 'var(--leading-relaxed)',
              textWrap: 'pretty',
            }}
          >
            Two things depend on this: the pass that uses a model, and which course's readings
            the quotations above are checked against. The rules run either way — they are
            arithmetic on the text, and nothing leaves this device.
          </p>
        </>
      ) : null}
    </Page>
  );
}
