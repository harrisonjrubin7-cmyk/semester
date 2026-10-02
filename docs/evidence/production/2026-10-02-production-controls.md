# Production host and authentication-control evidence

**Produced:** 2026-10-02
**Owner:** Harrison Rubin

## Hardened production host

The production deployment at `https://semester-shared-core.vercel.app/`
returned HTTP 200 at 2026-10-02 13:29:20 UTC and served these response headers:

- `Content-Security-Policy` with default, script, style, image, font, media,
  worker, connect and frame-ancestor restrictions;
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`; and
- a restrictive `Permissions-Policy`.

The response identified Vercel as the serving host. GitHub Pages remains a
separate deployment path and cannot apply the repository's response-header
configuration. The hardened-host claim applies to the Vercel production URL,
not to Pages.

## Supabase Auth rate-limit reading

The production project's Authentication → Rate Limits page was read directly.
No values were changed.

| Limit | Dashboard value |
| --- | --- |
| Token refreshes | 150 requests per 5 minutes (1,800/hour) |
| Token verifications (OTP / magic link) | 30 per 5 minutes (360/hour) |
| Sign-ups and sign-ins | 30 per 5 minutes (360/hour) |
| SMS | 30/hour; platform-managed field disabled |
| Anonymous users | 30/hour; disabled |
| Web3 sign-ups and sign-ins | 30 per 5 minutes; disabled |
| Email | 2/hour; platform-managed field disabled |
| IP-address forwarding | off |

The database write-rate-limit trigger was separately verified on fourteen
production tables on 2026-09-29, as recorded in `supabase/DEPLOY.md`. This
record closes the production readback for every Auth limit shown by the
dashboard. The email input was redacted in the accessibility tree but visibly
showed `2` emails/hour in the authenticated dashboard; no setting was changed.
