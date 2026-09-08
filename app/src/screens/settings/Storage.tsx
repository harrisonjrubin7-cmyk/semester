import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, NavRow, Group, ValueRow } from '../../components/shell/Rows';
import { lights } from '../../lib/settings';
import { Snapshots } from '../../components/Snapshots';
import { formatBytes, totalSize } from '../../lib/files';
import { weigh } from '../../lib/keep';
import { STORAGE_KEY } from '../../state/shape';
import { DRAFTS_KEY } from '../../lib/draft';

/** Exactly, not estimated: this is a string the app wrote and can measure. */
function sizeOf(key: string): number {
  try {
    return weigh(localStorage.getItem(key) ?? '');
  } catch {
    // A private window with storage switched off has nothing to measure.
    return 0;
  }
}

/**
 * What the app is taking up, and how to get any of it back.
 *
 * The numbers are measured rather than estimated where they can be: the store
 * and the drafts are strings this app wrote, so their size is known exactly.
 * Attachments are asked of IndexedDB. The browser's own total is offered
 * beside them because a device can refuse a write while all three of these
 * look small — see `lib/keep.ts` for what happens then.
 */
export function SettingsStorage() {
  const { dispatch, saveTrouble } = useStore();
  const [files, setFiles] = useState<number | null>(null);
  const [quota, setQuota] = useState<{ used: number; total: number } | null>(null);
  // Read during the first render rather than in an effect: these are two
  // synchronous string reads, and setting them afterwards would paint a zero
  // and then correct it.
  const [mine] = useState(() => sizeOf(STORAGE_KEY));
  const [drafts] = useState(() => sizeOf(DRAFTS_KEY));

  useEffect(() => {
    void totalSize().then(setFiles).catch(() => setFiles(null));
    // Not every browser offers this, and the ones that do round it heavily.
    if (navigator.storage?.estimate) {
      void navigator.storage
        .estimate()
        .then((e) => setQuota({ used: e.usage ?? 0, total: e.quota ?? 0 }))
        .catch(() => setQuota(null));
    }
  }, []);

  return (
    <SettingsPage
      screen="setStorage"
      blurb="What this app is holding on the device, and the three ways to get it back out."
    >
      {(lit) => (
        <>
          <Group
            header="Space used"
            footer={
              saveTrouble ||
              'A browser can refuse a write long before it runs out of room. If that happens the app says so rather than losing what you typed.'
            }
            lit={lights('storage space used quota full disk room size', lit)}
          >
            <ValueRow label="Your semester" value={formatBytes(mine)} />
            <ValueRow label="Drafts in progress" value={drafts ? formatBytes(drafts) : 'None'} />
            <ValueRow
              label="Attachments"
              value={files === null ? 'Not available' : formatBytes(files)}
            />
            {quota ? (
              <ValueRow
                label="This browser, in total"
                value={`${formatBytes(quota.used)} of ${formatBytes(quota.total)}`}
              />
            ) : null}
          </Group>

          <Group
            header="Going back"
            lit={lights('backup copies snapshot restore undo yesterday recover', lit)}
          >
            <CustomRow>
              <Snapshots />
            </CustomRow>
          </Group>

          <Group
            header="Taking it elsewhere"
            footer="A copy on this device survives a mistake. A file you have downloaded survives the device."
            lit={lights('export download backup file zip json csv restore take it with you', lit)}
          >
            <NavRow
              label="Take it with you"
              sub="Download everything, or restore from a file"
              onClick={() => dispatch({ type: 'go', screen: 'export' })}
            />
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
