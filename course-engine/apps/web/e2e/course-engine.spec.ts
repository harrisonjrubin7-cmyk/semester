import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { source as axeSource } from "axe-core";

const course = {
  id: "demo-course",
  title: "Organizational Behavior",
  term: "Fall 2026",
  timezone: "America/Chicago",
  counts: { files: 0, review_items: 0, study_assets: 0, calendar_events: 0 },
  created_at: "2026-10-12T00:00:00Z",
  updated_at: "2026-10-12T00:00:00Z",
};

type AxeWindow = Window & {
  axe: {
    run: (
      context: Document,
      options: { resultTypes: string[] },
    ) => Promise<{
      violations: Array<{
        id: string;
        impact: string | null;
        nodes: Array<{ target: string[]; failureSummary?: string }>;
      }>;
    }>;
  };
};

async function expectNoAccessibilityViolations(page: Page) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const results = await (window as unknown as AxeWindow).axe.run(document, {
      resultTypes: ["violations"],
    });
    return results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    }));
  });
  expect(violations).toEqual([]);
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function mockCourseApi(page: Page) {
  await page.addInitScript(() => localStorage.setItem("course_engine_token", "browser-test-token"));
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
    const responses: Record<string, unknown> = {
      "/courses/demo-course": course,
      "/courses/demo-course/study-assets": [],
      "/courses/demo-course/calendar-events": [],
      "/courses/demo-course/review-items": [],
      "/courses/demo-course/files": [],
    };
    if (!(path in responses)) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not mocked" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(responses[path]) });
  });
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

async function expectKeyboardReachable(page: Page, target: Locator, maxTabs = 8) {
  for (let attempt = 0; attempt < maxTabs; attempt += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  await expect(target).toBeFocused();
}

test("landing page has a clean accessible browser render", async ({ page }, testInfo) => {
  const errors = collectBrowserErrors(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Study from evidence, not guesses." })).toBeVisible();
  await expect(page.getByRole("group", { name: "Account action" })).toBeVisible();
  await expectKeyboardReachable(page, page.getByRole("button", { name: "Sign in" }));
  await expectNoAccessibilityViolations(page);
  await attachScreenshot(page, testInfo, "landing-desktop");
  expect(errors).toEqual([]);
});

test("desktop course shell preserves focus and source-aware navigation", async ({ page }, testInfo) => {
  const errors = collectBrowserErrors(page);
  await mockCourseApi(page);
  await page.goto("/courses/demo-course/overview");

  await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to course content" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#workspace-content")).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Course navigation" })).toBeVisible();
  const search = page.locator(".desktop-rail").getByRole("button", { name: /search/i });
  await search.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Navigate Semester" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search destinations" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Navigate Semester" })).toBeHidden();
  await expect(search).toBeFocused();
  await expectNoAccessibilityViolations(page);
  await attachScreenshot(page, testInfo, "workspace-desktop");
  expect(errors).toEqual([]);
});

test("mobile course shell stays within the viewport and keeps labeled navigation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = collectBrowserErrors(page);
  await mockCourseApi(page);
  await page.goto("/courses/demo-course/overview");

  await expect(page.locator(".desktop-rail")).toBeHidden();
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  await mobileNavigation.getByRole("button", { name: "Search Semester" }).click();
  const dialog = page.getByRole("dialog", { name: "Navigate Semester" });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await expectNoAccessibilityViolations(page);
  await attachScreenshot(page, testInfo, "workspace-mobile");
  expect(errors).toEqual([]);
});
