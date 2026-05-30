import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireUserId } from "@/lib/session";
import { Team } from "@/models/Team";

const createSchema = z.object({
  name: z.string().min(2).max(60),
});

async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exists = await Team.exists({ code });
    if (!exists) return code;
  }
  throw new Error("Could not generate unique team code");
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const [managing, joined] = await Promise.all([
    Team.find({ manager: userId }).sort({ createdAt: -1 }).lean(),
    Team.find({ members: userId, manager: { $ne: userId } }).sort({ createdAt: -1 }).lean(),
  ]);
  return NextResponse.json({
    managing: managing.map((t) => ({
      id: String(t._id),
      name: t.name,
      code: t.code,
      memberCount: t.members.length,
      pendingCount: t.pendingRequests.length,
    })),
    joined: joined.map((t) => ({
      id: String(t._id),
      name: t.name,
      code: t.code,
      memberCount: t.members.length,
    })),
  });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  await dbConnect();
  const code = await generateUniqueCode();
  const team = await Team.create({
    name: parsed.data.name.trim(),
    code,
    manager: userId,
    members: [userId],
    pendingRequests: [],
  });
  return NextResponse.json({ id: String(team._id), name: team.name, code: team.code }, { status: 201 });
}
