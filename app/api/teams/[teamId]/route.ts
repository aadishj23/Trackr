import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireUserId } from "@/lib/session";
import { Team } from "@/models/Team";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

const patchSchema = z
  .object({
    name: z.string().min(2).max(60).optional(),
    defaultTasksVisible: z.boolean().optional(),
    defaultRequireApproval: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Nothing to update" });

export async function GET(_req: Request, { params }: { params: { teamId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mongoose.isValidObjectId(params.teamId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }
  await dbConnect();
  const team = await Team.findById(params.teamId)
    .populate<{ members: { _id: mongoose.Types.ObjectId; username: string; email: string }[] }>(
      "members",
      "username email"
    )
    .populate<{ pendingRequests: { _id: mongoose.Types.ObjectId; username: string; email: string }[] }>(
      "pendingRequests",
      "username email"
    )
    .populate<{ manager: { _id: mongoose.Types.ObjectId; username: string; email: string } }>(
      "manager",
      "username email"
    )
    .lean();
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const uid = new mongoose.Types.ObjectId(userId);
  const isManager = team.manager._id.equals(uid);
  const isMember = team.members.some((m) => m._id.equals(uid));
  if (!isManager && !isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: String(team._id),
    name: team.name,
    code: team.code,
    role: isManager ? "manager" : "reportee",
    manager: { id: String(team.manager._id), username: team.manager.username },
    members: team.members.map((m) => ({ id: String(m._id), username: m.username, email: m.email })),
    pendingRequests: isManager
      ? team.pendingRequests.map((m) => ({ id: String(m._id), username: m.username, email: m.email }))
      : [],
    defaultTasksVisible: team.defaultTasksVisible !== false,
    defaultRequireApproval: team.defaultRequireApproval === true,
  });
}

export async function PATCH(req: Request, { params }: { params: { teamId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mongoose.isValidObjectId(params.teamId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  await dbConnect();
  const team = await Team.findById(params.teamId);
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!team.manager.equals(new mongoose.Types.ObjectId(userId))) {
    return NextResponse.json({ error: "Only manager can edit" }, { status: 403 });
  }
  if (parsed.data.name !== undefined) team.name = parsed.data.name.trim();
  if (parsed.data.defaultTasksVisible !== undefined) team.defaultTasksVisible = parsed.data.defaultTasksVisible;
  if (parsed.data.defaultRequireApproval !== undefined) team.defaultRequireApproval = parsed.data.defaultRequireApproval;
  await team.save();
  return NextResponse.json({
    ok: true,
    name: team.name,
    defaultTasksVisible: team.defaultTasksVisible,
    defaultRequireApproval: team.defaultRequireApproval,
  });
}

export async function DELETE(_req: Request, { params }: { params: { teamId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mongoose.isValidObjectId(params.teamId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }
  await dbConnect();
  const team = await Team.findById(params.teamId);
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!team.manager.equals(new mongoose.Types.ObjectId(userId))) {
    return NextResponse.json({ error: "Only manager can delete" }, { status: 403 });
  }
  await Task.deleteMany({ team: team._id });
  await team.deleteOne();
  return NextResponse.json({ ok: true });
}
