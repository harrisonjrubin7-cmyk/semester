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
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { CheckIt } from '../components/CheckIt';
import { PickChips, SectionLabel } from '../components/ui';
import type { Stance } from '../lib/essay';
import type { CourseId } from '../lib/types';

export function Proof() {
  const { catalog } = useStore();
  const [text, setText] = useState('');
  const [courseId, setCourseId] = useState('');

  const course = catalog.courses.find((c) => c.id === courseId);
  const stance = (course?.ai?.stance ?? 'unstated') as Stance;

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
            Only affects the second pass, which is the one that uses a model. The rules run
            either way — they are arithmetic on the text and nothing leaves this device.
          </p>
        </>
      ) : null}
    </Page>
  );
}
