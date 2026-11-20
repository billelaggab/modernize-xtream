import { endSession, isSameOrigin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "طلب غير مسموح" }, { status: 403 });
  await endSession();
  return Response.json({ ok: true });
}
