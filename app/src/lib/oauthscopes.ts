/**
 * Every OAuth scope Semester asks a provider for, and the call that needs it.
 *
 * The one list. `PROVIDERS` in `lib/connect.ts` joins these into the `scope`
 * parameter of the consent URL, and `oauthscopes.test.ts` pins them exactly:
 * a scope added here, or a broader one swapped in, fails a test rather than
 * widening what a student's account hands over in silence.
 *
 * The rule for each is the narrowest scope that still lets the calls in
 * `connect.ts` work, read against the provider's own method-level scope list
 * (Google's discovery documents; Microsoft Graph's permission reference) on
 * 29 September 2026. What was dropped then, and why:
 *
 *  - Google `calendar.events` → `calendar.events.owned`. The app reads and
 *    inserts on `calendars/primary/events` only, and the primary calendar is
 *    always one you own. `calendar.events` also reached every calendar shared
 *    with you that you could edit.
 *  - Microsoft `profile` and `User.Read`. Nothing reads `/me` or a name claim;
 *    the card says "this account" either way.
 *  - Zoom `user:read`. Only `/users/me/meetings` and `/users/me/recordings`
 *    are called, which `meeting:read` and `recording:read` cover.
 *
 * What stays broad, and why it cannot yet be narrower:
 *
 *  - Google `drive.readonly` and Microsoft `Files.ReadWrite`. "Recent files"
 *    lists what is already in the drive, which `drive.file` cannot see; and
 *    Microsoft's app-folder scope is not available to work or school
 *    accounts, which is the account this app is for. The narrow route is a
 *    file picker (INT-012 in the launch register), not a different string.
 *  - `gmail.readonly` and `Mail.Read`. The mail screen shows message bodies;
 *    `gmail.metadata` and `Mail.ReadBasic` exclude them. Both are read-only.
 *  - `Calendars.ReadWrite` and `Tasks.ReadWrite` / Google `tasks`. Adding an
 *    event or a task is a write, and neither provider has a create-only scope.
 */

export type ScopedProvider = 'microsoft' | 'google' | 'zoom' | 'apple';

export const SCOPES: Readonly<Record<ScopedProvider, readonly string[]>> = {
  microsoft: [
    'openid',
    // Without it Microsoft issues no refresh token and the connection dies
    // after an hour.
    'offline_access',
    // calendarview (read) and POST /me/events (write).
    'Calendars.ReadWrite',
    // /me/messages and /me/mailFolders/*/messages, with bodies. Read-only.
    'Mail.Read',
    // /me/todo/lists (read) and POST …/tasks (write).
    'Tasks.ReadWrite',
    // /me/drive/recent (read) and PUT /me/drive/root:/Semester/… (write).
    'Files.ReadWrite',
  ],
  google: [
    'openid',
    // events.list and events.insert on the primary calendar only.
    'https://www.googleapis.com/auth/calendar.events.owned',
    // files.list and files.get/export for "Recent files".
    'https://www.googleapis.com/auth/drive.readonly',
    // files.create for an export: reaches only files this app created.
    'https://www.googleapis.com/auth/drive.file',
    // messages.list and messages.get?format=full. Read-only.
    'https://www.googleapis.com/auth/gmail.readonly',
    // tasks.insert on @default. There is no narrower writing scope.
    'https://www.googleapis.com/auth/tasks',
  ],
  zoom: ['meeting:read', 'recording:read'],
  // Asking Apple for name or email forces a form POST a single-page app never
  // receives; identity alone needs no scope.
  apple: [],
};

/** The space-separated `scope` parameter for a provider's consent URL. */
export function scopeParam(id: ScopedProvider): string {
  return SCOPES[id].join(' ');
}
