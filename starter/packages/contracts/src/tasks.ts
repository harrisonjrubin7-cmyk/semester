import { z } from "zod";

export const CreateTaskInput = z.object({
  title: z.string().trim().min(1).max(200),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export type TaskView = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};
