import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";
import { requireUserId } from "@/lib/session";
import { Team } from "@/models/Team";
import { User } from "@/models/User";
import { createNotification } from "@/lib/notifications";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid code" }, { status: 400 });
  }
  await dbConnect();
  const team = await Team.findOne({ code: parsed.data.code });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const uid = new mongoose.Types.ObjectId(userId);
  if (team.manager.equals(uid)) {
    return NextResponse.json({ error: "You are the manager of this team" }, { status: 400 });
  }
  if (team.members.some((m) => m.equals(uid))) {
    return NextResponse.json({ error: "Already a member" }, { status: 400 });
  }
  if (team.pendingRequests.some((m) => m.equals(uid))) {
    return NextResponse.json({ ok: true, status: "already_pending" });
  }
  team.pendingRequests.push(uid);
  await team.save();
  const requester = await User.findById(uid).lean();
  await createNotification({
    recipient: team.manager,
    actor: uid,
    type: "join_request",
    teamId: team._id,
    text: `${requester?.name ?? "Someone"} wants to join ${team.name}`,
    url: `/teams/${team._id}`,
  });
  return NextResponse.json({ ok: true, status: "pending", teamName: team.name });
}
