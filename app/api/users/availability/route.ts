import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/models/User";

const USERNAME_RE = /^[a-zA-Z0-9_.-]+$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const username = (url.searchParams.get("username") ?? "").trim();
  if (username.length < 3 || username.length > 32 || !USERNAME_RE.test(username)) {
    return NextResponse.json({ available: false, reason: "invalid" });
  }
  await dbConnect();
  const exists = await User.exists({ username });
  return NextResponse.json({ available: !exists, reason: exists ? "taken" : "ok" });
}
