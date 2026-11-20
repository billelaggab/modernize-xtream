import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { adminSessions, adminUsers } from "@/db/schema";

const COOKIE_NAME = "madar_session";
const SESSION_DAYS = 14;

export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash || hash.length !== 128) return false;
    const actual = scryptSync(password, salt, 64);
    return timingSafeEqual(actual, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export function createAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function hasAdmin(): Promise<boolean> {
  const users = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
  return users.length > 0;
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await db.select({
    id: adminUsers.id,
    name: adminUsers.name,
    email: adminUsers.email,
  }).from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
    .where(and(eq(adminSessions.tokenHash, hashToken(token)), gt(adminSessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function startSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(adminSessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  const forwardedProto = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = forwardedProto ? forwardedProto === "https" : process.env.NODE_ENV === "production";
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await db.delete(adminSessions).where(eq(adminSessions.tokenHash, hashToken(token)));
  store.delete(COOKIE_NAME);
}

export function isAgentAuthorized(request: Request): boolean {
  const secret = process.env.AGENT_TOKEN;
  const authorization = request.headers.get("authorization");
  if (!secret || secret.length < 24 || !authorization?.startsWith("Bearer ")) return false;
  const provided = authorization.slice(7);
  return timingSafeEqual(Buffer.from(hashToken(provided), "hex"), Buffer.from(hashToken(secret), "hex"));
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const expected = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    return new URL(origin).host === expected;
  } catch {
    return false;
  }
}

const failedAttempts = new Map<string, { count: number; until: number }>();
export function loginAllowed(ip: string): boolean {
  const entry = failedAttempts.get(ip);
  if (!entry || Date.now() > entry.until) { failedAttempts.delete(ip); return true; }
  return entry.count < 10;
}
export function recordFailedLogin(ip: string) {
  const entry = failedAttempts.get(ip);
  failedAttempts.set(ip, { count: (entry && Date.now() < entry.until ? entry.count : 0) + 1, until: Date.now() + 10 * 60 * 1000 });
}
export function clearFailedLogin(ip: string) { failedAttempts.delete(ip); }
