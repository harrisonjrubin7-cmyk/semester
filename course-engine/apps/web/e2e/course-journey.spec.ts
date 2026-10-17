import { expect, test, type Page, type Route } from "@playwright/test";
import { source as axeSource } from "axe-core";

const citationId = "00000000-0000-0000-0000-000000000010";
const guideAsset = {
  id: "guide-1",
  asset_type: "comprehensive_guide",
  title: "Coordination guide",
  status: "confirmed",
  generation_version: 2,
  updated_at: "2026-10-15T12:00:00Z",
  content: {
    sections: [{ heading: "Coordination", explanation: "Roles shape the decision path.", key_points: ["Name an owner."], examples: ["Assign one decision owner."], citation_ids: [citationId] }],
    study_questions: [],
    source_gaps: [],
    citations: { [citationId]: { label: "syllabus.pdf, p. 4", quote: "Roles shape the decision path." } },
  },
};
const assets = [
  guideAsset,
  { ...guideAsset, id: "cards-1", asset_type: "flashcards", title: "Coordination cards", content: { cards: [{ id: "card-1", front: "Who owns the decision?", back: "The named role.", difficulty: 3, citation_ids: [citationId] }], citations: guideAsset.content.citations } },
  { ...guideAsset, id: "field-guide-1", asset_type: "concept_map", title: "Coordination field guide", content: { sections: [{ heading: "Role clarity", explanation: "Defined ownership reduces coordination ambiguity.", key_points: ["Role clarity supports accountability."], examples: ["A decision owner resolves final tradeoffs."], citation_ids: [citationId] }], citations: guideAsset.content.citations } },
  { ...guideAsset, id: "quiz-1", asset_type: "practice_quiz", title: "Coordination quiz" },
];
const course = { id: "course-1", title: "Organizational Behavior", term: "Fall 2026", timezone: "America/Chicago", counts: { files: 1, review_items: 1, study_assets: 4, calendar_events: 1 } };
const sourceFile = { id: "file-1", filename: "syllabus.pdf", classification: "syllabus", status: "confirmed", size_bytes: 4096, mime_type: "application/pdf", page_count: 8 };
const review = { id: "review-1", title: "Confirm assignment date", item_type: "date_conflict", status: "needs_review", payload: { due_date: "2026-10-20" } };
const event = { id: "event-1", title: "Reflection due", event_type: "assignment", event_date: "2026-10-20", all_day: true, status: "confirmed", time_unspecified: true };

type AxeWindow = Window & {
  axe: { run: (context: Document) => Promise<{ violations: unknown[] }> };
};

async function expectNoAccessibilityViolations(page: Page) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await (window as unknown as AxeWindow).axe.run(document)).violations);
  expect(violations).toEqual([]);
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installApiFixtures(page: Page) {
  await page.addInitScript(() => localStorage.setItem("course_engine_token", "browser-test-token"));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    if (path === "/courses/course-1" && method === "GET") return json(route, course);
    if (path === "/courses/course-1/study-assets") return json(route, assets);
    if (path === "/courses/course-1/calendar-events") return json(route, [event]);
    if (path === "/courses/course-1/review-items") return json(route, [review]);
    if (path === "/courses/course-1/files") return json(route, [sourceFile]);
    if (path === "/courses/course-1/jobs") return json(route, []);
    if (path === "/courses/course-1/progress") return json(route, { items: [], average_mastery: 0 });
    if (path === "/files/file-1/source-view") return json(route, { document: sourceFile, chunks: [{ id: "chunk-1", chunk_index: 0, content: "Roles shape the decision path.", content_type: "text", page_number: 4, confidence: 0.98 }], total: 1, offset: 0, limit: 50, has_more: false });
    if (path === "/review-items/review-1" && method === "PATCH") return json(route, { ...review, status: "confirmed" });
    if (path === "/calendar-events/event-1" && method === "PATCH") return json(route, event);
    if (path === "/flashcards/card-1/review" && method === "POST") return json(route, { id: "progress-1", attempts: 1, correct_attempts: 1, mastery_score: 1 });
    if (path === "/quizzes/quiz-1/attempts" && method === "POST") return json(route, { id: "session-1", recorded: true, answer_count: 1 });
    if (path.startsWith("/study-assets/guide-1/exports/") && method === "POST") return route.fulfill({ status: 200, contentType: "application/octet-stream", headers: { "Access-Control-Expose-Headers": "Content-Disposition", "Content-Disposition": "attachment; filename=coordination-guide.docx" }, body: "browser export fixture" });
    return json(route, { detail: `Unhandled browser fixture: ${method} ${path}` }, 404);
  });
}

