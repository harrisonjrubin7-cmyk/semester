# Semester book package

Everything produced in the Claude session that built the Semester company, product, brand, operating and building books. The package is here so that Claude Code and teammates can use it from the repo.

## What's here

| Folder | Contents |
|---|---|
| `pdfs/Semester Design System.pdf` | The design system reference, 83 pages |
| `pdfs/books/` | Book 1, Company, Brand & Operating (483 pages). Book 2, Product (1,211 pages), split into two halves to stay under GitHub's file-size limit. Book 3, Design System & Building (777 pages) |
| `pdfs/20-parts/` | The same content as the three books, cut into 20 PDFs. Each is under 20 MB |
| `design-system/` | Source of the Semester Design System artifact (https://claude.ai/artifact/Px7mSTtBi5QzjvMvXYoHzd): `tokens.json`, `components/`, the guidelines and docs. `uploads/` is left out because its contents are already reproduced inside the PDFs |
| `overviews/` | Written overview chapters for each book (`book1.md` to `book3.md`) |
| `data/` | The JSON catalogs extracted from the design-system data files: roles, screens, features and the rest |
| `screenshots/` | 693 JPEG screens and slices used in the books, downscaled to 1200 px |
| `tools/` | The scripts that built the books: the crawler, screenshotters, data extraction, the assemblers and the splitter |

The 62 MB single-volume book and the unsplit Book 2 are left out. Both exceed GitHub's 50 MB warning size, and their content is fully covered by `pdfs/books/` and `pdfs/20-parts/`.

## Known gaps

- The 3D logo page is not rendered.
- Map pages render without tiles.
- The crawler went two clicks deep, so deeper screens may be missing.
- The sources disagree in three places, and Book 2's overview flags each one:
  - roles: 49 + 3 actors in one source, 51 in another;
  - screens: 589 in one source, 673 in another (the difference is 84 gap screens);
  - AI use of student records: "never" in one source, "only once switched on per data type" in another.

## Rebuilding

The scripts expect this layout:
- a scratchpad holding `live/project`, which is `design-system/` plus uploads;
- `book/`, which holds `tools/`;
- a `tools/node_modules` with playwright, react 18.3.1, react-dom 18.3.1, @babel/standalone, d3, leaflet, three, topojson-client and world-atlas.

Steps:
1. Serve `live/project` on port 8765 with `python3 -m http.server 8765`.
2. Capture the screens with `node crawl.js jobsN.json crawl <tools_dir>`.
3. Build the book chapters with `python3 build3.py <S>`.
4. Assemble each book with `python3 assemble3.py <S> out.pdf bookN.json`.
5. Split the books into parts with `split20.py`.
