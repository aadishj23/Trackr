import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireUserId } from "@/lib/session";
import { Task, type AssigneeState } from "@/models/Task";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { createNotification } from "@/lib/notifications";
import {
  effectiveSubtaskAssignees,
  isSubtaskFullyDone,
  recomputeAssigneeStateFromSubtasks,
  rollUpTaskStatus,
  ensureAssigneeStatesMatchAssignees,
} from "@/lib/taskState";

const patchSchema = z.object({
  // Each tick is for the current user; manager can target another user via `userId`
  subtasks: z
    .array(z.object({ id: z.string(), done: z.boolean(), userId: z.string().optional() }))
    .optional(),
  // Per-user explicit state change: I'm marking myself done (or undoing)
  markSelf: z.enum(["done", "pending"]).optional(),
  // Manager approval/reject on a specific assignee
  approve: z.object({ userId: z.string() }).optional(),
  reject: z.object({ userId: z.string() }).optional(),
  // Manager-only fields
  assigneeIds: z.array(z.string()).min(1).optional(),
  visibleToTeam: z.boolean().nullable().optional(),
  requireApproval: z.boolean().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { teamId: string; taskId: string } }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mongoose.isValidObjectId(params.taskId) || !mongoose.isValidObjectId(params.teamId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await dbConnect();
  const task = await Task.findOne({ _id: params.taskId, team: params.teamId });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const team = await Team.findById(task.team).lean();
  if (!team) return NextResponse.json({ error: "Team gone" }, { status: 404 });

  const uid = new mongoose.Types.ObjectId(userId);
  const isManager = team.manager.equals(uid);
  const isAssignee = task.assignees.some((a) => a.equals(uid));
  const isSubtaskAssignee = task.subtasks.some((s) =>
    s.assignees.some((sa) => sa.equals(uid))
  );

  if (!isManager && !isAssignee && !isSubtaskAssignee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const effectiveRequireApproval =
    task.requireApproval == null
      ? team.defaultRequireApproval === true
      : task.requireApproval === true;

  // Track per-user state-change events for notifications
  const stateEvents: { user: mongoose.Types.ObjectId; from: AssigneeState; to: AssigneeState }[] = [];
  const previousStates = new Map<string, AssigneeState>(
    task.assigneeStates.map((s) => [s.user.toString(), s.state as AssigneeState])
  );

  // Manager-only: transfer assignees
  let newAssigneeIds: mongoose.Types.ObjectId[] = [];
  if (parsed.data.assigneeIds) {
    if (!isManager) {
      return NextResponse.json({ error: "Only manager can change assignees" }, { status: 403 });
    }
    const seen = new Set<string>();
    const next: mongoose.Types.ObjectId[] = [];
    for (const aid of parsed.data.assigneeIds) {
      if (!mongoose.isValidObjectId(aid) || seen.has(aid)) continue;
      seen.add(aid);
      const oid = new mongoose.Types.ObjectId(aid);
      if (!team.members.some((m) => m.equals(oid))) {
        return NextResponse.json({ error: "Assignee not in team" }, { status: 400 });
      }
      next.push(oid);
    }
    if (next.length === 0) {
      return NextResponse.json({ error: "Need at least one assignee" }, { status: 400 });
    }
    const previous = new Set(task.assignees.map((a) => a.toString()));
    newAssigneeIds = next.filter((n) => !previous.has(n.toString()));
    task.assignees = next;
    // Prune subtask assignees + completions for users no longer on the task,
    // so a transferred-out user doesn't keep a phantom subtask ownership.
    const nextSet = new Set(next.map((n) => n.toString()));
    for (const sub of task.subtasks) {
      sub.assignees = sub.assignees.filter((sa) => nextSet.has(sa.toString()));
      sub.completions = sub.completions.filter((c) => nextSet.has(c.user.toString()));
    }
    ensureAssigneeStatesMatchAssignees(task);
  }

  // Manager-only: visibility / approval override
  if (parsed.data.visibleToTeam !== undefined) {
    if (!isManager) return NextResponse.json({ error: "Only manager" }, { status: 403 });
    task.visibleToTeam = parsed.data.visibleToTeam;
  }
  if (parsed.data.requireApproval !== undefined) {
    if (!isManager) return NextResponse.json({ error: "Only manager" }, { status: 403 });
    task.requireApproval = parsed.data.requireApproval;
  }

  // Subtask ticks: each is for the requesting user (manager can target another via userId)
  if (parsed.data.subtasks) {
    for (const upd of parsed.data.subtasks) {
      const sub = task.subtasks.find((s) => String(s._id) === upd.id);
      if (!sub) continue;
      const targetUid =
        upd.userId && isManager
          ? new mongoose.Types.ObjectId(upd.userId)
          : uid;
      const effAssignees = effectiveSubtaskAssignees(sub, task.assignees);
      const allowed =
        isManager ||
        (effAssignees.some((u) => u.equals(uid)) && targetUid.equals(uid));
      if (!allowed) {
        return NextResponse.json(
          { error: "You can only tick subtasks assigned to you" },
          { status: 403 }
        );
      }
      // Tick target must be a (real or effective) assignee
      if (!effAssignees.some((u) => u.equals(targetUid))) {
        return NextResponse.json(
          { error: "User is not an assignee of this subtask" },
          { status: 400 }
        );
      }
      const existing = sub.completions.find((c) => c.user.equals(targetUid));
      if (existing) {
        existing.done = upd.done;
        existing.doneAt = upd.done ? new Date() : null;
      } else {
        sub.completions.push({ user: targetUid, done: upd.done, doneAt: upd.done ? new Date() : null });
      }
    }
  }

  // markSelf: an assignee marks/unmarks their entire share done
  if (parsed.data.markSelf) {
    if (!isAssignee) {
      return NextResponse.json({ error: "You are not an assignee of this task" }, { status: 403 });
    }
    const desired = parsed.data.markSelf;
    if (desired === "done") {
      // Tick all of my subtasks done (so the subtask-derived state agrees)
      for (const sub of task.subtasks) {
        const eff = effectiveSubtaskAssignees(sub, task.assignees);
        if (!eff.some((u) => u.equals(uid))) continue;
        const existing = sub.completions.find((c) => c.user.equals(uid));
        if (existing) {
          existing.done = true;
          existing.doneAt = new Date();
        } else {
          sub.completions.push({ user: uid, done: true, doneAt: new Date() });
        }
      }
      // Explicitly set my state — handles the no-subtasks case and seeds
      // the recompute loop with the right target so it doesn't roll back to pending.
      const me = task.assigneeStates.find((s) => s.user.equals(uid));
      if (me) {
        me.state = effectiveRequireApproval ? "awaiting_approval" : "done";
      }
    } else {
      // pending: untick my subtasks and force state to pending
      for (const sub of task.subtasks) {
        const eff = effectiveSubtaskAssignees(sub, task.assignees);
        if (!eff.some((u) => u.equals(uid))) continue;
        const existing = sub.completions.find((c) => c.user.equals(uid));
        if (existing) {
          existing.done = false;
          existing.doneAt = null;
        }
      }
      const me = task.assigneeStates.find((s) => s.user.equals(uid));
      if (me) me.state = "pending";
    }
  }

  // Approve/reject for a specific user (manager-only)
  if (parsed.data.approve || parsed.data.reject) {
    if (!isManager) return NextResponse.json({ error: "Only manager can approve" }, { status: 403 });
    const decisionUserId = parsed.data.approve?.userId ?? parsed.data.reject!.userId;
    if (!mongoose.isValidObjectId(decisionUserId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    const decisionUid = new mongoose.Types.ObjectId(decisionUserId);
    const slot = task.assigneeStates.find((s) => s.user.equals(decisionUid));
    if (!slot) return NextResponse.json({ error: "Not an assignee" }, { status: 400 });
    if (slot.state !== "awaiting_approval") {
      return NextResponse.json({ error: "User is not awaiting approval" }, { status: 400 });
    }
    if (parsed.data.approve) {
      slot.state = "done";
    } else {
      // Reject: send back to pending and untick their subtask completions
      slot.state = "pending";
      for (const sub of task.subtasks) {
        const c = sub.completions.find((c) => c.user.equals(decisionUid));
        if (c) {
          c.done = false;
          c.doneAt = null;
        }
      }
    }
  }

  // Auto-update assignee states from subtask completions. We always recompute —
  // unticking a subtask after a user was "done" must roll them back to "pending".
  // The recompute helper preserves explicit states (markSelf/approve) for users
  // with no subtasks assigned to them.
  for (const stateSlot of task.assigneeStates) {
    const recomputed = recomputeAssigneeStateFromSubtasks(task, stateSlot.user, {
      requireApproval: effectiveRequireApproval,
    });
    if (stateSlot.state !== recomputed) {
      stateSlot.state = recomputed;
    }
  }

  // Build state-change events
  for (const slot of task.assigneeStates) {
    const before = previousStates.get(slot.user.toString()) ?? "pending";
    if (before !== slot.state) {
      stateEvents.push({ user: slot.user, from: before, to: slot.state as AssigneeState });
    }
  }

  // Final task status from rolled-up assignee states
  task.status = rollUpTaskStatus(task.assigneeStates.map((s) => s.state as AssigneeState));

  await task.save();

  // Notifications based on state events
  const actor = await User.findById(uid).lean();
  const actorName = actor?.name ?? "Someone";
  for (const ev of stateEvents) {
    if (ev.to === "awaiting_approval") {
      // Tell the manager that this user is waiting
      const who = await User.findById(ev.user).lean();
      await createNotification({
        recipient: team.manager,
        actor: ev.user,
        type: "task_completed",
        teamId: task.team,
        taskId: task._id,
        text: `${who?.name ?? "Someone"} marked their share of "${task.title}" done — needs your approval`,
        url: `/teams/${task.team}`,
      });
    }
    if (ev.to === "done" && ev.from === "awaiting_approval") {
      // Manager approved this user — notify the user
      await createNotification({
        recipient: ev.user,
        actor: uid,
        type: "task_completed",
        teamId: task.team,
        taskId: task._id,
        text: `Manager approved your share of "${task.title}"`,
        url: `/teams/${task.team}`,
      });
    }
    if (ev.to === "pending" && ev.from === "awaiting_approval") {
      // Manager rejected this user — notify the user
      await createNotification({
        recipient: ev.user,
        actor: uid,
        type: "task_completed",
        teamId: task.team,
        taskId: task._id,
        text: `Manager sent your share of "${task.title}" back for changes`,
        url: `/teams/${task.team}`,
      });
    }
    if (ev.to === "done" && ev.from !== "awaiting_approval") {
      // Auto-done by user finishing all subtasks with no approval needed → notify assigner
      if (!ev.user.equals(task.assigner)) {
        const who = await User.findById(ev.user).lean();
        await createNotification({
          recipient: task.assigner,
          actor: ev.user,
          type: "task_completed",
          teamId: task.team,
          taskId: task._id,
          text: `${who?.name ?? "Someone"} finished their share of "${task.title}"`,
          url: `/teams/${task.team}`,
        });
      }
    }
  }

  if (newAssigneeIds.length > 0) {
    await Promise.all(
      newAssigneeIds.map((a) =>
        createNotification({
          recipient: a,
          actor: uid,
          type: "task_assigned",
          teamId: task.team,
          taskId: task._id,
          text: `${actorName} added you to "${task.title}"`,
          url: `/teams/${task.team}`,
        })
      )
    );
  }

  // (Quiet unused-import warnings for helpers used only conditionally)
  void isSubtaskFullyDone;

  return NextResponse.json({ ok: true, status: task.status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { teamId: string; taskId: string } }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mongoose.isValidObjectId(params.taskId) || !mongoose.isValidObjectId(params.teamId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await dbConnect();
  const task = await Task.findOne({ _id: params.taskId, team: params.teamId });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!task.assigner.equals(new mongoose.Types.ObjectId(userId))) {
    return NextResponse.json({ error: "Only assigner can delete" }, { status: 403 });
  }
  await task.deleteOne();
  return NextResponse.json({ ok: true });
}
