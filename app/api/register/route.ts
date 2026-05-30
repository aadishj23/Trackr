import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/models/User";
import { isPasswordStrong } from "@/lib/password";

const schema = z
  .object({
    name: z.string().min(1, "Name is required").max(80),
    email: z.string().email(),
    username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, . _ -"),
    password: z.string().refine(isPasswordStrong, {
      message: "Password must be 8+ chars and include upper, lower, number, and special character",
    }),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  await dbConnect();
  const { name, email, username, password } = parsed.data;

  const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
  if (existing) {
    const which = existing.email === email.toLowerCase() ? "Email" : "Username";
    return NextResponse.json({ error: `${which} already in use` }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ name: name.trim(), email: email.toLowerCase(), username, passwordHash });

  return NextResponse.json({ ok: true }, { status: 201 });
}
