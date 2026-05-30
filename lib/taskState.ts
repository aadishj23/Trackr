import type mongoose from "mongoose";
import type { ITask, ISubtask, AssigneeState, TaskStatus } from "@/models/Task";

export function effectiveSubtaskAssignees(
  sub: Pick<ISubtask, "assignees">,
  parentAssignees: mongoose.Types.ObjectId[]
): mongoose.Types.ObjectId[] {
  return sub.assignees.length > 0 ? sub.assignees : parentAssignees;
}

export function isSubtaskDoneFor(sub: ISubtask, userId: mongoose.Types.ObjectId) {
  return sub.completions.some((c) => c.user.equals(userId) && c.done);
}

export function isSubtaskFullyDone(
  sub: ISubtask,
  parentAssignees: mongoose.Types.ObjectId[]
) {
  const eff = effectiveSubtaskAssignees(sub, parentAssignees);
  if (eff.length === 0) return false;
  return eff.every((u) => sub.completions.some((c) => c.user.equals(u) && c.done));
}

/**
 * Derive a single user's task state from their subtask completions and
 * any existing manual state (awaiting_approval set by user, done set by manager).
 * - If user has all of their effective subtasks done → "done" (auto)
 * - Else if any progress → keep existing manual state (pending unless overridden)
 *
 * Manual transitions (awaiting_approval, done via approval) are not overridden here.
 */
export function recomputeAssigneeStateFromSubtasks(
  task: ITask,
  userId: mongoose.Types.ObjectId,
  options: { requireApproval: boolean }
): AssigneeState {
  const subs = task.subtasks.filter((s) => {
    const eff = effectiveSubtaskAssignees(s, task.assignees);
    return eff.some((u) => u.equals(userId));
  });
  if (subs.length === 0) {
    // No subtasks assigned to this user — state is driven only by explicit
    // markSelf / approve calls, so preserve whatever is already there.
    const existing = task.assigneeStates.find((s) => s.user.equals(userId));
    return existing?.state ?? "pending";
  }
  const allDone = subs.every((s) => isSubtaskDoneFor(s, userId));
  if (allDone) return options.requireApproval ? "awaiting_approval" : "done";
  // Anything less than allDone: roll back to pending so unticking truly reopens.
  return "pending";
}

export function rollUpTaskStatus(states: AssigneeState[]): TaskStatus {
  if (states.length === 0) return "pending";
  if (states.every((s) => s === "done")) return "completed";
  if (states.some((s) => s === "awaiting_approval") && states.every((s) => s !== "pending")) {
    return "awaiting_approval";
  }
  if (states.some((s) => s !== "pending")) return "in_progress";
  return "pending";
}

export function ensureAssigneeStatesMatchAssignees(task: ITask) {
  const have = new Map(task.assigneeStates.map((s) => [s.user.toString(), s]));
  const next: { user: mongoose.Types.ObjectId; state: AssigneeState }[] = [];
  for (const u of task.assignees) {
    const existing = have.get(u.toString());
    next.push({ user: u, state: existing?.state ?? "pending" });
  }
  task.assigneeStates = next as ITask["assigneeStates"];
}
