import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireUserId } from "@/lib/session";
import { Team } from "@/models/Team";
import { Task, type AssigneeState } from "@/models/Task";
import { User } from "@/models/User";
import { createNotification } from "@/lib/notifications";

const createSchema = z.object({
  assigneeIds: z.array(z.string().min(1)).min(1, "Pick at least one assignee"),
  title: z.string().min(1).max(140),
  description: z.string().max(2000).optional().default(""),
  dueDate: z.string().datetime().nullable().optional(),
  visibleToTeam: z.boolean().nullable().optional(),
  requireApproval: z.boolean().nullable().optional(),
  subtasks: z
    .array(
      z.object({
        title: z.string().min(1).max(140),
        assigneeIds: z.array(z.string()).optional().default([]),
      })
    )
    .max(50)
    .optional()
    .default([]),
});

type PopulatedUserRef = { _id: mongoose.Types.ObjectId; username: string };

export async function GET(req: Request, { params }: { params: { teamId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mongoose.isValidObjectId(params.teamId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }
  await dbConnect();
  const team = await Team.findById(params.teamId).lean();
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const uid = new mongoose.Types.ObjectId(userId);
  const isManager = team.manager.equals(uid);
  const isMember = team.members.some((m) => m.equals(uid));
  if (!isManager && !isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? (isManager ? "all" : "mine");
  const filter: Record<string, unknown> = { team: team._id };
  if (scope === "mine") {
    filter.$or = [{ assignees: uid }, { "subtasks.assignees": uid }];
  } else if (!isManager) {
    const visibleClauses: Record<string, unknown>[] = [
      { assignees: uid },
      { "subtasks.assignees": uid },
      { visibleToTeam: true },
    ];
    if (team.defaultTasksVisible !== false) {
      visibleClauses.push({ visibleToTeam: null });
    }
    filter.$or = visibleClauses;
  }

  const tasks = await Task.find(filter)
    .sort({ createdAt: -1 })
    .populate<{ assignees: PopulatedUserRef[] }>("assignees", "username")
    .populate<{ assigner: PopulatedUserRef }>("assigner", "username")
    .populate<{ subtasks: ({ assignees: PopulatedUserRef[] } & { _id: mongoose.Types.ObjectId; title: string; completions: { user: mongoose.Types.ObjectId; done: boolean }[] })[] }>(
      "subtasks.assignees",
      "username"
    )
    .lean();

  const teamDefaultVisible = team.defaultTasksVisible !== false;
  const teamDefaultApproval = team.defaultRequireApproval === true;
  const parentAssigneeMap = new Map<string, string>(); // userId → username, populated below
  // (We populate task.assignees so usernames are in t.assignees already.)

  return NextResponse.json({
    tasks: tasks.map((t) => {
      const effectiveVisible = t.visibleToTeam == null ? teamDefaultVisible : t.visibleToTeam === true;
      const effectiveApproval = t.requireApproval == null ? teamDefaultApproval : t.requireApproval === true;

      // Build a quick lookup of usernames for ID resolution within subtask completions
      const usernameById = new Map<string, string>();
      for (const a of t.assignees as PopulatedUserRef[]) usernameById.set(String(a._id), a.username);
      for (const s of t.subtasks as ({ assignees: PopulatedUserRef[] } & { completions: { user: mongoose.Types.ObjectId; done: boolean }[] })[]) {
        for (const a of s.assignees) usernameById.set(String(a._id), a.username);
      }

      const parentAssigneeIds = (t.assignees as PopulatedUserRef[]).map((a) => a._id);
      const stateByUser = new Map<string, AssigneeState>();
      for (const as of t.assigneeStates ?? []) stateByUser.set(String(as.user), as.state as AssigneeState);

      return {
        id: String(t._id),
        title: t.title,
        description: t.description ?? "",
        status: t.status,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        commentCount: (t.comments ?? []).length,
        visibleToTeam: t.visibleToTeam ?? null,
        requireApproval: t.requireApproval ?? null,
        effectiveVisible,
        effectiveApproval,
        assigner: { id: String(t.assigner._id), username: t.assigner.username },
        assignees: (t.assignees as PopulatedUserRef[]).map((a) => ({
          id: String(a._id),
          username: a.username,
          state: stateByUser.get(String(a._id)) ?? "pending",
        })),
        myState: stateByUser.get(userId) ?? null,
        subtasks: (t.subtasks ?? []).map((s) => {
          const subAssignees = (s.assignees as PopulatedUserRef[]).map((a) => ({
            id: String(a._id),
            username: a.username,
          }));
          const effective =
            subAssignees.length > 0
              ? subAssignees
              : parentAssigneeIds.map((pid) => ({
                  id: String(pid),
                  username: usernameById.get(String(pid)) ?? "",
                }));
          const completedSet = new Set(
            (s.completions ?? []).filter((c) => c.done).map((c) => String(c.user))
          );
          return {
            id: String(s._id),
            title: s.title,
            assignees: subAssignees,
            effectiveAssignees: effective,
            completedBy: Array.from(completedSet),
            myDone: completedSet.has(userId),
            iAmAssigned: effective.some((e) => e.id === userId),
            fullyDone: effective.length > 0 && effective.every((e) => completedSet.has(e.id)),
          };
        }),
        createdAt: t.createdAt,
      };
    }),
  });
}

export async function POST(req: Request, { params }: { params: { teamId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mongoose.isValidObjectId(params.teamId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  await dbConnect();
  const team = await Team.findById(params.teamId);
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const uid = new mongoose.Types.ObjectId(userId);
  if (!team.manager.equals(uid)) {
    return NextResponse.json({ error: "Only manager can assign tasks" }, { status: 403 });
  }

  // Parent assignees
  const assigneeOids: mongoose.Types.ObjectId[] = [];
  const seenParent = new Set<string>();
  for (const aId of parsed.data.assigneeIds) {
    if (!mongoose.isValidObjectId(aId)) {
      return NextResponse.json({ error: "Invalid assignee id" }, { status: 400 });
    }
    if (seenParent.has(aId)) continue;
    seenParent.add(aId);
    const oid = new mongoose.Types.ObjectId(aId);
    if (!team.members.some((m) => m.equals(oid))) {
      return NextResponse.json({ error: "An assignee is not a team member" }, { status: 400 });
    }
    assigneeOids.push(oid);
  }

  // Subtasks — assignees must be a subset of the task's parent assignees,
  // otherwise the parent task could roll up to "completed" while a subtask
  // assignee outside the task hasn't ticked.
  const subDocs: { title: string; assignees: mongoose.Types.ObjectId[]; completions: never[] }[] = [];
  const parentAssigneeSet = new Set(assigneeOids.map((a) => a.toString()));
  for (const s of parsed.data.subtasks ?? []) {
    const subAssignees: mongoose.Types.ObjectId[] = [];
    const seenSub = new Set<string>();
    for (const sid of s.assigneeIds ?? []) {
      if (!sid) continue;
      if (!mongoose.isValidObjectId(sid)) {
        return NextResponse.json({ error: "Invalid subtask assignee" }, { status: 400 });
      }
      if (seenSub.has(sid)) continue;
      seenSub.add(sid);
      if (!parentAssigneeSet.has(sid)) {
        return NextResponse.json(
          { error: "Subtask assignees must also be task assignees" },
          { status: 400 }
        );
      }
      subAssignees.push(new mongoose.Types.ObjectId(sid));
    }
    subDocs.push({ title: s.title.trim(), assignees: subAssignees, completions: [] });
  }

  const task = await Task.create({
    team: team._id,
    assigner: uid,
    assignees: assigneeOids,
    assigneeStates: assigneeOids.map((u) => ({ user: u, state: "pending" })),
    title: parsed.data.title.trim(),
    description: parsed.data.description?.trim() ?? "",
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    visibleToTeam: parsed.data.visibleToTeam ?? null,
    requireApproval: parsed.data.requireApproval ?? null,
    subtasks: subDocs,
    status: "pending",
  });

  const assigner = await User.findById(uid).lean();
  const assignerName = assigner?.name ?? "Someone";
  await Promise.all(
    assigneeOids.map((a) =>
      createNotification({
        recipient: a,
        actor: uid,
        type: "task_assigned",
        teamId: team._id,
        taskId: task._id,
        text: `${assignerName} assigned you "${task.title}"`,
        url: `/teams/${team._id}`,
      })
    )
  );

  return NextResponse.json({ id: String(task._id) }, { status: 201 });
}
