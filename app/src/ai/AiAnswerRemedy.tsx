import { useId, useState, type FormEvent } from 'react';
import { useStore } from '../state/store';
import { cloudConfigured } from '../lib/cloud';
import { SUPPORT } from '../lib/privacy';
import {
  myAiAnswerRemedies,
  raiseAiAnswerRemedy,
  type AiRemedyCategory,
  type AiRemedyInput,
  type AiRemedyReceipt,
  type AiRemedyStatus,
} from '../lib/ai-remedy';
import type { Quality } from './quality';

export function AiAnswerRemedy({
  answer,
  category,
  quality,
  available,
  submitter = raiseAiAnswerRemedy,
  statusLoader = myAiAnswerRemedies,
}: {
  answer: string;
  category: AiRemedyCategory;
  quality: Quality;
  /** Test and preview seam; production derives availability from account state. */
  available?: boolean;
  submitter?: (input: AiRemedyInput) => Promise<AiRemedyReceipt>;
  statusLoader?: () => Promise<AiRemedyStatus[]>;
}) {
  const { account } = useStore();
  const formId = useId();
  const headingId = `${formId}-heading`;
  const summaryId = `${formId}-summary`;
  const boundaryId = `${formId}-boundary`;
  const canSend = available ?? (cloudConfigured && Boolean(account));
  const [summary, setSummary] = useState('');
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<AiRemedyReceipt | null>(null);
  const [problem, setProblem] = useState('');
  const [statuses, setStatuses] = useState<AiRemedyStatus[] | null>(null);
  const [statusProblem, setStatusProblem] = useState('');

  if (!canSend) {
    return (
      <div role="status">
        <p>A verified account is required for the private review queue. No report was sent.</p>
        <p>
          Safe fallback: write to {SUPPORT} and do not include the answer, grades, health information, or another person’s data.
        </p>
      </div>
    );
  }

  if (receipt) {
    return (
      <div role="status" aria-live="polite">
        <p>Review requested. Status: submitted for human review.</p>
        <p>Reference {receipt.id}. The owning seat is the school’s trust officer.</p>
      </div>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem('');
    setSending(true);
    try {
      setReceipt(await submitter({
        category,
        summary,
        answer,
        sourceStrength: quality.source.level,
        policyState: quality.policy.level,
        sourceCount: quality.source.count,
      }));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The review request could not be sent.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} aria-labelledby={headingId}>
        <h3 id={headingId} style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-2)' }}>
          Request a human review
        </h3>
        <p style={{ fontSize: 'var(--type-xs)' }}>
          Category: {category}. Explain what should be corrected or why the answer may be harmful. The answer itself is not stored;
          a one-way fingerprint links this request to it.
        </p>
        <label htmlFor={summaryId}>What should the reviewer know?</label>
        <textarea
          id={summaryId}
          className="input"
          required
          maxLength={2000}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
        <p id={boundaryId} style={{ fontSize: 'var(--type-xs)' }}>
          This private request goes to an authorized human reviewer for your school. Filing it cannot automatically change a grade,
          enrollment, discipline, or access decision, and must not be used for retaliation. Do not include another person’s private data.
        </p>
        {problem && <p role="alert">Not sent: {problem} You can use the safe fallback at {SUPPORT}.</p>}
        <button type="submit" className="btn btn-secondary" disabled={sending || !summary.trim()} aria-describedby={boundaryId}>
          {sending ? 'SENDING…' : 'REQUEST HUMAN REVIEW'}
        </button>
      </form>
      <button
        type="button"
        className="bare link-quiet"
        onClick={() => {
          setStatusProblem('');
          void statusLoader().then(setStatuses).catch((error: unknown) => {
            setStatusProblem(error instanceof Error ? error.message : 'Review status is unavailable.');
          });
        }}
      >
        CHECK MY REVIEW STATUS
      </button>
      {statusProblem && <p role="alert">Status unavailable: {statusProblem}</p>}
      {statuses && (
        <div role="status" aria-live="polite">
          {statuses.length === 0
            ? 'No review requests were found for this account.'
            : `Latest request: ${statuses[0].status.replace('_', ' ')}. Owner: trust officer. Due ${statuses[0].responseDueAt}.`}
        </div>
      )}
    </div>
  );
}
