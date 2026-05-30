import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireUserId } from "@/lib/session";
import { Team } from "@/models/Team";
import { createNotification } from "@/lib/notifications";

const actionSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

export async function POST(req: Request, { params }: { params: { teamId: string } }) {
  const managerId = await requireUserId();
  if (!managerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mongoose.isValidObjectId(params.teamId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (!mongoose.isValidObjectId(parsed.data.userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  await dbConnect();
  const team = await Team.findById(params.teamId);
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!team.manager.equals(new mongoose.Types.ObjectId(managerId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requesterId = new mongoose.Types.ObjectId(parsed.data.userId);
  const pendingIdx = team.pendingRequests.findIndex((id) => id.equals(requesterId));
  if (pendingIdx === -1) {
    return NextResponse.json({ error: "No pending request from that user" }, { status: 404 });
  }

  team.pendingRequests.splice(pendingIdx, 1);
  if (parsed.data.action === "approve" && !team.members.some((m) => m.equals(requesterId))) {
    team.members.push(requesterId);
  }
  await team.save();
  await createNotification({
    recipient: requesterId,
    actor: new mongoose.Types.ObjectId(managerId),
    type: parsed.data.action === "approve" ? "join_approved" : "join_rejected",
    teamId: team._id,
    text:
      parsed.data.action === "approve"
        ? `You're in: ${team.name}`
        : `Your request to join ${team.name} was rejected`,
    url: parsed.data.action === "approve" ? `/teams/${team._id}` : "/dashboard",
  });
  return NextResponse.json({ ok: true });
}
