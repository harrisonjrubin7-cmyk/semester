"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@semester/auth/server";
import { createTask } from "@semester/database/dal/tasks";

export async function createTaskAction(input: unknown) {
  const ctx = await requireSession();
  return createTask(ctx, input);
}

export async function createTaskFormAction(formData: FormData): Promise<void> {
  await createTaskAction({ title: formData.get("title") });
  revalidatePath("/app/today");
}
