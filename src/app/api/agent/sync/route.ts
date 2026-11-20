import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { nodes, streams } from "@/db/schema";
import { isAgentAuthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAgentAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const nodeId = Number(new URL(request.url).searchParams.get("node_id"));
  if (!Number.isSafeInteger(nodeId) || nodeId < 1) return Response.json({ error: "Invalid node ID" }, { status: 400 });
  const [node] = await db.select({ id: nodes.id }).from(nodes).where(eq(nodes.id, nodeId)).limit(1);
  if (!node) return Response.json({ error: "Node not found. Add it in the panel first." }, { status: 404 });
  const assigned = await db.select({ id: streams.id, sourceUrl: streams.sourceUrl, kind: streams.kind })
    .from(streams).where(and(eq(streams.nodeId, nodeId), eq(streams.enabled, 1)));
  return Response.json({ nodeId, streams: assigned }, { headers: { "Cache-Control": "no-store" } });
}
