/**
 * The proofreading panel, droppable under any box the student writes in.
 *
 * One component rather than a screen, because the moment worth catching a
 * doubled word is the moment before the email is sent, not a separate trip to
 * a tool. It takes the text and, where the box's owner can accept one, a way
 * to put a fix back.
 *
 * Collapsed until asked for. A panel that opens itself under every text box in
 * the app would be the most annoying thing in it.
 *
 * The rules it runs are in `lib/proof.ts` and involve no model at all — they
 * are arithmetic on a string, they work offline, and nothing leaves the
 * device. The second pass does involve one, is opt-in per press, and is fenced
 * by the course's recorded policy.
 */

import { useMemo, useRef, useState } from 'react';
import { Trouble } from './Trouble';
import { useTrouble } from '../lib/trouble';
import { ask, configured } from '../lib/claude';
import {
  AI_SYSTEM,
  KIND_LABEL,
  aiAllowed,
  applyFix,
  byKind,
  proofLine,
  proofread,
  type Finding,
} from '../lib/proof';

export function CheckIt({
  text,
  onChange,
  /** The course this writing is for, if it is for one. Gates the second pass. */
  stance,
  courseCode,
  label = 'Check the writing',
}: {
  text: string;
  onChange?: (next: string) => void;
  stance?: string;
  courseCode?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [second, setSecond] = useState('');
  const [asking, setAsking] = useState(false);
  const trouble = useTrouble();
  const abort = useRef<AbortController | null>(null);

  const findings = useMemo(() => (open ? proofread(text) : []), [open, text]);
  const groups = byKind(findings);
  const gate = aiAllowed(stance);

  if (!open) {
    return (
      <button
        type="button"
        className="bare tappable"
        onClick={() => setOpen(true)}
        style={{
          width: 'auto',
          padding: '8px 0 2px',
          fontSize: 'calc(12px * var(--text-scale, 1))',
          opacity: 0.6,
          textAlign: 'left',
        }}
      >
        {label}
      </button>
    );
  }

  const runSecond = () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setAsking(true);
    setSecond('');
    trouble.clear();
    ask({
      system: AI_SYSTEM,
      messages: [{ role: 'user', content: text }],
      maxTokens: 1200,
      signal: controller.signal,
      onText: (chunk) => setSecond((s) => s + chunk),
    })
      .catch((e) => trouble.failed(e, runSecond))
      .finally(() => setAsking(false));
  };

  return (
    <div
      style={{
        marginTop: 10,
        padding: '12px 13px',
        border: '1px solid var(--app-line)',
        borderRadius: 'var(--r-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          style={{
            flex: 1,
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            textWrap: 'pretty',
          }}
        >
          {proofLine(findings, text)}
        </span>
        <button
          type="button"
          className="bare"
          onClick={() => setOpen(false)}
          style={{ width: 'auto', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5 }}
        >
          Close
        </button>
      </div>

      {groups.map(([kind, list]) => (
        <div key={kind} style={{ marginTop: 11 }}>
          <div className="kicker">{KIND_LABEL[kind]}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 5 }}>
            {list.map((f) => (
              <Row key={`${f.at}:${f.kind}`} f={f} text={text} onChange={onChange} />
            ))}
          </div>
        </div>
      ))}

      {/* Said whatever the outcome. "No rule fired" is not "this is well
          written", and the difference is the whole difference between a tool
          and a flatterer. */}
      <p
        style={{
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          opacity: 0.55,
          marginTop: 13,
          lineHeight: 1.5,
          textWrap: 'pretty',
        }}
      >
        These are rules, not a dictionary and not a judgement — they run on this device and
        catch what a rule can catch. Your browser underlines the misspellings they do not
        know about.
      </p>

      {configured() ? (
        gate.ok ? (
          <>
            <button
              type="button"
              className="bare tappable"
              onClick={asking ? () => abort.current?.abort() : runSecond}
              style={{
                width: 'auto',
                marginTop: 9,
                padding: '8px 13px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--app-line)',
                fontSize: 'calc(12px * var(--text-scale, 1))',
              }}
            >
              {asking ? 'Stop' : 'Read it again, more closely'}
            </button>
            <Trouble said={trouble.said} onRetry={trouble.again} busy={asking} />
            {second ? (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 'calc(12.5px * var(--text-scale, 1))',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  textWrap: 'pretty',
                }}
              >
                {second}
              </div>
            ) : null}
          </>
        ) : (
          <p
            style={{
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
              opacity: 0.7,
              marginTop: 9,
              lineHeight: 1.5,
              textWrap: 'pretty',
            }}
          >
            {courseCode ? `${courseCode}: ` : ''}
            {gate.why}
          </p>
        )
      ) : null}
    </div>
  );
}

function Row({
  f,
  text,
  onChange,
}: {
  f: Finding;
  text: string;
  onChange?: (next: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
      <span
        style={{
          flex: 1,
          fontSize: 'calc(12.5px * var(--text-scale, 1))',
          lineHeight: 1.45,
          textWrap: 'pretty',
        }}
      >
        <span style={{ fontFamily: 'var(--mono, ui-monospace, monospace)' }}>
          {f.found.replace(/\s+/g, ' ')}
        </span>
        <span style={{ opacity: 0.65 }}> — {f.says}</span>
      </span>
      {/* Offered only where there is exactly one right answer. An unclosed
          bracket has no single fix and gets no button, rather than a button
          that guesses. */}
      {f.fix && onChange ? (
        <button
          type="button"
          className="bare tappable"
          onClick={() => onChange(applyFix(text, f))}
          style={{
            width: 'auto',
            padding: '4px 9px',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--app-line)',
            fontSize: 'calc(11px * var(--text-scale, 1))',
            whiteSpace: 'nowrap',
          }}
        >
          {f.fix.trim() || 'space'}
        </button>
      ) : null}
    </div>
  );
}
