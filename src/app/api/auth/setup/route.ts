import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, adminUsers } from "@/db/schema";
import { hashPassword, hashToken, isSameOrigin, startSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(255).transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(200),
  setupKey: z.string().optional(),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "طلب غير مسموح" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "تأكد من الاسم والبريد وكلمة مرور من 12 حرفًا على الأقل" }, { status: 400 });
  const requiredKey = process.env.SETUP_KEY;
  if (requiredKey) {
    const actual = hashToken(parsed.data.setupKey ?? "");
    if (!timingSafeEqual(Buffer.from(hashToken(requiredKey), "hex"), Buffer.from(actual, "hex"))) {
      return Response.json({ error: "رمز التهيئة غير صحيح؛ يُقارن مع القيمة المضبوطة في بيئة التشغيل. على الخادم تجده في deploy/.env (سطر SETUP_KEY)، وفي هذه المعاينة ضمن إعدادات بيئة الجلسة." }, { status: 403 });
    }
  }
  try {
    const user = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(72839153)`);
      const existing = await tx.select({ id: adminUsers.id }).from(adminUsers).limit(1);
      if (existing.length) return null;
      const [created] = await tx.insert(adminUsers).values({
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: hashPassword(parsed.data.password),
      }).returning({ id: adminUsers.id });
      await tx.insert(activityLogs).values({ action: "security", message: "تم إنشاء مساحة العمل وحساب المدير", actor: parsed.data.name });
      return created;
    });
    if (!user) return Response.json({ error: "تمت تهيئة اللوحة مسبقًا" }, { status: 409 });
    await startSession(user.id);
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "تعذر إتمام التهيئة. تحقق من اتصال قاعدة البيانات." }, { status: 500 });
  }
}
