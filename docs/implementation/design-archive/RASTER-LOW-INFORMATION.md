# Low-information raster review ledger

This ledger makes the archive raster triage reproducible. It records the 86 lowest-information raster entries used for follow-up review; it does not assert that an image is unusable or unlicensed.

## Method

- Source: the 248 raster entries in `The Main Semester design system (2) copy 4.zip` at SHA-256 `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`.
- Each image was decoded, converted to RGB, normalized to 64 × 64 pixels, and scored by the mean population variance of its red, green, and blue channels.
- The flag is deterministic: sort ascending by variance, then by archive path to break ties, and retain the first 86 entries.
- Low variance is only a triage signal. Human review through the committed contact sheets remains authoritative for context.

| Rank | Archive path | Mean RGB variance |
| ---: | --- | ---: |
| 1 | `scraps/04-mobile-check4.png` | 7.457 |
| 2 | `scraps/04-sweepA.png` | 8.495 |
| 3 | `scraps/03-route-sweep2.png` | 13.919 |
| 4 | `scraps/reg1r.jpg` | 17.051 |
| 5 | `scraps/reg2r.jpg` | 17.051 |
| 6 | `scraps/appsec4.jpg` | 17.748 |
| 7 | `scraps/09-deep149.jpg` | 20.689 |
| 8 | `scraps/10-deep149.jpg` | 20.689 |
| 9 | `scraps/11-deep149.jpg` | 20.689 |
| 10 | `scraps/12-deep149.jpg` | 20.689 |
| 11 | `scraps/13-deep149.jpg` | 20.689 |
| 12 | `scraps/08-smoke4.jpg` | 23.605 |
| 13 | `scraps/09-smoke4.jpg` | 23.605 |
| 14 | `scraps/01-reg6.jpg` | 24.583 |
| 15 | `scraps/02-reg6.jpg` | 24.583 |
| 16 | `scraps/03-reg6.jpg` | 24.583 |
| 17 | `scraps/04-reg6.jpg` | 24.583 |
| 18 | `scraps/05-reg6.jpg` | 24.583 |
| 19 | `scraps/06-reg6.jpg` | 24.583 |
| 20 | `scraps/07-reg6.jpg` | 24.583 |
| 21 | `scraps/08-reg6.jpg` | 24.583 |
| 22 | `scraps/09-reg6.jpg` | 24.583 |
| 23 | `scraps/10-reg6.jpg` | 24.583 |
| 24 | `scraps/11-reg6.jpg` | 24.583 |
| 25 | `scraps/12-reg6.jpg` | 24.583 |
| 26 | `scraps/13-reg6.jpg` | 24.583 |
| 27 | `scraps/14-reg6.jpg` | 24.583 |
| 28 | `scraps/15-reg6.jpg` | 24.583 |
| 29 | `scraps/16-reg6.jpg` | 24.583 |
| 30 | `scraps/17-reg6.jpg` | 24.583 |
| 31 | `scraps/18-reg6.jpg` | 24.583 |
| 32 | `scraps/19-reg6.jpg` | 24.583 |
| 33 | `scraps/20-reg6.jpg` | 24.583 |
| 34 | `scraps/21-reg6.jpg` | 24.583 |
| 35 | `scraps/22-reg6.jpg` | 24.583 |
| 36 | `scraps/23-reg6.jpg` | 24.583 |
| 37 | `scraps/24-reg6.jpg` | 24.583 |
| 38 | `scraps/25-reg6.jpg` | 24.583 |
| 39 | `scraps/26-reg6.jpg` | 24.583 |
| 40 | `scraps/27-reg6.jpg` | 24.583 |
| 41 | `scraps/reg5r.jpg` | 24.583 |
| 42 | `scraps/reg6r.jpg` | 25.078 |
| 43 | `scraps/03-mobile-check2.png` | 27.085 |
| 44 | `scraps/06-deep149.jpg` | 29.715 |
| 45 | `scraps/07-deep149.jpg` | 29.715 |
| 46 | `scraps/25-reg5.jpg` | 29.715 |
| 47 | `scraps/05-deep149.jpg` | 29.931 |
| 48 | `scraps/02-p5.jpg` | 32.900 |
| 49 | `scraps/08-deep149.jpg` | 37.191 |
| 50 | `scraps/03-mobile-check.png` | 48.148 |
| 51 | `scraps/05-smoke4.jpg` | 51.080 |
| 52 | `scraps/14-deep149.jpg` | 51.080 |
| 53 | `scraps/03-mobile-check3.png` | 63.658 |
| 54 | `scraps/01-reg5.jpg` | 71.637 |
| 55 | `scraps/02-reg5.jpg` | 71.637 |
| 56 | `scraps/03-reg5.jpg` | 71.637 |
| 57 | `scraps/04-reg5.jpg` | 71.637 |
| 58 | `scraps/05-reg5.jpg` | 71.637 |
| 59 | `scraps/06-reg5.jpg` | 71.637 |
| 60 | `scraps/07-reg5.jpg` | 71.637 |
| 61 | `scraps/08-reg5.jpg` | 71.637 |
| 62 | `scraps/09-reg5.jpg` | 71.637 |
| 63 | `scraps/10-reg5.jpg` | 71.637 |
| 64 | `scraps/11-reg5.jpg` | 71.637 |
| 65 | `scraps/12-reg5.jpg` | 71.637 |
| 66 | `scraps/13-reg5.jpg` | 71.637 |
| 67 | `scraps/14-reg5.jpg` | 71.637 |
| 68 | `scraps/15-reg5.jpg` | 71.637 |
| 69 | `scraps/16-reg5.jpg` | 71.637 |
| 70 | `scraps/17-reg5.jpg` | 71.637 |
| 71 | `scraps/18-reg5.jpg` | 71.637 |
| 72 | `scraps/19-reg5.jpg` | 71.637 |
| 73 | `scraps/20-reg5.jpg` | 71.637 |
| 74 | `scraps/21-reg5.jpg` | 71.637 |
| 75 | `scraps/22-reg5.jpg` | 71.637 |
| 76 | `scraps/reg4r.jpg` | 71.637 |
| 77 | `scraps/02-sweep.png` | 75.877 |
| 78 | `scraps/07-smoke4.jpg` | 79.636 |
| 79 | `scraps/route-sweep.png` | 82.546 |
| 80 | `scraps/01-smoke4.jpg` | 82.700 |
| 81 | `scraps/02-smoke4.jpg` | 82.700 |
| 82 | `scraps/03-smoke4.jpg` | 82.700 |
| 83 | `scraps/04-smoke4.jpg` | 82.700 |
| 84 | `scraps/smoke3.jpg` | 82.700 |
| 85 | `scraps/reg8r.jpg` | 105.248 |
| 86 | `scraps/02-appsec2.jpg` | 108.078 |
