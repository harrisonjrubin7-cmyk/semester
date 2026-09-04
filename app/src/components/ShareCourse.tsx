/**
 * Hand this course to somebody in the same section.
 *
 * Generating a course costs a syllabus upload and a long request to a model.
 * Four people in one section pay that four times for the same PDF, and get
 * four slightly different readings of it. One person runs it, shares the file,
 * and everyone else opens it: no upload, no request, and — the part that
 * actually matters in a study group — the same deadlines.
 *
 * Only for courses the student imported. The four sample courses are compiled
 * into the app and everybody who has the app already has them.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { Trouble } from './Trouble';
import { useTrouble } from '../lib/trouble';
import { download, shareOut } from '../lib/deliver';
import { packCourse, packName } from '../lib/handoff';
import type { CourseId } from '../lib/types';

export function ShareCourse({ courseId }: { courseId: CourseId }) {
  const { state } = useStore();
  const trouble = useTrouble();
  const [sent, setSent] = useState(false);

  // `state.courses` is the imported ones only. A sample course has nothing to
  // share: the person opening the file would already have it.
  const module_ = state.courses.find((m) => m.course.id === courseId);
  if (!module_) return null;

  const hand = async () => {
    trouble.clear();
    const piece = {
      name: packName(module_.course.code),
      body: packCourse(module_),
      mime: 'application/json',
    };
    try {
      // The share sheet first: on a phone, a downloads folder is where files
      // go to be lost, and what somebody wants is the group chat.
      const went = await shareOut([piece], `${module_.course.code} for Semester`);
      if (!went) download(piece);
      setSent(true);
    } catch (e) {
      trouble.failed(e, () => void hand());
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => void hand()}
        style={{ height: 44 }}
      >
        Share this course
      </button>
      <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
        {sent
          ? 'Sent. Whoever opens it gets the deadlines, the schedule and the guide — and none of your own notes, ticks or timings, which are not in the file.'
          : 'A file with this course in it: the deadlines, the schedule and the study guide. Your notes, ticked boxes, grades and timings stay here — they are not part of a course. They open it under Add a course.'}
      </div>
      <Trouble said={trouble.said} onRetry={trouble.again} />
    </div>
  );
}
