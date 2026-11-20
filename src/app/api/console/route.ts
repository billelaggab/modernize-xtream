import { getCurrentUser } from "@/lib/auth";
import { getConsoleData } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "يلزم تسجيل الدخول" }, { status: 401 });
  return Response.json(await getConsoleData({ name: user.name, email: user.email }), {
    headers: { "Cache-Control": "no-store" },
  });
}
