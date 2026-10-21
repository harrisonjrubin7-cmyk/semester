import { getTodayFeed } from "@semester/database/dal/today";
import { requireSessionOrRedirect } from "../../../lib/session";
import { createTaskFormAction } from "./actions";

export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  "FORBIDDEN:no_tenant": "Your account is not attached to a workspace yet.",
  POLICY_UNAVAILABLE: "Access checks are unavailable right now. Try again shortly.",
};

export default async function TodayPage() {
  const ctx = await requireSessionOrRedirect("/app/today");

  let items: Awaited<ReturnType<typeof getTodayFeed>> = [];
  let errorMessage: string | null = null;
  try {
    items = await getTodayFeed(ctx);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    errorMessage = ERROR_COPY[code] ?? (code.startsWith("FORBIDDEN") ? "You do not have access to this page." : "Something went wrong loading your tasks.");
  }

  return (
    <main>
      <h1>Today</h1>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {!errorMessage && items.length === 0 ? <p>No tasks yet.</p> : null}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.title} <small>({item.status})</small>
          </li>
        ))}
      </ul>
      <form action={createTaskFormAction}>
        <label htmlFor="title">New task</label>{" "}
        <input id="title" name="title" required maxLength={200} />{" "}
        <button type="submit">Add task</button>
      </form>
    </main>
  );
}
