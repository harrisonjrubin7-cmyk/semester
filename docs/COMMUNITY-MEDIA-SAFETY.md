# Community media safety

Code:

- the database: `20260928032000_community.sql`, section 16 (`community_media`,
  `community_media_blocklist`, `community_media_deletions`, the
  `community-media` bucket and its policies, `begin_community_image`,
  `record_media_scan`, and the media rules in `decide_community_case`,
  `decide_community_appeal`, `forget_my_community` and the retention sweep);
- the scanner: `supabase/functions/_shared/mediascan.ts`;
- the app: `community/metadata.ts` (strips metadata on the device),
  `components/community/Composer.tsx` and `PostImage.tsx`.

Flag: `VITE_COMMUNITY_IMAGES`. It is high-risk, off by default, and refused in
production. Server switch: the school's `community_programs` row for
`image_posts`, which only the service role writes.

**Nothing publishes today.** An image clears only once a known-abuse hash
provider has answered for it. This repository configures no provider, the
scanner refuses to run without one, and `record_media_scan` refuses a verdict
that lacks one. With the flag and the switch both on, an image post waits as
`pending` until someone does the work under [Deploying it](#deploying-it).

## The flow

1. **The device strips metadata.** The composer re-encodes the photo with
   `stripMetadata`, which removes EXIF, GPS, XMP and the camera details, and
   it shows the result. The person must describe the image, in 1–300
   characters of alt text, before it can post. There are no images under an
   alias (see PSEUDONYMITY-POLICY.md), and none in support communities.
2. **The row is reserved.** `begin_community_image` checks:
   - the program is on for the school;
   - the person is a member of the community and is not restricted;
   - they have reserved fewer than ten images in the past hour.

   It then returns a row id and the only path the person may upload to,
   `media/<id>`.
3. **The upload.** The bucket is private, takes at most 10 MB, and accepts
   JPEG, PNG and WebP. Its insert policy accepts exactly that path, from its
   uploader, while the row is `awaiting_upload`. Nobody can overwrite or
   delete a file through the API.
4. **The post.** `create_community_post(..., want_media)` accepts only the
   poster's own uploaded image and not an alias. The post starts as
   `pending`, whatever the text detectors said, and the image becomes
   `pending` too.
5. **The scan.** The service role's scanner claims pending images with a
   five-minute lease, for at most five attempts. For each, it computes facts
   from the bytes (below) and hands them to `record_media_scan`, which makes
   the decision. The scanner decides nothing itself. After five failed
   attempts the image stays `pending`, and so does the post, until someone
   investigates.
6. **Seeing it.** A member gets a signed address only for a `clear` image on
   a post that is published or reduced. The uploader always sees their own
   image. Reviewers see held images so they can decide on them. Nobody
   receives an address for a known-abuse match, reviewers included.

## What the scanner reports

All of these are computed from the file itself. None comes from the client.

- **What the file is,** from its first bytes, whatever it was declared as.
- **Whether metadata survived:**
  - JPEG: APP1 (EXIF and XMP), APP13 and comments;
  - PNG: `eXIf`, `tEXt`, `zTXt`, `iTXt` and `tIME`;
  - WebP: `EXIF` and `XMP`.
- **Size and dimensions,** read from the image header.
- **Two hashes:**
  - a SHA-256;
  - a 64-bit difference hash of a 9×8 greyscale thumbnail, which still
    matches after the image is re-encoded, resized or lightly cropped.
- **A known-abuse verdict**, `clear` or `match`, from the configured provider.
  This is required.
- **A classifier label and confidence,** if the school has a classifier. This
  is optional. It runs only on an image that is decodable and has cleared the
  known-abuse check.

## The verdict rules (`record_media_scan`, in this order)

| Condition | Result | Case |
| --- | --- | --- |
| no known-abuse verdict, or a missing hash | **refused**; the image stays pending | — |
| known-abuse **match** | `held`, `known_abuse_match` | P0 `nonconsensual_media`, rule `media.known-abuse-hash` |
| real type ≠ declared type, or not JPEG, PNG or WebP | `rejected: type_mismatch`; the post is withdrawn | — |
| metadata still present | `rejected: metadata_left` | — |
| over 10 MB | `rejected: too_large` | — |
| a side under 1 px or over 8000 px | `rejected: bad_dimensions` | — |
| SHA-256 equal to, or difference hash within 8 bits of, an image a reviewer removed at this school | `held: matches_removed_image` | the removed image's category, rule `media.reupload-of-removed` |
| classifier says `sexual_explicit` or `graphic_violence` at ≥ 0.80 | `held` | P2 `other` |
| classifier says `self_harm` at ≥ 0.80 | `held` | P1 `threat_or_safety_concern`, so the crisis runbook applies |
| otherwise | `clear`; the post publishes | — |

A rejection is mechanical, so its author is told why in plain words
(`REJECTED_TEXT` in `PostImage.tsx`) and can try again. A hold goes to a
reviewer, and the author is told only that the post is with a reviewer.

## Reviewers

- **Allow, close, label, preserve or reduce** clears a held image.
- **Remove** sets the image to `removed` and adds both of its hashes to the
  school's blocklist, so a re-upload is held. An appeal that is granted
  restores the image and removes those blocklist entries.
- **A known-abuse match can only be removed** (with or without a posting
  restriction). The server refuses any other action on it, and refuses to
  grant an appeal against its removal. The console never shows the image. In
  its place it says the image was withheld, not to try to view it, and to
  follow the reporting steps below.

## Known-abuse matches: preservation and reporting

> **Counsel must confirm this section before `image_posts` is switched on at
> any school.** It describes our understanding of the platform's obligations,
> not legal advice. The deploy steps below require that sign-off.

- **Never view it.** Reviewers do not open a matched file, and the storage
  policy gives them no way to. Only the people and process that counsel names
  handle the file.
- **Preserve it.** A matched row and its file are exempt from every deletion
  path:
  - the daily sweep, which also keeps the case;
  - the orphan clean-up;
  - account deletion;
  - the deletion queue, which never queues a match.

  The file stays in the bucket until the reporting process has finished with
  it.
- **Report it.** For apparent child sexual abuse material, US law
  (18 U.S.C. § 2258A) requires an electronic service provider that obtains
  actual knowledge to report to NCMEC's CyberTipline, and to preserve the
  report's contents for a period the statute sets. For non-consensual
  intimate imagery, the TAKE IT DOWN Act requires covered platforms to remove
  it within 48 hours of a valid request. Counsel should confirm:
  - which of these apply to Semester and to each school;
  - who files the reports, and with what access;
  - the preservation period;
  - whether a school has duties of its own, such as Title IX.

  Record the answers here before switching images on.
- **Case history.** A match opens a P0 case. The case's retention clock does
  not delete it while it holds a match.

## Deletion

A file is removed from the bucket by the scanner, not by the database. When
a media row is deleted, a trigger queues its path in
`community_media_deletions`. The trigger does not fire for known-abuse
matches. Each scanner run takes the queue, deletes the files through the
Storage API, and marks them deleted.

The following rows are deleted:

- a reservation never uploaded, after a day;
- an image whose post is gone (the orphan sweep);
- on account deletion, the uploader's images, except any that a case holds.

## Deploying it

This has not been done. Do it only after a known-abuse provider agreement is
signed and counsel has signed off.

1. Obtain a known-abuse hash provider for images, under its own agreement.
   Examples are PhotoDNA, an NCMEC hash-sharing agreement, or a vendor such as
   Safer. Wrap it as a `KnownAbuseProvider` (`name`, and a `check(bytes,
   sha256)` that returns `clear` or `match`). Optionally, wrap a classifier as
   a `Classifier`.
2. Create `supabase/functions/media-scan/index.ts`:

       import { createClient } from 'jsr:@supabase/supabase-js@2';
       import { handle } from '../_shared/mediascan.ts';
       import { knownAbuse, classifier, decode } from './providers.ts';
       const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
       const rpc = async (fn: string, args?: object) => { const { data, error } = await db.rpc(fn, args); if (error) throw error; return data; };
       const bucket = db.storage.from('community-media');
       Deno.serve((req) => handle(req, {
         secret: Deno.env.get('MEDIA_SCAN_CRON_SECRET') ?? '',
         knownAbuse, classifier, decode,
         take: () => rpc('take_media_scans'),
         download: async (path) => { const { data, error } = await bucket.download(path); if (error) throw error; return new Uint8Array(await data.arrayBuffer()); },
         record: (id, verdict) => rpc('record_media_scan', { want_media: id, want_verdict: verdict }),
         takeDeletions: () => rpc('take_media_deletions'),
         deleteObjects: async (paths) => { const { error } = await bucket.remove(paths); if (error) throw error; },
         markDeleted: (paths) => rpc('mark_media_deleted', { want_paths: paths }),
       }));

   `decode` turns JPEG, PNG or WebP bytes into greyscale pixels, and is used
   only for the difference hash. Use any decoder that runs in Deno. If it
   throws, the image is reported as undecodable and rejected.
3. Add `[functions.media-scan]` with `verify_jwt = false` to
   `supabase/config.toml`. Once it is live, add it to DEPLOY.md's "What is
   live". `functionconfig.test.ts` checks the three against each other.
4. Set `MEDIA_SCAN_CRON_SECRET` to the Vault value `media_scan_cron_secret`,
   and set the provider's own credentials.
5. Unpark the job:

       select cron.alter_job((select jobid from cron.job where jobname = 'media-scan'), active := true);

6. Switch `image_posts` on for the school (service role), and set
   `VITE_COMMUNITY_IMAGES` for the build that should show the picker.

`mediascan.test.ts` covers the scanner without a network, a bucket or Deno.
`community.check.sql` covers every rule above against Postgres.
