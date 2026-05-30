import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { requireUserId } from "@/lib/session";
import { Notification } from "@/models/Notification";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const onlyCount = url.searchParams.get("count") === "1";

  await dbConnect();
  if (onlyCount) {
    const unread = await Notification.countDocuments({ recipient: userId, read: false });
    return NextResponse.json({ unread });
  }

  const items = await Notification.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const unread = items.filter((n) => !n.read).length;

  return NextResponse.json({
    unread,
    items: items.map((n) => ({
      id: String(n._id),
      type: n.type,
      text: n.text,
      url: n.url,
      read: n.read,
      createdAt: n.createdAt,
    })),
  });
}

export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ids: string[] | undefined = body.ids;
  await dbConnect();
  if (Array.isArray(ids) && ids.length > 0) {
    await Notification.updateMany(
      { _id: { $in: ids }, recipient: userId },
      { $set: { read: true } }
    );
  } else {
    await Notification.updateMany({ recipient: userId, read: false }, { $set: { read: true } });
  }
  return NextResponse.json({ ok: true });
}
