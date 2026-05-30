import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireUserId } from "@/lib/session";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { Team } from "@/models/Team";
import { createNotification } from "@/lib/notifications";

const postSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function GET(
  _req: Request,
  { params }: { params: { teamId: string; taskId: string } }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mongoose.isValidObjectId(params.taskId) || !mongoose.isValidObjectId(params.teamId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await dbConnect();
  const task = await Task.findOne({ _id: params.taskId, team: params.teamId })
    .populate<{ comments: { _id: mongoose.Types.ObjectId; body: string; createdAt: Date; author: { _id: mongoose.Types.ObjectId; username: string; name: string } }[] }>(
      "comments.author",
      "username name"
    )
    .lean();
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    comments: (task.comments ?? []).map((c) => ({
      id: String(c._id),
      body: c.body,
      createdAt: c.createdAt,
      author: { id: String(c.author._id), username: c.author.username, name: c.author.name },
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: { teamId: string; taskId: string } }
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mongoose.isValidObjectId(params.taskId) || !mongoose.isValidObjectId(params.teamId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await dbConnect();
  const task = await Task.findOne({ _id: params.taskId, team: params.teamId });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const team = await Team.findById(task.team).lean();
  if (!team) return NextResponse.json({ error: "Team gone" }, { status: 404 });

  const uid = new mongoose.Types.ObjectId(userId);
  const isSubtaskAssignee = task.subtasks.some((s) => s.assignees.some((sa) => sa.equals(uid)));
  const allowed =
    task.assignees.some((a) => a.equals(uid)) ||
    task.assigner.equals(uid) ||
    team.manager.equals(uid) ||
    isSubtaskAssignee;
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  task.comments.push({ author: uid, body: parsed.data.body.trim() } as never);
  await task.save();

  const author = await User.findById(uid).lean();
  const recipientIds = new Set<string>();
  for (const a of task.assignees) recipientIds.add(a.toString());
  for (const s of task.subtasks) for (const sa of s.assignees) recipientIds.add(sa.toString());
  recipientIds.add(task.assigner.toString());
  recipientIds.delete(uid.toString());
  await Promise.all(
    Array.from(recipientIds).map((r) =>
      createNotification({
        recipient: r,
        actor: uid,
        type: "task_comment",
        teamId: task.team,
        taskId: task._id,
        text: `${author?.name ?? "Someone"} commented on "${task.title}"`,
        url: `/teams/${task.team}`,
      })
    )
  );

  const added = task.comments[task.comments.length - 1];
  return NextResponse.json(
    {
      comment: {
        id: String(added._id),
        body: added.body,
        createdAt: added.createdAt,
        author: { id: String(uid), username: author?.username, name: author?.name },
      },
    },
    { status: 201 }
  );
}