test.beforeEach(async ({ page }) => installApiFixtures(page));

test("workspace is accessible and responsive at supported widths", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/courses/course-1/overview");
    await expect(page.getByRole("heading", { level: 1, name: "Organizational Behavior" })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth, `${viewport.width}px viewport has horizontal overflow`).toBeLessThanOrEqual(dimensions.clientWidth);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/courses/course-1/overview");
  await expectNoAccessibilityViolations(page);
});

test("desktop and mobile overview match reviewed visual snapshots", async ({ page }) => {
  test.skip(!["darwin", "linux"].includes(process.platform), "Reviewed visual baselines currently cover macOS and Linux.");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/courses/course-1/overview");
  await expect.soft(page).toHaveScreenshot("overview-desktop.png", { fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect.soft(page).toHaveScreenshot("overview-mobile.png", { fullPage: true });
});

test("student completes the cited course journey without console errors", async ({ page }) => {
  const browserProblems: string[] = [];
  page.on("console", (message) => { if (["error", "warning"].includes(message.type())) browserProblems.push(`${message.type()}: ${message.text()}`); });
  page.on("pageerror", (error) => browserProblems.push(`pageerror: ${error.message}`));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/courses/course-1/uploads");
  await page.getByRole("button", { name: "View source" }).click();
  const sourceDialog = page.getByRole("dialog", { name: "syllabus.pdf" });
  await expect(sourceDialog).toBeVisible();
  await expect(sourceDialog.getByText("Page 4")).toBeVisible();
  await expect(sourceDialog.getByText("98% extraction confidence")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close source viewer" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sourceDialog).toBeHidden();

  await page.getByRole("link", { name: /Review Resolve uncertainty/ }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect.poll(() => page.url()).toContain("/review");

  await page.getByRole("link", { name: /Plan Calendar and deadlines/ }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Date").fill("2026-10-21");
  await page.getByRole("button", { name: "Review changes" }).click();
  await expect(page.getByText("Consequence preview")).toBeVisible();

  await page.getByRole("link", { name: /Cards Active recall/ }).click();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.getByText("The named role.")).toBeVisible();
  const recallRequest = page.waitForRequest((request) => request.url().endsWith("/flashcards/card-1/review") && request.method() === "POST");
  await page.getByRole("button", { name: "I recalled it" }).click();
  await recallRequest;

  await page.getByRole("link", { name: /Field guide Concept relationships/ }).click();
  await expect(page.getByRole("heading", { name: "Role clarity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connections" })).toBeVisible();
  await expect(page.getByText("Role clarity supports accountability.")).toBeVisible();
  await expect(page.getByText("syllabus.pdf, p. 4")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open material" })).toHaveCount(0);

  await page.getByRole("link", { name: /Quiz Cited practice/ }).click();
  await page.getByRole("button", { name: "Reveal cited answer" }).click();
  await page.getByRole("button", { name: "I got it" }).click();
  await page.getByRole("button", { name: "Finish quiz" }).click();
  await expect(page.getByText("Your self-graded attempt was recorded.")).toBeVisible();

  await page.getByRole("link", { name: /Doc Study guide/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download DOCX" }).click();
  await expect((await download).suggestedFilename()).toBe("coordination-guide.docx");
  expect(browserProblems).toEqual([]);
});

test("keyboard navigation opens search and moves to a destination", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/courses/course-1/overview");
  await page.getByRole("button", { name: "Search Semester" }).click();
  const dialog = page.getByRole("dialog", { name: "Navigate Semester" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Search destinations")).toBeFocused();
  await page.getByLabel("Search destinations").fill("source");
  await page.getByRole("link", { name: /Sources Course materials/ }).click();
  await expect(page).toHaveURL(/\/courses\/course-1\/uploads$/);
});
