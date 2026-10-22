# Student app UI kit

Desktop recreation of the Semester student workspace: dark Ink side rail, warm Parchment content, persistent system context bar with ⌘K palette.

Screens (click the rail): **Today** (index), **BIO 210** course workspace, **Assistant** (governed AI answer → action preview → confirm), **Family** (consent-driven sharing + access history), **Campus**.

Files: `StudentApp.jsx` shell + routing, `Today.jsx`, `Course.jsx`, `Assistant.jsx`, `Family.jsx`, `Campus.jsx`, `data.jsx` sample data. All primitives come from `window.SemesterDesignSystem_e9f3ba`.

Source: composed from the shared "unity" primitives in harrisonjrubin7-cmyk/semester (`app/src/components/unity/*`, `StartToday.tsx`, `desk/Sidebar.tsx`). The production app supports six navigations and three shells; this kit shows the desktop rail layout only.
