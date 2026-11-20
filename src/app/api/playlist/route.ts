import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, nodes, streams, subscribers } from "@/db/schema";
import { getActiveSubscriber } from "@/lib/access";

export const dynamic = "force-dynamic";

const safe = (value: string) => value.replace(/[\r\n"]/g, " ").trim();

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const subscriber = await getActiveSubscriber(token);
  if (!subscriber) return new Response("Invalid or expired subscription", { status: 401 });
  const assigned = await db.select({ id: streams.id, name: streams.name, kind: streams.kind, logoUrl: streams.logoUrl, category: categories.name })
    .from(streams)
    .innerJoin(nodes, eq(streams.nodeId, nodes.id))
    .leftJoin(categories, eq(streams.categoryId, categories.id))
    .where(and(eq(streams.enabled, 1)));
  const base = (process.env.PANEL_PUBLIC_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const lines = ["#EXTM3U"];
  for (const item of assigned) {
    lines.push(`#EXTINF:-1 tvg-id="${item.id}" tvg-name="${safe(item.name)}" tvg-logo="${safe(item.logoUrl ?? "")}" group-title="${safe(item.category ?? (item.kind === "vod" ? "مكتبة الفيديو" : "عام"))}",${safe(item.name)}`);
    lines.push(`${base}/api/watch/${item.id}/index.m3u8?token=${encodeURIComponent(token!)}`);
  }
  await db.update(subscribers).set({ playlistHits: sql`${subscribers.playlistHits} + 1` }).where(eq(subscribers.id, subscriber.id));
  return new Response(lines.join("\n") + "\n", { headers: {
    "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
    "Content-Disposition": "attachment; filename=madar-playlist.m3u",
    "Cache-Control": "no-store, private",
    "Access-Control-Allow-Origin": "*",
  } });
}
