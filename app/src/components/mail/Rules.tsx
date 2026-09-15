import { useState } from 'react';
import { TickBox } from '../ui';
import { TrashIcon } from '../Icons';
import { caught, describeRule, doesSomething, ruleName, type Rule } from '../../lib/mailrules';
import type { Mail } from '../../lib/mailbox';

/**
 * The rules list, and the form that writes one.
 *
 * A rule here is a search you kept — see `lib/mailrules.ts` for why it is
 * literally the string from the box above and not a builder with its own
 * grammar. This screen's whole job is to make that visible: the condition
 * field *is* a search field, with the same placeholder and the same operators
 * in its title, and the count beside it is run against your real mail as you
 * type.
 *
 * ## The count is the feature
 *
 * "Matches 23 of the 340 messages here" is the only part of a filter anybody
 * ever checks, and it is the difference between saving a rule and finding out
 * a fortnight later that `from:bio` was also catching the biology professor.
 * Both clients show it. It is cheap here because the matching is the same
 * pure function the list already runs.
 *
 * ## Why there is no "apply to existing mail" tick
 *
 * Gmail has one because a Gmail filter runs once, at delivery, and everything
 * already in the mailbox would otherwise be missed. Rules here are not events;
 * they are a layer read underneath your own marks every time the mailbox is
 * drawn, so they apply to everything matching, always, and stop applying the
 * moment the rule is switched off. There is nothing to backfill and nothing
 * left behind, which is also why Delete needs no warning.
 */
export function Rules({
  rules,
  mails,
  seed,
  onPut,
  onDrop,
  onClose,
}: {
  rules: Rule[];
  /** Every message the mailbox is holding, for the live match count. */
  mails: Mail[];
  /** A search to open the form on — "make a rule from this search". */
  seed: Rule | null;
  onPut: (rule: Rule) => void;
  onDrop: (id: string) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<Rule | null>(seed);

  return (
    <div className="mb-rules">
      <div className="mb-rules-head">
        <h2 className="mb-rules-title">Rules</h2>
        <button type="button" className="mb-folder-n" onClick={onClose} style={{ background: 'transparent', border: 0 }}>
          Back to the mail
        </button>
      </div>

      <p className="mb-rules-said">
        A rule is a search you kept. It applies to everything matching it, here — your account never
        hears about it — and anything you do to a message by hand wins over every rule.
      </p>

      {editing ? (
        <RuleForm
          rule={editing}
          mails={mails}
          onSave={(next) => {
            onPut(next);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setEditing({ id: `rule-${Date.now()}`, name: '', when: '', created: Date.now() })}
          style={{ width: 'auto' }}
        >
          New rule
        </button>
      )}

      {rules.length === 0 && !editing ? (
        <p className="mb-rules-said">
          Nothing yet. A first one worth having: <code>from:noreply</code>, skipping the inbox.
        </p>
      ) : (
        <ul className="mb-rules-list">
          {rules.map((rule) => (
            <li key={rule.id} className="mb-rules-row">
              <button
                type="button"
                className="bare tappable mb-rules-onoff"
                onClick={() => onPut({ ...rule, off: !rule.off })}
                aria-pressed={!rule.off}
                aria-label={`${rule.off ? 'Turn on' : 'Turn off'} ${ruleName(rule)}`}
              >
                <TickBox on={!rule.off} size={18} />
              </button>
              <button
                type="button"
                className="bare tappable mb-rules-what"
                onClick={() => setEditing(rule)}
                aria-label={`Edit ${ruleName(rule)}`}
              >
                <span className="mb-rules-name">{ruleName(rule)}</span>
                <span className="mb-rules-does">
                  {rule.off ? `Off. ${describeRule(rule)}` : describeRule(rule)}
                </span>
                <span className="mb-rules-does">{`Matches ${caught(mails, rule).length} of the ${mails.length} messages here.`}</span>
              </button>
              <button
                type="button"
                className="mb-ico"
                onClick={() => onDrop(rule.id)}
                aria-label={`Delete ${ruleName(rule)}`}
              >
                <TrashIcon size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The five fields a rule is. */
function RuleForm({
  rule,
  mails,
  onSave,
  onCancel,
}: {
  rule: Rule;
  mails: Mail[];
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(rule);
  const set = (patch: Partial<Rule>) => setDraft((was) => ({ ...was, ...patch }));
  const hits = caught(mails, draft).length;
  const ready = Boolean(draft.when.trim()) && doesSomething(draft);

  return (
    <form
      className="mb-rules-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSave(draft);
      }}
    >
      <label className="mb-rules-field">
        <span className="mb-rules-legend">When mail matches</span>
        <input
          className="input"
          value={draft.when}
          onChange={(e) => set({ when: e.target.value })}
          placeholder="from:stromme course:econ -is:read"
          /* The same operators the search box lists, because it is the same
             search. Kept identical on purpose: two lists would drift. */
          title="from: to: subject: label: course: has:attachment is:unread before: after: — and a minus in front of any of them to leave it out."
          aria-label="When mail matches"
        />
      </label>

      <p className="mb-rules-said" role="status">
        {draft.when.trim()
          ? `Matches ${hits} of the ${mails.length} messages here.`
          : 'A rule with no search would match everything, so it matches nothing until you give it one.'}
      </p>

      <fieldset className="mb-rules-does-set">
        <legend className="mb-rules-legend">Do this</legend>
        <Tick on={Boolean(draft.star)} onPress={() => set({ star: !draft.star })} label="Star it" />
        <Tick on={Boolean(draft.read)} onPress={() => set({ read: !draft.read })} label="Mark it read" />
        <Tick
          on={draft.folder === 'archive'}
          onPress={() => set({ folder: draft.folder === 'archive' ? undefined : 'archive' })}
          label="Skip the inbox"
        />
        <Tick
          on={draft.folder === 'trash'}
          onPress={() => set({ folder: draft.folder === 'trash' ? undefined : 'trash' })}
          label="Send it to the bin"
        />
      </fieldset>

      <label className="mb-rules-field">
        <span className="mb-rules-legend">Label it</span>
        <input
          className="input"
          value={draft.label ?? ''}
          onChange={(e) => set({ label: e.target.value })}
          placeholder="Reading, Admin, Society…"
          aria-label="Label it"
        />
      </label>

      <label className="mb-rules-field">
        <span className="mb-rules-legend">Call it</span>
        <input
          className="input"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={draft.when.trim() || 'A name for the list'}
          aria-label="Call it"
        />
      </label>

      <div className="mb-rules-buttons">
        <button type="submit" className="btn" disabled={!ready} style={{ width: 'auto' }}>
          Save
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ width: 'auto' }}>
          Cancel
        </button>
        {!ready && (
          <span className="mb-rules-does">
            {draft.when.trim() ? 'Pick at least one thing for it to do.' : 'Give it a search first.'}
          </span>
        )}
      </div>
    </form>
  );
}

function Tick({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <button type="button" className="bare tappable mb-rules-tick" onClick={onPress} aria-pressed={on}>
      <TickBox on={on} size={18} />
      <span>{label}</span>
    </button>
  );
}
