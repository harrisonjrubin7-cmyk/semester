import { useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { ActionButton, FilePick, Notice, SectionLabel, Segmented } from '../components/ui';
import { CardGrid, GridCard } from '../components/GridCard';
import { secondLine } from '../lib/dim';
import { useDeviceLibrary } from '../lib/device-library';
import { download } from '../lib/deliver';
import { fromMarkdown } from '../lib/document';
import {
  EMPTY_FAMILY,
  FAMILY_CATEGORIES,
  FAMILY_ITEM_KINDS,
  FAMILY_LABELS,
  FAMILY_LIMITS,
  familyHistory,
  familyPlanActive,
  familyPreview,
  newFamilyItem,
  newFamilyMember,
  readFamily,
  type FamilyAccess,
  type FamilyCategory,
  type FamilyItem,
  type FamilyMember,
} from '../lib/family';

/**
 * Deciding what a parent gets to see, item by item.
 *
 * The version of this feature that everybody builds is a parent login. It is
 * one switch, it is easy, and it hands over the grades, the health
 * administration and a calendar showing where somebody is at nine on a
 * Tuesday. A student who wanted help with a bill has handed over their life.
 *
 * So this screen is the opposite shape. A person, then a category, then the
 * individual things chosen for them — and a preview that shows exactly that
 * and nothing else. `lib/family.ts` explains why none of it is access.
 *
 * ## The preview is the argument
 *
 * It is worth a tab of its own because it is the only way to answer "what
 * would they actually see" without guessing. It renders `familyPreview`,
 * which reads the items the student typed on this screen and reaches no
 * store, no inbox, no file and no location. Remove the plan and it empties,
 * which is the thing worth being able to demonstrate before anybody agrees to
 * anything.
 *
 * ## Nothing is sent
 *
 * No invitation, no message, no account. The last section says what a real
 * connection would involve and who would have to do it. The one thing a
 * student can genuinely do today is take a copy of what they chose into
 * Write and send it themselves.
 */

const TABS = [
  { id: 'people' as const, label: 'People' },
  { id: 'items' as const, label: 'Selected' },
  { id: 'preview' as const, label: 'Preview' },
  { id: 'history' as const, label: 'Backup' },
];

type Tab = (typeof TABS)[number]['id'];

const ITEM_KIND_LABELS: Record<FamilyItem['kind'], string> = {
  information: 'Information',
  request: 'Support request',
  checklist: 'Checklist',
  budget: 'Budget estimate',
};

export function Family() {
  const { account } = useStore();
  return <Workspace key={account?.id || 'device'} storageKey={`semester.family.v1:${account?.id || 'device'}`} />;
}

function Workspace({ storageKey }: { storageKey: string }) {
  const { dispatch } = useStore();
  const lib = useDeviceLibrary(storageKey, readFamily, EMPTY_FAMILY);

  const [tab, setTab] = useState<Tab>('people');
  const [selected, setSelected] = useState('');
  const [member, setMember] = useState<FamilyMember>(() => newFamilyMember());
  const [item, setItem] = useState<FamilyItem>(() => newFamilyItem(''));
  const [notice, setNotice] = useState('');

  const person = lib.value.members.find((m) => m.id === selected);
  const preview = familyPreview(lib.value, selected);
  const items = lib.value.items.filter((i) => i.memberId === selected);

  const choose = (m: FamilyMember) => {
    setSelected(m.id);
    setMember(structuredClone(m));
    setItem(newFamilyItem(m.id));
  };

  const saveMember = () => {
    const ok = lib.update((old) =>
      familyHistory(
        { ...old, members: [...old.members.filter((m) => m.id !== member.id), member] },
        member.id,
        'Saved a permission plan on this device. No invitation sent.',
      ),
    );
    if (!ok) return;
    setSelected(member.id);
    setItem(newFamilyItem(member.id));
    setNotice('Saved on this device. It grants no account access to anybody.');
  };

  const line = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
  const field = { display: 'block', marginBottom: 'var(--sp-5)' } as const;
  const input = { width: '100%', marginTop: 'var(--sp-2)' } as const;

  return (
    <Page>
      <p style={{ ...line, marginBlock: 0, textWrap: 'pretty' }}>
        Private preparation. Nothing here sends an invitation or a message. Separate family accounts,
        verified acceptance, payments and live access all need a school service this app is not connected
        to.
      </p>

      <Segmented options={TABS} value={tab} onChange={setTab} style={{ marginBlock: 'var(--sp-5)' }} />

      {(lib.error || notice) && (
        <Notice>
          {lib.error || notice}
        </Notice>
      )}

      {lib.value.members.length > 0 && (
        <>
          <SectionLabel
            aside={`${lib.value.members.length} planned`}
            style={{ marginBlock: 'var(--sp-4) var(--sp-4)' }}
          >
            Who
          </SectionLabel>
          <CardGrid min={140}>
            {lib.value.members.map((m) => (
              <GridCard
                key={m.id}
                label={m.name}
                meta={m.revoked ? 'Plan removed' : familyPlanActive(m) ? m.relationship : 'Expired'}
                selected={m.id === selected}
                dim={m.revoked || !familyPlanActive(m)}
                onClick={() => choose(m)}
              />
            ))}
          </CardGrid>
        </>
      )}

      {tab === 'people' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMember();
          }}
        >
          <fieldset disabled={lib.blocked} style={{ border: 0, padding: 0, minWidth: 0 }}>
            <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>
              {selected ? 'Edit this plan' : 'A separate plan'}
            </SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
              <ActionButton
                onClick={() => {
                  setMember(newFamilyMember());
                  setSelected('');
                }}
                style={{ flex: '1 1 auto' }}
              >
                Add someone
              </ActionButton>
              {person && !person.revoked && (
                <ActionButton
                  onClick={() => {
                    const ok = lib.update((old) =>
                      familyHistory(
                        { ...old, members: old.members.map((m) => (m.id === selected ? { ...m, revoked: true } : m)) },
                        selected,
                        'Removed all planned access. The preview now hides every item.',
                      ),
                    );
                    if (!ok) return;
                    setMember((m) => ({ ...m, revoked: true }));
                    setNotice('Planned access removed. Copies already downloaded cannot be recalled.');
                  }}
                  style={{ flex: '1 1 auto' }}
                >
                  Remove all access
                </ActionButton>
              )}
            </div>

            <label style={field}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Name</span>
              <input
                required
                maxLength={FAMILY_LIMITS.name}
                value={member.name}
                onChange={(e) => setMember((m) => ({ ...m, name: e.target.value }))}
                style={input}
              />
            </label>
            <label style={field}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Email — optional, never contacted</span>
              <input
                type="email"
                maxLength={FAMILY_LIMITS.email}
                value={member.email}
                onChange={(e) => setMember((m) => ({ ...m, email: e.target.value }))}
                style={input}
              />
            </label>
            <label style={field}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Relationship</span>
              <input
                maxLength={100}
                value={member.relationship}
                onChange={(e) => setMember((m) => ({ ...m, relationship: e.target.value }))}
                style={input}
              />
            </label>
            <label style={field}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Planned through</span>
              <input
                type="date"
                value={member.expires}
                onChange={(e) => setMember((m) => ({ ...m, expires: e.target.value }))}
                style={input}
              />
            </label>

            <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>What they would see</SectionLabel>
            <p style={{ ...line, marginBlock: '0 var(--sp-4)', textWrap: 'pretty' }}>
              Everything starts at no access. Each plan is separate — one person's information is never in
              another person's preview.
            </p>
            {FAMILY_CATEGORIES.map((c) => (
              <label key={c} style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>{FAMILY_LABELS[c]}</span>
                <select
                  value={member.permissions[c]}
                  onChange={(e) =>
                    setMember((m) => ({
                      ...m,
                      permissions: { ...m.permissions, [c]: e.target.value as FamilyAccess },
                    }))
                  }
                  style={input}
                >
                  <option value="none">No access</option>
                  <option value="selected">Selected items only</option>
                  <option value="view">View selected items</option>
                  {/*
                    Only on finances, and only ever here. `payment` is not a
                    level of reading — it lets somebody pay and see nothing —
                    so offering it anywhere else would make an access level the
                    server rule has no branch for. See `@semester/institution`.
                  */}
                  {c === 'finances' && <option value="payment">Payment only · needs school approval</option>}
                </select>
              </label>
            ))}
            <p style={{ ...line, textWrap: 'pretty' }}>
              Even "view" includes only the items you prepare for this person. No grades, messages, study
              activity, attendance, locations, health records or advisor notes are ever pulled from your
              account.
            </p>

            {member.revoked && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-4)',
                  marginBlock: 'var(--sp-5)',
                  fontSize: 'var(--type-base)',
                }}
              >
                <input
                  type="checkbox"
                  checked={!member.revoked}
                  onChange={(e) => setMember((m) => ({ ...m, revoked: !e.target.checked }))}
                />
                <span>Restore this plan</span>
              </label>
            )}
            <button type="submit" className="btn btn-primary btn-block">
              Save plan
            </button>
          </fieldset>
        </form>
      )}

      {tab === 'items' &&
        (!person ? (
          <p style={{ fontSize: 'var(--type-base)', ...secondLine(), marginTop: 'var(--sp-6)' }}>
            Choose or add somebody first.
          </p>
        ) : (
          <>
            <SectionLabel aside={`${items.length}`} style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>
              Prepared for {person.name}
            </SectionLabel>
            {items.length === 0 ? (
              <p style={{ fontSize: 'var(--type-base)', ...secondLine(), lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
                Nothing yet. A move-in checklist, one deadline worth knowing about, a budget estimate, or
                something you want to ask for.
              </p>
            ) : (
              <CardGrid min={150}>
                {items.map((i) => (
                  <GridCard
                    key={i.id}
                    label={i.title}
                    meta={preview.some((x) => x.id === i.id) ? 'In the preview' : 'Hidden by the plan'}
                    dim={!preview.some((x) => x.id === i.id)}
                    selected={i.id === item.id}
                    title={`${FAMILY_LABELS[i.category]} · ${ITEM_KIND_LABELS[i.kind]}`}
                    onClick={() => setItem(structuredClone(i))}
                  />
                ))}
              </CardGrid>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const ok = lib.update((old) =>
                  familyHistory(
                    { ...old, items: [...old.items.filter((i) => i.id !== item.id), { ...item, memberId: selected }] },
                    selected,
                    `Prepared a selected item: ${item.title}`,
                  ),
                );
                if (!ok) return;
                setItem(newFamilyItem(selected));
                setNotice('Saved privately. Look at the preview before you share anything.');
              }}
            >
              <fieldset disabled={lib.blocked} style={{ border: 0, padding: 0, minWidth: 0 }}>
                <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>
                  {items.some((i) => i.id === item.id) ? 'Edit this item' : 'Prepare an item'}
                </SectionLabel>
                <label style={field}>
                  <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Title</span>
                  <input
                    required
                    maxLength={FAMILY_LIMITS.title}
                    value={item.title}
                    onChange={(e) => setItem((i) => ({ ...i, title: e.target.value }))}
                    style={input}
                  />
                </label>
                <label style={field}>
                  <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Category</span>
                  <select
                    value={item.category}
                    onChange={(e) => setItem((i) => ({ ...i, category: e.target.value as FamilyCategory }))}
                    style={input}
                  >
                    {FAMILY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {FAMILY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={field}>
                  <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Kind</span>
                  <select
                    value={item.kind}
                    onChange={(e) => setItem((i) => ({ ...i, kind: e.target.value as FamilyItem['kind'] }))}
                    style={input}
                  >
                    {FAMILY_ITEM_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {ITEM_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={field}>
                  <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Target date</span>
                  <input
                    type="date"
                    value={item.due}
                    onChange={(e) => setItem((i) => ({ ...i, due: e.target.value }))}
                    style={input}
                  />
                </label>
                {item.kind === 'budget' && (
                  <label style={field}>
                    <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Estimate, USD</span>
                    <input
                      type="number"
                      min={0}
                      max={FAMILY_LIMITS.amount}
                      step="0.01"
                      value={item.amount}
                      onChange={(e) => setItem((i) => ({ ...i, amount: Number(e.target.value) }))}
                      style={input}
                    />
                  </label>
                )}
                <label style={field}>
                  <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
                    Only what you mean to share
                  </span>
                  <textarea
                    rows={6}
                    maxLength={FAMILY_LIMITS.body}
                    value={item.body}
                    onChange={(e) => setItem((i) => ({ ...i, body: e.target.value }))}
                    style={input}
                  />
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-4)',
                    marginBlock: 'var(--sp-5)',
                    fontSize: 'var(--type-base)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) => setItem((i) => ({ ...i, done: e.target.checked }))}
                  />
                  <span>I have marked this done myself</span>
                </label>
                <button type="submit" className="btn btn-primary btn-block">
                  Save item
                </button>
              </fieldset>
            </form>
          </>
        ))}

      {tab === 'preview' && (
        <>
          <SectionLabel
            aside="Your view, not theirs"
            style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}
          >
            {person ? `Prepared for ${person.name}` : 'Choose somebody'}
          </SectionLabel>
          <p style={{ ...line, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
            Only what you selected by hand. This preview never reads your academic records, and it is not a
            signed-in parent session — nobody else can see any of it.
          </p>

          {person && !familyPlanActive(person) && (
            <p style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' }}>
              This plan is removed or past its date, so nothing is included.
            </p>
          )}

          {person?.permissions.finances === 'payment' && familyPlanActive(person) && (
            <div
              style={{
                border: '1px solid var(--app-line)',
                borderRadius: 'var(--r-md)',
                padding: 'var(--sp-5)',
                marginBottom: 'var(--sp-5)',
                textWrap: 'pretty',
              }}
            >
              <SectionLabel style={{ marginBlock: 0 }}>Payment only</SectionLabel>
              <p style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)', marginBlock: 'var(--sp-4)' }}>
                Balances and statements stay hidden — payment access discloses nothing. A school-verified
                payer account and an invoice-specific authorization would both be needed before anybody
                could actually pay.
              </p>
              <ActionButton onClick={() => dispatch({ type: 'go', screen: 'university' })}>
                School connections
              </ActionButton>
            </div>
          )}

          {preview.length === 0 ? (
            <p style={{ fontSize: 'var(--type-base)', ...secondLine() }}>
              Nothing is visible under this plan.
            </p>
          ) : (
            <>
              {preview
                .toSorted((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
                .map((i) => (
                  <section
                    key={i.id}
                    style={{
                      border: '1px solid var(--app-line)',
                      borderRadius: 'var(--r-md)',
                      padding: 'var(--sp-5)',
                      marginBlock: 'var(--sp-4)',
                    }}
                  >
                    <SectionLabel aside={i.due || undefined} style={{ marginBlock: 0 }}>
                      {i.title}
                    </SectionLabel>
                    <p style={{ ...line, marginBlock: 'var(--sp-2)' }}>{FAMILY_LABELS[i.category]}</p>
                    {i.kind === 'budget' && (
                      <p style={{ fontSize: 'var(--type-lg)', marginBlock: 'var(--sp-3)' }}>
                        USD {i.amount.toFixed(2)}
                      </p>
                    )}
                    <p
                      style={{
                        fontSize: 'var(--type-base)',
                        lineHeight: 'var(--leading-normal)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {i.body}
                    </p>
                    {['request', 'checklist'].includes(i.kind) && (
                      <p style={line}>{i.done ? 'You marked this done' : 'Needs attention'}</p>
                    )}
                  </section>
                ))}
              {person && (
                <ActionButton
                  tone="primary"
                  onClick={() => {
                    dispatch({
                      type: 'makeDocument',
                      open: true,
                      doc: {
                        title: `Family information for ${person.name}`,
                        subtitle: 'You prepared this · Not an official record and not an access grant',
                        courseId: null,
                        blocks: fromMarkdown(
                          preview
                            .map((i) =>
                              [
                                `## ${i.title}`,
                                i.due ? `Target date: ${i.due}` : '',
                                i.kind === 'budget' ? `Estimate (USD): ${i.amount.toFixed(2)}` : '',
                                '',
                                i.body,
                              ]
                                .filter(Boolean)
                                .join('\n'),
                            )
                            .join('\n\n'),
                        ),
                      },
                    });
                    lib.update((old) =>
                      familyHistory(old, selected, 'Took a copy of the selected items into Write.'),
                    );
                  }}
                  style={{ marginTop: 'var(--sp-5)' }}
                >
                  Take a copy into Write
                </ActionButton>
              )}
            </>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>On this device</SectionLabel>
          <p style={{ ...line, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
            What you changed here. Not a record of what anybody else saw — there is no server to have such a
            record.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <ActionButton
              onClick={() =>
                download({
                  name: 'Semester Family private backup.json',
                  body: JSON.stringify(lib.value, null, 2),
                  mime: 'application/json',
                })
              }
              style={{ flex: '1 1 auto' }}
            >
              Export backup
            </ActionButton>
            {lib.blocked && (
              <ActionButton
                onClick={() =>
                  download({ name: 'Family recovery.json', body: lib.recovery(), mime: 'application/json' })
                }
                style={{ flex: '1 1 auto' }}
              >
                Recovery copy
              </ActionButton>
            )}
          </div>
          <FilePick
            accept=".json"
            multiple={false}
            onPick={async (files) => {
              try {
                const f = files[0];
                if (!f) return;
                if (f.size > 3_000_000) throw new Error('Use a backup smaller than 3 MB.');
                const incoming = readFamily(JSON.parse(await f.text()));
                /*
                 * Restore only into an empty workspace. Merging two sets of
                 * permission plans is the one operation here that could
                 * silently widen somebody's access — a restored plan landing
                 * beside an edited one, with no way to see which won.
                 */
                if (lib.value.members.length) {
                  throw new Error('Restore into an empty family workspace, so no existing plan is merged.');
                }
                if (lib.update(incoming)) setNotice('Restored. No live access has been granted to anybody.');
              } catch (e) {
                setNotice((e as Error).message);
              }
            }}
          >
            Restore a backup
          </FilePick>

          {lib.value.history.length > 0 && (
            <ul style={{ margin: 'var(--sp-5) 0 0', paddingLeft: 'var(--sp-7)' }}>
              {lib.value.history
                .filter((h) => !selected || h.memberId === selected)
                .map((h) => (
                  <li key={h.id} style={{ ...line, paddingBlock: 'var(--sp-2)' }}>
                    {new Date(h.at).toLocaleString()} · {h.message}
                  </li>
                ))}
            </ul>
          )}

          <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}>
            What a real connection would take
          </SectionLabel>
          <ol style={{ margin: 0, paddingLeft: 'var(--sp-7)' }}>
            {[
              'You choose the resources and prepare an invitation.',
              'Your school verifies identity and issues a single-use invitation.',
              'The family member signs in to their own separate account and accepts.',
              'The server checks scope, expiry and revocation on every single request.',
              'You can see what was accessed, and revoke it immediately.',
            ].map((s) => (
              <li
                key={s}
                style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)', paddingBlock: 'var(--sp-2)' }}
              >
                {s}
              </li>
            ))}
          </ol>
          <p style={{ ...line, marginBlock: 'var(--sp-5)', textWrap: 'pretty' }}>
            Public emergency alerts have to come from an official feed, and none is configured here.
          </p>
        </>
      )}
    </Page>
  );
}
