/**
 * Task validation shared by the Device and the backend write path
 * (ADR-0008 §11). The source of truth accepts writes only through
 * `POST /sync/write`, and that endpoint calls this before applying an op — so
 * this is the one gate every Task passes to enter Postgres. A failure there is a
 * *permanent* rejection (`invalid_task`): retrying an ill-formed row can never
 * succeed, so it is dead-lettered rather than looped forever.
 *
 * The stub `tasks` shape barely needs validating today. The point is the seam:
 * ADR-0008's standing rule is that every Task field added by #6–#10 is validated
 * here, and both the client and `/sync/write` wire to it *in the same ticket*,
 * so the endpoint never becomes the path by which invalid Tasks slip in.
 *
 * Pure and side-effect-free, like the rest of `packages/domain`, so the identical
 * check runs on the Device and on the server.
 */
import { isValidId } from "./ids.js";

/** The Task statuses the source-of-truth CHECK constraint permits. */
export const TASK_STATUSES = ["open", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** The fields {@link validateTask} inspects. A superset (extra keys) is fine. */
export interface ValidatableTask {
  id: unknown;
  space_id: unknown;
  title: unknown;
  status: unknown;
}

export interface TaskValidation {
  valid: boolean;
  /** Human-readable problems, one per failed rule; empty when `valid`. */
  errors: string[];
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

/**
 * Validates a Task row against the invariants the source of truth relies on:
 * `id` and `space_id` are canonical UUIDs, `title` is a non-empty string (after
 * trimming — a whitespace-only title is not a title), and `status` is one of the
 * permitted values. Returns every problem it finds rather than the first, so a
 * dead-lettered row records why in full.
 */
export function validateTask(task: ValidatableTask): TaskValidation {
  const errors: string[] = [];

  if (typeof task.id !== "string" || !isValidId(task.id)) {
    errors.push("id must be a valid UUID");
  }
  if (typeof task.space_id !== "string" || !isValidId(task.space_id)) {
    errors.push("space_id must be a valid UUID");
  }
  if (typeof task.title !== "string" || task.title.trim() === "") {
    errors.push("title must be a non-empty string");
  }
  if (!isTaskStatus(task.status)) {
    errors.push(`status must be one of: ${TASK_STATUSES.join(", ")}`);
  }

  return { valid: errors.length === 0, errors };
}
