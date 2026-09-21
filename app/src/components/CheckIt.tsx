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
import { secondLine } from '../lib/dim';
import { Panel } from './Produced';
import { Trouble } from './Trouble';
import { useTrouble } from '../lib/trouble';
import { ask } from '../lib/claude';
import { configured } from '../lib/assistant';
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
          paddingTop: 'calc(8px * var(--density, 1))', paddingInline: '0', paddingBottom: 'calc(2px * var(--density, 1))',
          fontSize: 'var(--type-sm)',
          color: 'var(--app-dim)',
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
      about: 'checking work',
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
    <Panel style={{ marginTop: 'var(--sp-5)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-5)' }}>
        <span
          style={{
            flex: 1,
            fontSize: 'var(--type-sm-plus)',
            textWrap: 'pretty',
          }}
        >
          {proofLine(findings, text)}
        </span>
        <button
          type="button"
          className="bare"
          onClick={() => setOpen(false)}
          style={{ width: 'auto', fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)' }}
        >
          Close
        </button>
      </div>

      {groups.map(([kind, list]) => (
        <div key={kind} style={{ marginTop: 'calc(11px * var(--density, 1))' }}>
          <div className="kicker">{KIND_LABEL[kind]}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(5px * var(--density, 1))', marginTop: 'calc(5px * var(--density, 1))' }}>
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
          fontSize: 'var(--type-xs-plus)',
          color: 'var(--app-dim)',
          marginTop: 'calc(13px * var(--density, 1))',
          lineHeight: 'var(--leading-relaxed)',
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
                marginTop: 'calc(9px * var(--density, 1))',
                paddingBlock: 'calc(8px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--app-line)',
                fontSize: 'var(--type-sm)',
              }}
            >
              {asking ? 'Stop' : 'Read it again, more closely'}
            </button>
            <Trouble said={trouble.said} onRetry={trouble.again} busy={asking} />
            {second ? (
              <div
                style={{
                  marginTop: 'var(--sp-5)',
                  fontSize: 'var(--type-sm-plus)',
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
              fontSize: 'var(--type-xs-plus)',
              color: 'var(--app-dim)',
              marginTop: 'calc(9px * var(--density, 1))',
              lineHeight: 'var(--leading-relaxed)',
              textWrap: 'pretty',
            }}
          >
            {courseCode ? `${courseCode}: ` : ''}
            {gate.why}
          </p>
        )
      ) : null}
    </Panel>
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
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'calc(9px * var(--density, 1))' }}>
      <span
        style={{
          flex: 1,
          fontSize: 'var(--type-sm-plus)',
          lineHeight: 'var(--leading-normal)',
          textWrap: 'pretty',
        }}
      >
        <span style={{ fontFamily: 'var(--mono, ui-monospace, monospace)' }}>
          {f.found.replace(/\s+/g, ' ')}
        </span>
        <span style={secondLine()}> — {f.says}</span>
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
            paddingBlock: 'calc(4px * var(--density, 1))', paddingInline: 'calc(9px * var(--density, 1))',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--app-line)',
            fontSize: 'var(--type-xs)',
            whiteSpace: 'nowrap',
          }}
        >
          {f.fix.trim() || 'space'}
        </button>
      ) : null}
    </div>
  );
}
