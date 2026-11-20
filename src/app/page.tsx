import { AuthScreen } from "@/components/auth-screen";
import { Dashboard } from "@/components/dashboard";
import { getCurrentUser, hasAdmin } from "@/lib/auth";
import { getConsoleData } from "@/lib/data";
import { getDemoData } from "@/lib/demo";
import type { TabKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const tabs: TabKey[] = ["overview", "streams", "library", "subscribers", "nodes", "activity", "settings"];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const initialized = await hasAdmin();
  const user = initialized ? await getCurrentUser() : null;
  if (initialized && !user) return <AuthScreen />;

  const params = await searchParams;
  const initialTab: TabKey = tabs.includes(params.tab as TabKey) ? params.tab as TabKey : "overview";
  const data = user ? await getConsoleData({ name: user.name, email: user.email }) : getDemoData();
  return <Dashboard initialData={data} initialTab={initialTab} />;
}
