import type { ConsoleData } from "./types";

export function getDemoData(): ConsoleData {
  const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
  return {
    demo: true,
    viewer: null,
    categories: [
      { id: 1, name: "أخبار", color: "#6475ef", createdAt: ago(180) },
      { id: 2, name: "رياضة", color: "#20b899", createdAt: ago(180) },
      { id: 3, name: "وثائقي", color: "#f2a754", createdAt: ago(180) },
      { id: 4, name: "ترفيه", color: "#a77aec", createdAt: ago(180) },
      { id: 5, name: "أطفال", color: "#ef8293", createdAt: ago(180) },
    ],
    nodes: [
      { id: 1, name: "الخادم الرئيسي", address: "http://agent:9000", region: "الشرق الأوسط", role: "origin", status: "online", lastSeenAt: ago(0.01), createdAt: ago(165) },
      { id: 2, name: "خادم التوزيع 01", address: "http://edge-01:9000", region: "أوروبا", role: "edge", status: "online", lastSeenAt: ago(0.03), createdAt: ago(110) },
      { id: 3, name: "خادم التوزيع 02", address: "http://edge-02:9000", region: "آسيا", role: "edge", status: "offline", lastSeenAt: ago(22), createdAt: ago(60) },
    ],
    streams: [
      { id: 101, name: "الأخبار الآن", sourceUrl: "", logoUrl: null, kind: "live", categoryId: 1, nodeId: 1, enabled: 1, health: "online", createdAt: ago(2) },
      { id: 102, name: "الملاعب HD", sourceUrl: "", logoUrl: null, kind: "live", categoryId: 2, nodeId: 1, enabled: 1, health: "online", createdAt: ago(5) },
      { id: 103, name: "عالم الطبيعة", sourceUrl: "", logoUrl: null, kind: "live", categoryId: 3, nodeId: 2, enabled: 1, health: "online", createdAt: ago(16) },
      { id: 104, name: "مساحة الأطفال", sourceUrl: "", logoUrl: null, kind: "live", categoryId: 5, nodeId: 2, enabled: 1, health: "online", createdAt: ago(25) },
      { id: 105, name: "حوارات اليوم", sourceUrl: "", logoUrl: null, kind: "live", categoryId: 1, nodeId: 3, enabled: 1, health: "offline", createdAt: ago(40) },
      { id: 106, name: "رحلة إلى القمر", sourceUrl: "", logoUrl: null, kind: "vod", categoryId: 3, nodeId: 1, enabled: 1, health: "online", createdAt: ago(28) },
      { id: 107, name: "خلف الكواليس", sourceUrl: "", logoUrl: null, kind: "vod", categoryId: 4, nodeId: 1, enabled: 0, health: "pending", createdAt: ago(72) },
    ],
    subscribers: [
      { id: 1, name: "أحمد محمود", username: "ahmad_m", status: "active", expiresAt: ago(-24 * 35), playlistHits: 142, createdAt: ago(120) },
      { id: 2, name: "سارة خالد", username: "sara_k", status: "active", expiresAt: ago(-24 * 60), playlistHits: 86, createdAt: ago(90) },
      { id: 3, name: "محمد علي", username: "mohamed_a", status: "active", expiresAt: ago(-24 * 20), playlistHits: 48, createdAt: ago(70) },
      { id: 4, name: "ليلى إبراهيم", username: "laila_i", status: "paused", expiresAt: ago(-24 * 12), playlistHits: 19, createdAt: ago(55) },
    ],
    activity: [
      { id: 1, action: "stream", message: "تمت إضافة قناة الأخبار الآن", actor: "مدير النظام", createdAt: ago(0.4) },
      { id: 2, action: "node", message: "اتصل الخادم الرئيسي بنجاح", actor: "النظام", createdAt: ago(1.2) },
      { id: 3, action: "subscriber", message: "تم إنشاء اشتراك جديد لسارة خالد", actor: "مدير النظام", createdAt: ago(3) },
      { id: 4, action: "stream", message: "أصبح بث الملاعب HD متاحًا", actor: "النظام", createdAt: ago(6) },
      { id: 5, action: "node", message: "انقطع اتصال خادم التوزيع 02", actor: "النظام", createdAt: ago(22) },
      { id: 6, action: "stream", message: "تمت إضافة رحلة إلى القمر", actor: "مدير النظام", createdAt: ago(28) },
      { id: 7, action: "subscriber", message: "تم تحديث اشتراك أحمد محمود", actor: "مدير النظام", createdAt: ago(45) },
      { id: 8, action: "stream", message: "تم تحديث مصدر بث عالم الطبيعة", actor: "مدير النظام", createdAt: ago(53) },
      { id: 9, action: "subscriber", message: "تم إنشاء اشتراك محمد علي", actor: "مدير النظام", createdAt: ago(76) },
      { id: 10, action: "node", message: "تم ربط خادم التوزيع 01", actor: "مدير النظام", createdAt: ago(103) },
      { id: 11, action: "stream", message: "تمت إضافة مساحة الأطفال", actor: "مدير النظام", createdAt: ago(129) },
      { id: 12, action: "security", message: "تم إنشاء مساحة العمل", actor: "مدير النظام", createdAt: ago(155) },
    ],
  };
}
