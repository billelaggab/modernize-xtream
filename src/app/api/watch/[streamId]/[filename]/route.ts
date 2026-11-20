import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { nodes, streams } from "@/db/schema";
import { getActiveSubscriber } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ streamId: string; filename: string }> }) {
  const { streamId, filename } = await context.params;
  const id = Number(streamId);
  if (!Number.isSafeInteger(id) || id < 1 || !/^(index\.m3u8|segment_[0-9]+\.ts)$/.test(filename)) {
    return new Response("Not found", { status: 404 });
  }
  const token = new URL(request.url).searchParams.get("token");
  const subscriber = await getActiveSubscriber(token);
  if (!subscriber) return new Response("Invalid or expired subscription", { status: 401 });
  const [item] = await db.select({ address: nodes.address }).from(streams)
    .innerJoin(nodes, eq(streams.nodeId, nodes.id))
    .where(and(eq(streams.id, id), eq(streams.enabled, 1))).limit(1);
  if (!item || !process.env.AGENT_TOKEN) return new Response("Stream unavailable", { status: 503 });

  try {
    const agentUrl = new URL(`/hls/${id}/${filename}`, item.address).toString();
    const upstream = await fetch(agentUrl, {
      headers: { Authorization: `Bearer ${process.env.AGENT_TOKEN}` },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!upstream.ok) return new Response("Stream unavailable", { status: upstream.status === 404 ? 404 : 502 });
    const headers = {
      "Content-Type": filename.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t",
      "Cache-Control": filename.endsWith(".m3u8") ? "no-store, private" : "private, max-age=15",
      "Access-Control-Allow-Origin": "*",
    };
    if (filename.endsWith(".m3u8")) {
      const playlist = await upstream.text();
      const rewritten = playlist.split("\n").map((line) => {
        const segment = line.trim();
        if (!/^segment_[0-9]+\.ts$/.test(segment)) return line;
        return `/api/watch/${id}/${segment}?token=${encodeURIComponent(token!)}`;
      }).join("\n");
      return new Response(rewritten, { headers });
    }
    return new Response(upstream.body, { headers });
  } catch {
    return new Response("Agent unreachable", { status: 502 });
  }
}
