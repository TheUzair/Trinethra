import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
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
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always respond identically to avoid email enumeration.
  let resetUrl: string | null = null;

  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const origin = req.headers.get("origin") ?? "";
    resetUrl = `${origin}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
    // In production, send an email. For this assignment we return the link in
    // dev so the intern can test the flow without an SMTP setup.
    if (process.env.NODE_ENV === "production") {
      console.log("[password-reset] would send email to", user.email);
    } else {
      console.log("[password-reset] dev link:", resetUrl);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If that email is registered, a reset link has been sent.",
    devResetUrl: process.env.NODE_ENV === "production" ? undefined : resetUrl,
  });
}
