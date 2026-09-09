import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, NavRow, Group } from '../../components/shell/Rows';
import { lights } from '../../lib/settings';
import { Snapshots } from '../../components/Snapshots';

/**
 * How to get space back, and where to go to see how much there is.
 *
 * This page used to measure as well — your semester, the drafts, the
 * attachments and the browser's quota, the last of those by calling
 * `navigator.storage.estimate()` inline. Your data was already reporting the
 * same quota through `space()` in `lib/inventory.ts`, which asks the same
 * browser API and also knows whether the data is evictable and which backend
 * is live. Two measurements of one number, on two screens, is a number that
 * can disagree with itself — and it is the one number somebody opens either
 * screen to check.
 *
 * So the measuring is Your data's job now, all of it, and this page keeps what
 * is genuinely a settings job: the two ways of getting something back. The
 * drafts and attachments figures went with the measuring rather than being
 * dropped.
 */
export function SettingsStorage() {
  const { dispatch, saveTrouble } = useStore();

  return (
    <SettingsPage
      screen="setStorage"
      blurb="The two ways to get back something you have lost. What the app is holding is on Your data."
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
            <NavRow
              label="Your data"
              sub="Every record, what it weighs, and how much room is left"
              onClick={() => dispatch({ type: 'go', screen: 'data' })}
            />
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
