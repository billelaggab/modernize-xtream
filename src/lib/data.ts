import { desc } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, categories, nodes, streams, subscribers } from "@/db/schema";
import type { ConsoleData } from "./types";

export async function getConsoleData(viewer: { name: string; email: string }): Promise<ConsoleData> {
  const [streamRows, categoryRows, nodeRows, subscriberRows, activityRows] = await Promise.all([
    db.select().from(streams).orderBy(desc(streams.createdAt)).limit(500),
    db.select().from(categories).orderBy(categories.id),
    db.select().from(nodes).orderBy(nodes.id),
    db.select({ id: subscribers.id, name: subscribers.name, username: subscribers.username, status: subscribers.status, expiresAt: subscribers.expiresAt, playlistHits: subscribers.playlistHits, createdAt: subscribers.createdAt }).from(subscribers).orderBy(desc(subscribers.createdAt)).limit(500),
    db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(100),
  ]);
  return {
    demo: false,
    viewer,
    streams: streamRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    categories: categoryRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    nodes: nodeRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), lastSeenAt: row.lastSeenAt?.toISOString() ?? null })),
    subscribers: subscriberRows.map((row) => ({ ...row, expiresAt: row.expiresAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString() })),
    activity: activityRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
  };
}
