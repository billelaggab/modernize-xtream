import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityLogs, nodes, streams } from "@/db/schema";
import { isAgentAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  nodeId: z.number().int().positive(),
  streams: z.array(z.object({ id: z.number().int().positive(), health: z.enum(["online", "pending", "offline", "error"]) })).max(1000),
});

export async function POST(request: Request) {
  if (!isAgentAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid heartbeat" }, { status: 400 });
  const [existing] = await db.select().from(nodes).where(eq(nodes.id, parsed.data.nodeId)).limit(1);
  if (!existing) return Response.json({ error: "Node not found" }, { status: 404 });
  const wasOffline = !existing.lastSeenAt || Date.now() - existing.lastSeenAt.getTime() > 60_000;
  await db.update(nodes).set({ status: "online", lastSeenAt: new Date() }).where(eq(nodes.id, parsed.data.nodeId));
  if (wasOffline) await db.insert(activityLogs).values({ action: "node", message: `اتصل الخادم ${existing.name}`, actor: "وكيل البث" });
  await Promise.all(parsed.data.streams.map(({ id, health }) =>
    db.update(streams).set({ health }).where(and(eq(streams.id, id), eq(streams.nodeId, parsed.data.nodeId), eq(streams.enabled, 1)))
  ));
  return Response.json({ ok: true });
}
