import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, adminUsers, categories, nodes, streams, subscribers } from "@/db/schema";
import { createAccessToken, getCurrentUser, hashPassword, hashToken, isSameOrigin, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  resource: z.enum(["stream", "node", "subscriber", "category", "account"]),
  action: z.enum(["create", "update", "delete", "toggle", "regenerate"]),
  id: z.number().int().positive().optional(),
  data: z.unknown().optional(),
});
const httpUrl = z.url().max(2000).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "استخدم رابط HTTP أو HTTPS");
const streamSchema = z.object({
  name: z.string().trim().min(2).max(150),
  sourceUrl: httpUrl,
  logoUrl: z.union([httpUrl, z.literal("")]).optional(),
  kind: z.enum(["live", "vod"]),
  categoryId: z.number().int().positive().nullable(),
  nodeId: z.number().int().positive().nullable(),
});
const nodeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: httpUrl.refine((value) => !new URL(value).username && !new URL(value).password, "لا تضع بيانات اعتماد في الرابط"),
  region: z.string().trim().min(2).max(100),
  role: z.enum(["origin", "edge"]),
});
const subscriberSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/, "اسم المستخدم يجب أن يكون بحروف إنجليزية أو أرقام"),
  expiresAt: z.union([z.iso.datetime(), z.null()]).optional(),
});
const categorySchema = z.object({ name: z.string().trim().min(2).max(100), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
const accountSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(200) });

