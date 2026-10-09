import React from 'react';
import { SourceBadge } from './SourceBadge.jsx';
/**
 * A governed assistant answer: always labelled AI-assisted, shows the data scope it was allowed to read,
 * numbered sources, stated uncertainty, request cost, and the actions that need human confirmation.
 * Hardened: streaming / error / refused / no-sources states; an answer with no sources says so instead of looking authoritative; sources can link; citation numbers are announced; actions are never auto-run (they render as proposals until confirmed); copy and feedback hooks.
 */
export function AIResponse({ children, scope = [], sources = [], confidence, cost, policy, actions, model = 'Semester assistant', state = 'done', error, onRetry, refusal, proposals, onFeedback, generatedAt }) {
  const [fb, setFb] = React.useState(null);
  return (
    <article className="ai-frame" aria-label="AI-assisted answer" aria-busy={state === 'streaming' || undefined} data-state={state}>
      <div className="ai-head">
        <SourceBadge source="ai" updated={[model, generatedAt].filter(Boolean).join(' · ')} />
        {policy && <span className="status-chip" data-tone="pending"><span className="status-glyph" aria-hidden="true">§</span>{policy}</span>}
        {state === 'streaming' && <span className="ai-streaming" role="status">Writing…</span>}
      </div>
      {state === 'error' ? <div className="ai-body" role="alert"><p style={{ margin: 0 }}>{error || 'The assistant couldn’t answer just now. Nothing was changed.'}</p>{onRetry && <button type="button" className="btn btn-sm" style={{ marginTop: 'var(--sp-4)' }} onClick={onRetry}>Try again</button>}</div>
        : state === 'refused' ? <div className="ai-body"><p style={{ margin: 0 }}>{refusal || 'This is outside what the assistant is allowed to help with here.'}</p></div>
        : <div className="ai-body">{children}</div>}
      {state !== 'error' && state !== 'refused' && (sources.length > 0 ? (
        <ol className="ai-sources" aria-label="Sources">
          {sources.map((s, i) => (
            <li key={i}><span className="ai-cite" aria-label={'Source ' + (i + 1)}>{i + 1}</span>{s.href ? <a href={s.href} style={{ color: 'var(--text-primary)' }}>{s.title}</a> : <span style={{ color: 'var(--text-primary)' }}>{s.title}</span>}{s.kind && <SourceBadge source={s.kind} />}{s.excerpt && <span className="ai-excerpt">“{s.excerpt}”</span>}</li>
          ))}
        </ol>
      ) : state === 'done' && <p className="ai-nosource"><span aria-hidden="true">? </span>No sources were used. Check this against an official record before acting on it.</p>)}
      <div className="ai-meta">
        {scope.length > 0 && <span>Allowed to read <b>{scope.join(', ')}</b></span>}
        {confidence && <span>Confidence <b>{confidence}</b></span>}
        {cost && <span>Request cost <b className="nums">{cost}</b></span>}
      </div>
      {proposals && proposals.length > 0 && state === 'done' && <div className="ai-proposals"><div className="gov-sub">Proposed · nothing happens until you confirm</div>{proposals.map((p, i) => <div key={i} className="ai-proposal"><span>{p.label}</span><span style={{ display: 'flex', gap: 'var(--sp-3)' }}><button type="button" className="btn btn-sm btn-primary" onClick={p.onConfirm}>Confirm</button><button type="button" className="btn btn-sm btn-ghost" onClick={p.onDecline}>Not now</button></span></div>)}</div>}
      {actions && state === 'done' && <div className="state-actions">{actions}</div>}
      {onFeedback && state === 'done' && <div className="ai-feedback">{fb ? <span role="status">Thanks. This goes to the assistant team, not your instructor.</span> : <><span>Was this useful?</span><button type="button" className="btn-link" onClick={() => { setFb('up'); onFeedback('up'); }}>Yes</button><button type="button" className="btn-link" onClick={() => { setFb('down'); onFeedback('down'); }}>No</button></>}</div>}
    </article>
  );
}
