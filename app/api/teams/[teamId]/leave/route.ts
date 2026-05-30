import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";
import { requireUserId } from "@/lib/session";
import { Team } from "@/models/Team";
import { Task } from "@/models/Task";

export async function POST(_req: Request, { params }: { params: { teamId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mongoose.isValidObjectId(params.teamId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }
  await dbConnect();
  const team = await Team.findById(params.teamId);
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const uid = new mongoose.Types.ObjectId(userId);
  if (team.manager.equals(uid)) {
    return NextResponse.json(
      { error: "Manager can't leave. Delete the team instead." },
      { status: 400 }
    );
  }
  const before = team.members.length;
  team.members = team.members.filter((m) => !m.equals(uid));
  if (team.members.length === before) {
    return NextResponse.json({ error: "Not a member" }, { status: 400 });
  }
  await team.save();
  await Task.deleteMany({ team: team._id, assignee: uid });
  return NextResponse.json({ ok: true });
}