function fail(error: string, status = 400) { return Response.json({ error }, { status }); }

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail("طلب غير مسموح", 403);
  const user = await getCurrentUser();
  if (!user) return fail("يلزم تسجيل الدخول", 401);
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("طلب غير صالح");
  const { resource, action, id, data } = input.data;
  if (action !== "create" && !id && resource !== "account") return fail("المعرّف مطلوب");
  const log = (message: string, type: string = resource) => db.insert(activityLogs).values({ action: type, message, actor: user.name });

  try {
    if (resource === "stream") {
      if (action === "create" || action === "update") {
        const parsed = streamSchema.safeParse(data);
        if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "بيانات القناة غير صالحة");
        const values = { ...parsed.data, logoUrl: parsed.data.logoUrl || null, health: "pending" };
        if (action === "create") {
          const [row] = await db.insert(streams).values(values).returning({ id: streams.id });
          await log(`تمت إضافة ${parsed.data.kind === "vod" ? "فيديو" : "قناة"} ${parsed.data.name}`);
          return Response.json({ ok: true, id: row.id });
        }
        const [row] = await db.update(streams).set(values).where(eq(streams.id, id!)).returning({ id: streams.id });
        if (!row) return fail("العنصر غير موجود", 404);
        await log(`تم تحديث ${parsed.data.name}`);
        return Response.json({ ok: true });
      }
      if (action === "toggle") {
        const [current] = await db.select().from(streams).where(eq(streams.id, id!)).limit(1);
        if (!current) return fail("القناة غير موجودة", 404);
        await db.update(streams).set({ enabled: current.enabled ? 0 : 1, health: current.enabled ? "paused" : "pending" }).where(eq(streams.id, id!));
        await log(`${current.enabled ? "تم إيقاف" : "تم تشغيل"} ${current.name}`);
        return Response.json({ ok: true });
      }
      if (action === "delete") {
        const [row] = await db.delete(streams).where(eq(streams.id, id!)).returning({ name: streams.name });
        if (!row) return fail("القناة غير موجودة", 404);
        await log(`تم حذف ${row.name}`);
        return Response.json({ ok: true });
      }
    }

    if (resource === "node") {
      if (action === "create" || action === "update") {
        const parsed = nodeSchema.safeParse(data);
        if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "بيانات الخادم غير صالحة");
        if (action === "create") {
          const [row] = await db.insert(nodes).values(parsed.data).returning({ id: nodes.id });
          await log(`تمت إضافة الخادم ${parsed.data.name}`);
          return Response.json({ ok: true, id: row.id });
        }
        const [row] = await db.update(nodes).set(parsed.data).where(eq(nodes.id, id!)).returning({ id: nodes.id });
        if (!row) return fail("الخادم غير موجود", 404);
        await log(`تم تحديث الخادم ${parsed.data.name}`);
        return Response.json({ ok: true });
      }
      if (action === "delete") {
        await db.update(streams).set({ health: "pending" }).where(eq(streams.nodeId, id!));
        const [row] = await db.delete(nodes).where(eq(nodes.id, id!)).returning({ name: nodes.name });
        if (!row) return fail("الخادم غير موجود", 404);
        await log(`تم حذف الخادم ${row.name}`);
        return Response.json({ ok: true });
      }
    }

    if (resource === "subscriber") {
      if (action === "create") {
        const parsed = subscriberSchema.safeParse(data);
        if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "بيانات المشترك غير صالحة");
        const accessToken = createAccessToken();
        const [row] = await db.insert(subscribers).values({
          name: parsed.data.name, username: parsed.data.username,
          tokenHash: hashToken(accessToken),
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        }).returning({ id: subscribers.id });
        await log(`تم إنشاء اشتراك ${parsed.data.name}`);
        return Response.json({ ok: true, id: row.id, accessToken });
      }
      if (action === "update") {
        const parsed = subscriberSchema.safeParse(data);
        if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "بيانات المشترك غير صالحة");
        const [row] = await db.update(subscribers).set({ ...parsed.data, expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null }).where(eq(subscribers.id, id!)).returning({ id: subscribers.id });
        if (!row) return fail("المشترك غير موجود", 404);
        await log(`تم تحديث اشتراك ${parsed.data.name}`);
        return Response.json({ ok: true });
      }
      if (action === "toggle") {
        const [current] = await db.select().from(subscribers).where(eq(subscribers.id, id!)).limit(1);
        if (!current) return fail("المشترك غير موجود", 404);
        await db.update(subscribers).set({ status: current.status === "active" ? "paused" : "active" }).where(eq(subscribers.id, id!));
        await log(`${current.status === "active" ? "تم إيقاف" : "تم تفعيل"} اشتراك ${current.name}`);
        return Response.json({ ok: true });
      }
      if (action === "regenerate") {
        const accessToken = createAccessToken();
        const [row] = await db.update(subscribers).set({ tokenHash: hashToken(accessToken) }).where(eq(subscribers.id, id!)).returning({ name: subscribers.name });
        if (!row) return fail("المشترك غير موجود", 404);
        await log(`تم تجديد رابط اشتراك ${row.name}`);
        return Response.json({ ok: true, accessToken });
      }
      if (action === "delete") {
        const [row] = await db.delete(subscribers).where(eq(subscribers.id, id!)).returning({ name: subscribers.name });
        if (!row) return fail("المشترك غير موجود", 404);
        await log(`تم حذف اشتراك ${row.name}`);
        return Response.json({ ok: true });
      }
    }

    if (resource === "category") {
      if (action === "create" || action === "update") {
        const parsed = categorySchema.safeParse(data);
        if (!parsed.success) return fail("أدخل اسم التصنيف ولونًا صالحًا");
        if (action === "create") {
          const [row] = await db.insert(categories).values(parsed.data).returning({ id: categories.id });
          await log(`تمت إضافة تصنيف ${parsed.data.name}`);
          return Response.json({ ok: true, id: row.id });
        }
        const [row] = await db.update(categories).set(parsed.data).where(eq(categories.id, id!)).returning({ id: categories.id });
        if (!row) return fail("التصنيف غير موجود", 404);
        await log(`تم تحديث تصنيف ${parsed.data.name}`);
        return Response.json({ ok: true });
      }
      if (action === "delete") {
        const [row] = await db.delete(categories).where(eq(categories.id, id!)).returning({ name: categories.name });
        if (!row) return fail("التصنيف غير موجود", 404);
        await log(`تم حذف تصنيف ${row.name}`);
        return Response.json({ ok: true });
      }
    }

    if (resource === "account" && action === "update") {
      const parsed = accountSchema.safeParse(data);
      if (!parsed.success) return fail("كلمة المرور الجديدة يجب أن تتكون من 12 حرفًا على الأقل");
      const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, user.id)).limit(1);
      if (!admin || !verifyPassword(parsed.data.currentPassword, admin.passwordHash)) return fail("كلمة المرور الحالية غير صحيحة", 403);
      await db.update(adminUsers).set({ passwordHash: hashPassword(parsed.data.newPassword) }).where(eq(adminUsers.id, user.id));
      await log("تم تغيير كلمة مرور المدير", "security");
      return Response.json({ ok: true });
    }
    return fail("عملية غير مدعومة");
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") return fail("اسم المستخدم أو البريد مُستخدم مسبقًا", 409);
    if (pgError.code === "23503") return fail("التصنيف أو الخادم المحدد غير موجود", 400);
    console.error("Manage operation failed:", error);
    return fail("تعذر حفظ التغييرات. حاول مرة أخرى.", 500);
  }
}
