import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { hashToken } from "./auth";

export async function getActiveSubscriber(token: string | null) {
  if (!token || token.length < 32 || token.length > 128) return null;
  const [subscriber] = await db.select({ id: subscribers.id, username: subscribers.username })
    .from(subscribers)
    .where(and(
      eq(subscribers.tokenHash, hashToken(token)),
      eq(subscribers.status, "active"),
      or(isNull(subscribers.expiresAt), gt(subscribers.expiresAt, new Date())),
    )).limit(1);
  return subscriber ?? null;
}
