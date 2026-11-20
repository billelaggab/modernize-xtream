import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { clearFailedLogin, isSameOrigin, loginAllowed, recordFailedLogin, startSession, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.email(), password: z.string().min(1) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "طلب غير مسموح" }, { status: 403 });
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!loginAllowed(ip)) return Response.json({ error: "محاولات كثيرة. حاول مرة أخرى بعد عشر دقائق." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "أدخل البريد وكلمة المرور" }, { status: 400 });
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, parsed.data.email.trim().toLowerCase())).limit(1);
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    recordFailedLogin(ip);
    return Response.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, { status: 401 });
  }
  clearFailedLogin(ip);
  await startSession(user.id);
  return Response.json({ ok: true });
}
