"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity, ArrowLeft, ArrowUpLeft, BarChart3, Bell, BookOpen, CalendarDays, Check,
  CheckCircle2, ChevronLeft, CircleHelp, Clapperboard, Clock3, Copy, ExternalLink,
  Film, FolderClosed, Globe2, HardDrive, Info, LayoutDashboard, Link2, LockKeyhole,
  LogOut, Menu, MoreHorizontal, Pause, Pencil, Play, Plus, Radio, RadioTower,
  RefreshCw, Search, Server, Settings2, ShieldCheck, Signal, Sparkles, Trash2,
  Tv2, UserRound, Users, Video, Waves, Wifi, WifiOff, X, Zap,
  type LucideIcon,
} from "lucide-react";
import type { ActivityRecord, CategoryRecord, ConsoleData, NodeRecord, StreamRecord, SubscriberRecord, TabKey } from "@/lib/types";
import { DashboardModal, type ModalConfig } from "./dashboard-modals";

type Resource = "stream" | "node" | "subscriber" | "category" | "account";
type Action = "create" | "update" | "delete" | "toggle" | "regenerate";
type ConfirmState = { resource: Resource; id: number; name: string };

const navPrimary: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { key: "streams", label: "القنوات المباشرة", icon: RadioTower },
  { key: "library", label: "مكتبة الفيديو", icon: Clapperboard },
  { key: "subscribers", label: "المشتركون", icon: Users },
];
const navSystem: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "nodes", label: "الخوادم", icon: Server },
  { key: "activity", label: "سجل النشاط", icon: Activity },
  { key: "settings", label: "الإعدادات", icon: Settings2 },
];
const tabTitles: Record<TabKey, string> = {
  overview: "نظرة عامة", streams: "القنوات المباشرة", library: "مكتبة الفيديو",
  subscribers: "المشتركون", nodes: "الخوادم", activity: "سجل النشاط", settings: "الإعدادات",
};
const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "غير محدد";
const relativeTime = (value: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${formatNumber(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${formatNumber(hours)} ساعة`;
  return `منذ ${formatNumber(Math.floor(hours / 24))} يوم`;
};
const isNodeOnline = (node: NodeRecord, isDemo = false) => node.status === "online" && (isDemo || (!!node.lastSeenAt && Date.now() - new Date(node.lastSeenAt).getTime() < 65_000));
const streamState = (stream: StreamRecord, data: ConsoleData) => {
  if (!stream.enabled) return "paused";
  const node = data.nodes.find((item) => item.id === stream.nodeId);
  if (!node) return "pending";
  if (!isNodeOnline(node, data.demo)) return "offline";
  return stream.health;
};
const subscriberState = (subscriber: SubscriberRecord) => subscriber.expiresAt && new Date(subscriber.expiresAt).getTime() < Date.now() ? "expired" : subscriber.status;

function StatusBadge({ state }: { state: string }) {
  const labels: Record<string, string> = { online: "يعمل الآن", offline: "غير متصل", paused: "متوقف", pending: "قيد التجهيز", error: "خطأ في البث", active: "نشط", expired: "منتهي" };
  return <span className={`status-badge status-${state}`}><span className="status-dot" />{labels[state] ?? state}</span>;
}
function EmptyState({ icon: Icon = FolderClosed, title, description, action }: { icon?: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={25} strokeWidth={1.6} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
function SectionHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="section-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
function StatCard({ icon: Icon, label, value, note, tone }: { icon: LucideIcon; label: string; value: number; note: string; tone: string }) {
  return <div className="stat-card"><div className="stat-top"><span className={`stat-icon stat-${tone}`}><Icon size={21} strokeWidth={1.9} /></span><span className="stat-sparkle"><ArrowUpLeft size={16} /></span></div><div className="stat-value">{formatNumber(value)}</div><div className="stat-label">{label}</div><div className="stat-note">{note}</div></div>;
}
function StreamIcon({ stream, category }: { stream: StreamRecord; category?: CategoryRecord }) {
  const color = category?.color ?? (stream.kind === "vod" ? "#a77aec" : "#6676ef");
  return <span className="stream-icon" style={{ color, background: `${color}18` }}>{stream.kind === "vod" ? <Film size={21} strokeWidth={1.8} /> : <Tv2 size={21} strokeWidth={1.8} />}</span>;
}
function ActivityItem({ item }: { item: ActivityRecord }) {
  const Icon = item.action === "subscriber" ? UserRound : item.action === "node" ? Server : item.action === "security" ? ShieldCheck : Radio;
  return <div className="activity-item"><span className={`activity-icon activity-${item.action}`}><Icon size={17} /></span><div className="activity-details"><strong>{item.message}</strong><span>{item.actor} <span className="middle-dot">·</span> {relativeTime(item.createdAt)}</span></div></div>;
}

export function Dashboard({ initialData, initialTab }: { initialData: ConsoleData; initialTab: TabKey }) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [credential, setCredential] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === "Escape") { setModal(null); setConfirm(null); setCredential(null); setMobileOpen(false); }
    };
    const onPop = () => { const next = new URLSearchParams(window.location.search).get("tab") as TabKey; if (next && tabTitles[next]) setTab(next); else setTab("overview"); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("popstate", onPop); };
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 4000); return () => window.clearTimeout(timer); }, [toast]);

  function navigate(next: TabKey) {
    setTab(next); setSearch(""); setFilter("all"); setCategoryFilter(null); setMobileOpen(false);
    window.history.pushState({}, "", next === "overview" ? "/" : `/?tab=${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function open(config: ModalConfig) { setModal(data.demo && config.kind !== "setup" && config.kind !== "categories" ? { kind: "setup" } : config); }
  function requestDelete(resource: Resource, id: number, name: string) { if (data.demo) { setConfirm(null); setModal({ kind: "setup" }); return; } setModal(null); setConfirm({ resource, id, name }); }
  function notify(message: string, error = false) { setToast({ message, error }); }
  async function refresh() {
    if (data.demo) { notify("أنت في وضع المعاينة؛ أنشئ حسابًا لتفعيل المزامنة."); return; }
    try {
      const response = await fetch("/api/console", { cache: "no-store" });
      if (response.status === 401) { window.location.reload(); return; }
      if (!response.ok) throw new Error("Refresh failed");
      setData(await response.json());
      notify("تم تحديث البيانات");
    } catch { notify("تعذر تحديث البيانات", true); }
  }
  async function mutate(resource: Resource, action: Action, id?: number, payload?: Record<string, unknown>): Promise<{ accessToken?: string } | null> {
    if (data.demo) { setModal({ kind: "setup" }); return null; }
    setBusy(true);
    try {
      const response = await fetch("/api/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resource, action, id, data: payload }) });
      const result = await response.json();
      if (!response.ok) { notify(result.error ?? "تعذر إتمام العملية", true); return null; }
      const updated = await fetch("/api/console", { cache: "no-store" });
      if (updated.ok) setData(await updated.json());
      notify("تم حفظ التغييرات بنجاح");
      return result;
    } catch { notify("تعذر الاتصال بالخادم. حاول مرة أخرى.", true); return null; }
    finally { setBusy(false); }
  }
  async function save(resource: "stream" | "node" | "subscriber" | "category", action: "create" | "update", id: number | undefined, payload: Record<string, unknown>) {
    const result = await mutate(resource, action, id, payload);
    if (result) { setModal(null); if (result.accessToken) setCredential(result.accessToken); }
  }
  async function setup(payload: { name: string; email: string; password: string; setupKey: string }) {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { notify(result.error ?? "تعذرت التهيئة", true); return; }
      window.location.href = "/?created=1";
    } catch { notify("تعذر الاتصال بالخادم", true); }
    finally { setBusy(false); }
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }
  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text); notify("تم نسخ الرابط إلى الحافظة"); }
    catch { notify("تعذر النسخ تلقائيًا. انسخ النص يدويًا.", true); }
  }
  const onlineNodes = data.nodes.filter((node) => isNodeOnline(node, data.demo)).length;
  const liveStreams = data.streams.filter((item) => item.kind === "live");
  const videos = data.streams.filter((item) => item.kind === "vod");
  const onlineStreams = data.streams.filter((item) => streamState(item, data) === "online").length;
  const activeSubscribers = data.subscribers.filter((item) => subscriberState(item) === "active").length;
  const matchedStreams = (tab === "library" ? videos : liveStreams).filter((item) => {
    const matchesQuery = !search || item.name.toLowerCase().includes(search.toLowerCase()) || data.categories.find((c) => c.id === item.categoryId)?.name.includes(search);
    const matchesCategory = categoryFilter === null || item.categoryId === categoryFilter;
    const matchesState = filter === "all" || streamState(item, data) === filter;
    return matchesQuery && matchesCategory && matchesState;
  });
  const matchedSubscribers = data.subscribers.filter((item) => !search || `${item.name} ${item.username}`.toLowerCase().includes(search.toLowerCase()));
  const matchedNodes = data.nodes.filter((item) => !search || `${item.name} ${item.region}`.toLowerCase().includes(search.toLowerCase()));
  const matchedActivity = data.activity.filter((item) => !search || `${item.message} ${item.actor}`.toLowerCase().includes(search.toLowerCase()));
  const quickAction = tab === "subscribers" ? { label: "إضافة مشترك", modal: { kind: "subscriber" } as ModalConfig } : tab === "nodes" ? { label: "إضافة خادم", modal: { kind: "node" } as ModalConfig } : tab === "library" ? { label: "إضافة فيديو", modal: { kind: "stream", streamKind: "vod" } as ModalConfig } : { label: "إضافة قناة", modal: { kind: "stream", streamKind: "live" } as ModalConfig };

  function renderStreamTable(rows: StreamRecord[], compact = false) {
    if (rows.length === 0) return <EmptyState icon={compact ? Radio : tab === "library" ? Video : RadioTower} title={search || filter !== "all" || categoryFilter ? "لا توجد نتائج مطابقة" : compact ? "لم تُضف أي قناة بعد" : tab === "library" ? "مكتبتك تنتظر أول فيديو" : "لم تُضف أي قناة بعد"} description={search || filter !== "all" || categoryFilter ? "جرّب كلمة بحث أو تصنيفًا آخر." : "أضف محتواك المرخّص لتبدأ البث من هذه المساحة."} action={!compact && <button className="secondary-button" onClick={() => open({ kind: "stream", streamKind: tab === "library" ? "vod" : "live" })}><Plus size={16} /> إضافة محتوى</button>} />;
    return <div className="table-scroll"><table className="data-table"><thead><tr><th>المحتوى</th><th>التصنيف</th><th>الخادم</th><th>الحالة</th><th className="table-actions-head">{compact ? "" : "إجراءات"}</th></tr></thead><tbody>{rows.map((item) => {
      const category = data.categories.find((c) => c.id === item.categoryId);
      const node = data.nodes.find((n) => n.id === item.nodeId);
      return <tr key={item.id}><td><div className="stream-cell"><StreamIcon stream={item} category={category} /><div><strong>{item.name}</strong><small>#{formatNumber(item.id)} <span className="middle-dot">·</span> {item.kind === "vod" ? "فيديو" : "بث مباشر"}</small></div></div></td><td><span className="category-label"><span style={{ background: category?.color ?? "#c7cedb" }} />{category?.name ?? "غير مصنف"}</span></td><td><span className="cell-muted">{node?.name ?? "غير معيّن"}</span></td><td><StatusBadge state={streamState(item, data)} /></td><td>{compact ? <button type="button" className="table-link" onClick={() => navigate(item.kind === "vod" ? "library" : "streams")}>عرض <ChevronLeft size={16} /></button> : <div className="row-actions"><button type="button" className="icon-button" title="تعديل" aria-label={`تعديل ${item.name}`} onClick={() => open({ kind: "stream", record: item })}><Pencil size={16} /></button><button type="button" className="icon-button" title={item.enabled ? "إيقاف" : "تشغيل"} aria-label={item.enabled ? `إيقاف ${item.name}` : `تشغيل ${item.name}`} onClick={() => void mutate("stream", "toggle", item.id)}>{item.enabled ? <Pause size={16} /> : <Play size={16} />}</button><button type="button" className="icon-button danger-hover" title="حذف" aria-label={`حذف ${item.name}`} onClick={() => requestDelete("stream", item.id, item.name)}><Trash2 size={16} /></button></div>}</td></tr>;
    })}</tbody></table></div>;
  }

  function overview() {
    const total = data.streams.length;
    const percent = total ? Math.round(onlineStreams / total * 100) : 0;
    const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index)); return date; });
    const counts = days.map((day) => data.activity.filter((item) => new Date(item.createdAt).toDateString() === day.toDateString()).length);
    const max = Math.max(1, ...counts);
    return <>
      <div className="page-intro"><div><span className="eyebrow"><span className="eyebrow-line" /> لوحة التحكم الرئيسية</span><h1>مرحبًا بك في مدار <span className="wave-emoji">👋</span></h1><p>نظرة شاملة على بثّك، ومحتواك، وكل ما يحدث في منصتك.</p></div><div className="intro-date"><CalendarDays size={17} />{new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</div></div>
      <div className="hero-banner"><div className="hero-copy"><span className="hero-kicker"><Sparkles size={15} /> منصتك، بكل وضوح</span><h2>كل بثّك. <span>في مدارك.</span></h2><p>أدر قنواتك، وتابع مشتركيك، وتحكّم بخوادمك من مكان واحد.</p><button type="button" className="hero-button" onClick={() => open({ kind: "stream", streamKind: "live" })}>أضف قناة جديدة <ArrowLeft size={17} /></button></div><div className="hero-illustration" aria-hidden="true"><div className="hero-ring hero-ring-outer" /><div className="hero-ring hero-ring-middle" /><div className="hero-ring hero-ring-inner" /><div className="hero-center"><RadioTower size={45} strokeWidth={1.35} /></div><span className="hero-orb hero-orb-one" /><span className="hero-orb hero-orb-two" /><span className="hero-orb hero-orb-three" /><span className="hero-float-card"><span className="hero-float-dot" /> LIVE <Signal size={15} /></span></div></div>
      <div className="stats-grid"><StatCard icon={RadioTower} label="إجمالي المحتوى" value={total} note={`${formatNumber(liveStreams.length)} قناة · ${formatNumber(videos.length)} فيديو`} tone="purple" /><StatCard icon={Signal} label="المحتوى المتاح" value={onlineStreams} note={`من أصل ${formatNumber(total)} محتوى`} tone="green" /><StatCard icon={Users} label="المشتركون النشطون" value={activeSubscribers} note={`من أصل ${formatNumber(data.subscribers.length)} مشترك`} tone="orange" /><StatCard icon={Server} label="الخوادم المتصلة" value={onlineNodes} note={`من أصل ${formatNumber(data.nodes.length)} خادم`} tone="blue" /></div>
      <div className="overview-chart-grid"><div className="panel chart-panel"><SectionHead title="نشاط المنصة" subtitle="عمليات الإدارة خلال آخر 7 أيام" action={<span className="chart-legend"><span /> الأحداث المسجلة</span>} />{counts.some(Boolean) ? <div className="chart-content"><div className="chart-y-axis"><span>{formatNumber(max)}</span><span>{formatNumber(Math.round(max * .75))}</span><span>{formatNumber(Math.round(max * .5))}</span><span>{formatNumber(Math.round(max * .25))}</span><span>0</span></div><div className="chart-plot"><div className="chart-grid-lines"><i /><i /><i /><i /><i /></div><div className="chart-bars">{days.map((day, index) => <div className="chart-bar-column" key={index}><div className="chart-bar-area"><span className="chart-bar" style={{ height: `${Math.max(counts[index] ? 14 : 2, counts[index] / max * 100)}%` }} title={`${formatNumber(counts[index])} حدث`} /></div><span className="chart-day">{new Intl.DateTimeFormat("ar-EG", { weekday: "short" }).format(day)}</span></div>)}</div></div></div> : <EmptyState icon={BarChart3} title="لا توجد أحداث بعد" description="سيظهر نشاط المنصة هنا عند إضافة محتوى أو مشتركين." />}</div>
      <div className="panel distribution-panel"><SectionHead title="حالة المحتوى" subtitle="نظرة سريعة على جاهزية البث" /><div className="donut-wrap"><div className="donut-chart" style={{ background: `conic-gradient(#6876ef 0% ${percent}%, #e9ecf5 ${percent}% 100%)` }}><div className="donut-center"><strong>{formatNumber(percent)}٪</strong><span>متاح الآن</span></div></div></div><div className="donut-legend"><div><span><i className="legend-dot legend-purple" /> متاح للبث</span><strong>{formatNumber(onlineStreams)}</strong></div><div><span><i className="legend-dot legend-gray" /> قيد التجهيز / متوقف</span><strong>{formatNumber(Math.max(0, total - onlineStreams))}</strong></div></div></div></div>
      <div className="overview-bottom-grid"><div className="panel table-panel"><SectionHead title="أحدث المحتوى" subtitle="آخر القنوات والفيديوهات المضافة" action={<button type="button" className="text-link" onClick={() => navigate("streams")}>عرض الكل <ArrowLeft size={16} /></button>} />{renderStreamTable(data.streams.slice(0, 5), true)}</div><div className="panel activity-panel"><SectionHead title="آخر النشاطات" subtitle="تحديثات مساحة عملك" action={<button type="button" className="icon-button" aria-label="عرض كل النشاطات" onClick={() => navigate("activity")}><ArrowLeft size={17} /></button>} /><div className="activity-list">{data.activity.length ? data.activity.slice(0, 4).map((item) => <ActivityItem key={item.id} item={item} />) : <EmptyState icon={Activity} title="لا نشاط بعد" description="ستظهر التحديثات هنا." />}</div></div></div>
    </>;
  }

  function contentView(isLibrary: boolean) {
    const count = isLibrary ? videos.length : liveStreams.length;
    return <><div className="page-intro page-intro-simple"><div><span className="eyebrow"><span className="eyebrow-line" /> إدارة المحتوى</span><h1>{isLibrary ? "مكتبة الفيديو" : "القنوات المباشرة"}</h1><p>{isLibrary ? "اجمع فيديوهاتك المرخّصة وقدّمها للمشتركين عند الطلب." : "تحكّم في قنواتك المباشرة وحالة البث من مكان واحد."}</p></div><button type="button" className="primary-button" onClick={() => open({ kind: "stream", streamKind: isLibrary ? "vod" : "live" })}><Plus size={18} />{isLibrary ? "إضافة فيديو" : "إضافة قناة"}</button></div>
      <div className="mini-stats-row"><div><span className="mini-stat-icon mini-purple"><RadioTower size={19} /></span><span><strong>{formatNumber(count)}</strong><small>{isLibrary ? "إجمالي الفيديوهات" : "إجمالي القنوات"}</small></span></div><div><span className="mini-stat-icon mini-green"><CheckCircle2 size={19} /></span><span><strong>{formatNumber((isLibrary ? videos : liveStreams).filter((item) => streamState(item, data) === "online").length)}</strong><small>متاح الآن</small></span></div><div><span className="mini-stat-icon mini-orange"><FolderClosed size={19} /></span><span><strong>{formatNumber(data.categories.length)}</strong><small>تصنيفات</small></span></div></div>
      <div className="panel content-panel"><div className="content-panel-heading"><div><h3>{isLibrary ? "جميع الفيديوهات" : "جميع القنوات"} <span className="count-pill">{formatNumber(matchedStreams.length)}</span></h3><p>أدر مصادر المحتوى والخوادم المخصصة لها</p></div><button type="button" className="secondary-button small-button" onClick={() => open({ kind: "categories" })}><FolderClosed size={16} /> التصنيفات</button></div>
      <div className="filters-bar"><div className="filter-chips"><button type="button" className={`filter-chip ${filter === "all" ? "selected" : ""}`} onClick={() => setFilter("all")}>الكل</button><button type="button" className={`filter-chip ${filter === "online" ? "selected" : ""}`} onClick={() => setFilter("online")}>متاح</button><button type="button" className={`filter-chip ${filter === "offline" ? "selected" : ""}`} onClick={() => setFilter("offline")}>غير متصل</button><button type="button" className={`filter-chip ${filter === "paused" ? "selected" : ""}`} onClick={() => setFilter("paused")}>متوقف</button></div><select className="category-select" aria-label="تصفية حسب التصنيف" value={categoryFilter ?? ""} onChange={(event) => setCategoryFilter(event.target.value ? Number(event.target.value) : null)}><option value="">كل التصنيفات</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      {renderStreamTable(matchedStreams)}</div></>;
  }

  function subscribersView() {
    return <><div className="page-intro page-intro-simple"><div><span className="eyebrow"><span className="eyebrow-line" /> إدارة الوصول</span><h1>المشتركون</h1><p>أنشئ الاشتراكات وشارك قوائم تشغيل خاصة وآمنة مع جمهورك.</p></div><button type="button" className="primary-button" onClick={() => open({ kind: "subscriber" })}><Plus size={18} /> إضافة مشترك</button></div>
      <div className="mini-stats-row"><div><span className="mini-stat-icon mini-purple"><Users size={19} /></span><span><strong>{formatNumber(data.subscribers.length)}</strong><small>إجمالي المشتركين</small></span></div><div><span className="mini-stat-icon mini-green"><CheckCircle2 size={19} /></span><span><strong>{formatNumber(activeSubscribers)}</strong><small>اشتراكات نشطة</small></span></div><div><span className="mini-stat-icon mini-orange"><Link2 size={19} /></span><span><strong>{formatNumber(data.subscribers.reduce((sum, item) => sum + item.playlistHits, 0))}</strong><small>طلبات قائمة التشغيل</small></span></div></div>
      <div className="panel content-panel"><div className="content-panel-heading"><div><h3>قائمة المشتركين <span className="count-pill">{formatNumber(matchedSubscribers.length)}</span></h3><p>رمز الوصول لا يظهر إلا عند الإنشاء أو التجديد</p></div></div>{matchedSubscribers.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>المشترك</th><th>اسم المستخدم</th><th>انتهاء الاشتراك</th><th>طلبات القائمة</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>{matchedSubscribers.map((item) => <tr key={item.id}><td><div className="subscriber-cell"><span className="subscriber-avatar">{item.name.charAt(0)}</span><div><strong>{item.name}</strong><small>منذ {formatDate(item.createdAt)}</small></div></div></td><td><code className="username-code" dir="ltr">{item.username}</code></td><td className="cell-muted">{formatDate(item.expiresAt)}</td><td className="cell-muted">{formatNumber(item.playlistHits)}</td><td><StatusBadge state={subscriberState(item)} /></td><td><div className="row-actions"><button type="button" className="icon-button" title="تعديل" aria-label={`تعديل ${item.name}`} onClick={() => open({ kind: "subscriber", record: item })}><Pencil size={16} /></button><button type="button" className="icon-button" title="تجديد رابط التشغيل" aria-label={`تجديد رابط ${item.name}`} onClick={async () => { if (data.demo) { open({ kind: "setup" }); return; } if (!window.confirm("سيُلغى الرابط القديم فورًا. هل تريد إصدار رابط جديد؟")) return; const result = await mutate("subscriber", "regenerate", item.id); if (result?.accessToken) setCredential(result.accessToken); }}><Link2 size={16} /></button><button type="button" className="icon-button" title={item.status === "active" ? "إيقاف الاشتراك" : "تفعيل الاشتراك"} aria-label={item.status === "active" ? `إيقاف ${item.name}` : `تفعيل ${item.name}`} onClick={() => void mutate("subscriber", "toggle", item.id)}>{item.status === "active" ? <Pause size={16} /> : <Play size={16} />}</button><button type="button" className="icon-button danger-hover" title="حذف" aria-label={`حذف ${item.name}`} onClick={() => requestDelete("subscriber", item.id, item.name)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title={search ? "لا توجد نتائج مطابقة" : "لا يوجد مشتركون بعد"} description={search ? "جرّب اسمًا أو اسم مستخدم آخر." : "أنشئ أول اشتراك لبدء مشاركة محتواك."} action={!search && <button className="secondary-button" onClick={() => open({ kind: "subscriber" })}><Plus size={16} /> إضافة مشترك</button>} />}</div>
      <div className="hint-card"><div className="hint-icon"><ShieldCheck size={21} /></div><div><strong>روابط خاصة لكل مشترك</strong><p>لكل مشترك رمز وصول فريد يمكن إيقافه أو تجديده في أي وقت. لا نخزن الرابط الكامل في قاعدة البيانات.</p></div></div></>;
  }

  function nodesView() {
    return <><div className="page-intro page-intro-simple"><div><span className="eyebrow"><span className="eyebrow-line" /> البنية التحتية</span><h1>خوادم البث</h1><p>اربط وكلاء Python 3 ووزّع المحتوى على خوادمك بسهولة.</p></div><button type="button" className="primary-button" onClick={() => open({ kind: "node" })}><Plus size={18} /> إضافة خادم</button></div>
      <div className="mini-stats-row"><div><span className="mini-stat-icon mini-purple"><Server size={19} /></span><span><strong>{formatNumber(data.nodes.length)}</strong><small>إجمالي الخوادم</small></span></div><div><span className="mini-stat-icon mini-green"><Wifi size={19} /></span><span><strong>{formatNumber(onlineNodes)}</strong><small>متصلة الآن</small></span></div><div><span className="mini-stat-icon mini-orange"><WifiOff size={19} /></span><span><strong>{formatNumber(data.nodes.length - onlineNodes)}</strong><small>بانتظار الاتصال</small></span></div></div>
      {matchedNodes.length ? <div className="node-card-grid">{matchedNodes.map((item) => { const assigned = data.streams.filter((s) => s.nodeId === item.id).length; const online = isNodeOnline(item, data.demo); return <div className="node-card" key={item.id}><div className="node-card-top"><span className="node-card-icon"><Server size={23} /></span><StatusBadge state={online ? "online" : "offline"} /></div><h3>{item.name}</h3><span className="node-role">{item.role === "origin" ? "خادم رئيسي" : "خادم توزيع"} <span className="middle-dot">·</span> #{formatNumber(item.id)}</span><div className="node-details"><div><Globe2 size={16} /><span>{item.region}</span></div><div><Link2 size={16} /><span dir="ltr" className="node-address">{item.address}</span></div><div><RadioTower size={16} /><span>{formatNumber(assigned)} محتوى معيّن</span></div><div><Clock3 size={16} /><span>{item.lastSeenAt ? `آخر اتصال ${relativeTime(item.lastSeenAt)}` : "لم يتصل بعد"}</span></div></div><div className="node-card-footer"><button className="text-button" type="button" onClick={() => open({ kind: "node", record: item })}><Pencil size={15} /> تعديل</button><button className="text-button danger-text" type="button" onClick={() => requestDelete("node", item.id, item.name)}><Trash2 size={15} /> حذف</button></div></div>; })}</div> : <div className="panel"><EmptyState icon={Server} title={search ? "لا يوجد خادم يطابق بحثك" : "لا توجد خوادم بعد"} description="أضف خادمًا ثم اربط الوكيل باستخدام رقمه ورمز الاتصال المشترك." action={!search && <button className="secondary-button" onClick={() => open({ kind: "node" })}><Plus size={16} /> إضافة خادم</button>} /></div>}
      <div className="hint-card node-hint"><div className="hint-icon"><Info size={21} /></div><div><strong>كيف أربط خادمًا جديدًا؟</strong><p>أضف عنوان الوكيل، ثم اضبط قيمة NODE_ID لتطابق رقم الخادم الظاهر بجوار اسمه، واستخدم AGENT_TOKEN نفسه في اللوحة والوكيل. راجع دليل التثبيت في الإعدادات.</p></div><button className="text-link" type="button" onClick={() => navigate("settings")}>دليل الإعداد <ArrowLeft size={16} /></button></div></>;
  }

  function activityView() {
    return <><div className="page-intro page-intro-simple"><div><span className="eyebrow"><span className="eyebrow-line" /> مراقبة التغييرات</span><h1>سجل النشاط</h1><p>تابع كل العمليات والتحديثات في مساحة عملك.</p></div><button type="button" className="secondary-button" onClick={() => void refresh()}><RefreshCw size={17} /> تحديث السجل</button></div><div className="panel log-panel"><SectionHead title="الأحداث الأخيرة" subtitle={`${formatNumber(matchedActivity.length)} حدث مسجل`} />{matchedActivity.length ? <div className="full-activity-list">{matchedActivity.map((item) => <div key={item.id} className="full-activity-row"><ActivityItem item={item} /><span className="activity-date">{formatDate(item.createdAt)}</span></div>)}</div> : <EmptyState icon={Activity} title="لا توجد أحداث بعد" description="ستُسجّل هنا إضافات القنوات وتحديثات المشتركين واتصالات الخوادم." />}</div></>;
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await mutate("account", "update", undefined, { currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") });
    if (result) event.currentTarget.reset();
  }
  function settingsView() {
    return <><div className="page-intro page-intro-simple"><div><span className="eyebrow"><span className="eyebrow-line" /> تهيئة المنصة</span><h1>الإعدادات</h1><p>دليل سريع لتشغيل منصتك وإدارة أمان حسابك.</p></div></div>
      <div className="settings-grid"><div className="panel settings-guide"><SectionHead title="ابدأ البث في 3 خطوات" subtitle="كل ما تحتاجه لإطلاق مساحة العمل" /><div className="setup-steps"><div className="setup-step"><span>01</span><div><strong>أضف خادم بث</strong><p>أضف عنوان وكيل Python 3، ثم اضبط NODE_ID على رقم الخادم.</p></div><button onClick={() => navigate("nodes")} className="icon-button" title="الخوادم"><ArrowLeft size={17} /></button></div><div className="setup-step"><span>02</span><div><strong>أضف محتواك</strong><p>أدخل رابط المصدر المرخّص وحدد الخادم المسؤول عن تشغيله.</p></div><button onClick={() => navigate("streams")} className="icon-button" title="القنوات"><ArrowLeft size={17} /></button></div><div className="setup-step"><span>03</span><div><strong>أنشئ مشتركًا</strong><p>شارك معه رابط قائمة M3U الخاص به؛ يمكن إيقافه في أي وقت.</p></div><button onClick={() => navigate("subscribers")} className="icon-button" title="المشتركون"><ArrowLeft size={17} /></button></div></div><div className="install-box"><div className="install-box-top"><span><BookOpen size={17} /> التثبيت على Ubuntu 24.04 / 26.04</span><button type="button" className="icon-button" onClick={() => void copyText("python3 scripts/install.py install")} title="نسخ الأمر"><Copy size={16} /></button></div><code dir="ltr">python3 scripts/install.py install</code><p>يتطلب Docker Compose؛ ينشئ المُثبّت ملف الأسرار ويشغّل الخدمات تلقائيًا. التفاصيل في README.md بالمشروع.</p></div></div>
      <div className="settings-side"><div className="panel profile-panel"><SectionHead title="حساب المدير" subtitle="بيانات مساحة العمل" /><div className="profile-detail"><span className="profile-big-avatar">{data.viewer?.name.charAt(0) ?? "م"}</span><div><strong>{data.viewer?.name ?? "وضع المعاينة"}</strong><span dir="ltr">{data.viewer?.email ?? "لم يتم إنشاء حساب بعد"}</span></div></div>{data.demo ? <button type="button" className="primary-button full-button" onClick={() => open({ kind: "setup" })}>إنشاء حساب المدير <ArrowLeft size={16} /></button> : <form className="password-form" onSubmit={changePassword}><h4><LockKeyhole size={17} /> تغيير كلمة المرور</h4><input type="password" name="currentPassword" placeholder="كلمة المرور الحالية" required /><input type="password" name="newPassword" placeholder="كلمة المرور الجديدة (12 حرفًا على الأقل)" minLength={12} required /><button className="secondary-button full-button" disabled={busy} type="submit">{busy ? "جارٍ الحفظ..." : "تحديث كلمة المرور"}</button></form>}</div>
      <div className="panel tech-panel"><SectionHead title="عن المنصة" /><div className="tech-row"><span><Zap size={17} /> واجهة الإدارة</span><strong>Next.js 16</strong></div><div className="tech-row"><span><HardDrive size={17} /> قاعدة البيانات</span><strong>PostgreSQL</strong></div><div className="tech-row"><span><RadioTower size={17} /> وكيل البث</span><strong>Python 3 + FFmpeg</strong></div><a className="source-link" href="https://github.com/emre1393/xtreamui_mirror" target="_blank" rel="noopener noreferrer">المشروع القديم الذي ألهم البديل <ExternalLink size={15} /></a></div></div></div></>;
  }

  return <div className="app-layout">
    {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}><div className="sidebar-brand"><span className="brand-symbol"><Waves size={23} strokeWidth={2.3} /></span><span className="brand-name">مدار<span className="brand-dot">.</span><small>STREAM CONTROL</small></span><button type="button" className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة"><X size={21} /></button></div>
      <div className="workspace-switch"><span className="workspace-icon"><Radio size={19} /></span><span><strong>مساحة العمل</strong><small>{data.demo ? "المعاينة التجريبية" : "لوحة الإدارة"}</small></span><MoreHorizontal size={18} className="workspace-more" /></div>
      <nav className="sidebar-nav" aria-label="التنقل الرئيسي"><p className="nav-section-title">القائمة الرئيسية</p>{navPrimary.map(({ key, label, icon: Icon }) => <button key={key} type="button" className={`nav-item ${tab === key ? "nav-active" : ""}`} onClick={() => navigate(key)}><Icon size={19} strokeWidth={1.9} /><span>{label}</span>{key === "streams" && liveStreams.length > 0 && <span className="nav-count">{formatNumber(liveStreams.length)}</span>}</button>)}<p className="nav-section-title nav-section-spaced">إدارة النظام</p>{navSystem.map(({ key, label, icon: Icon }) => <button key={key} type="button" className={`nav-item ${tab === key ? "nav-active" : ""}`} onClick={() => navigate(key)}><Icon size={19} strokeWidth={1.9} /><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><span className="sidebar-help-icon"><CircleHelp size={21} /></span><strong>تحتاج مساعدة؟</strong><p>دليل البدء موجود في الإعدادات وملف README الخاص بالمشروع.</p><button type="button" onClick={() => navigate("settings")}>عرض الدليل <ArrowLeft size={15} /></button></div><div className="sidebar-profile"><span className="sidebar-avatar">{data.viewer?.name.charAt(0) ?? "م"}</span><span><strong>{data.viewer?.name ?? "زائر المعاينة"}</strong><small>{data.demo ? "وضع العرض" : "مدير النظام"}</small></span>{!data.demo && <button type="button" className="sidebar-logout" title="تسجيل الخروج" aria-label="تسجيل الخروج" onClick={() => void logout()}><LogOut size={18} /></button>}</div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="topbar-start"><button type="button" className="mobile-menu icon-button" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة"><Menu size={21} /></button><div className="breadcrumb"><span>مساحة العمل</span><ChevronLeft size={15} /><strong>{tabTitles[tab]}</strong></div></div><div className="topbar-actions"><div className="topbar-search"><Search size={18} /><input ref={searchRef} value={search} onChange={(event) => { if (tab === "overview" && event.target.value) { navigate("streams"); setSearch(event.target.value); } else setSearch(event.target.value); }} placeholder="ابحث عن أي شيء..." aria-label="بحث" /><kbd>⌘ K</kbd></div><span className="topbar-separator" /><div className={`topbar-status ${data.demo ? "preview-status" : onlineNodes ? "connected-status" : "waiting-status"}`}><span />{data.demo ? "وضع المعاينة" : onlineNodes ? "النظام متصل" : "بانتظار الخادم"}</div><button type="button" className="top-icon-button" title="سجل النشاط" aria-label="سجل النشاط" onClick={() => navigate("activity")}><Bell size={19} /></button><button type="button" className="top-avatar" title="حساب المدير" onClick={() => navigate("settings")}>{data.viewer?.name.charAt(0) ?? "م"}</button></div></header>
      <main className="main-content">{data.demo && <div className="demo-notice"><span className="demo-notice-icon"><Sparkles size={18} /></span><span><strong>أنت تتصفح نسخة توضيحية.</strong> البيانات المعروضة أمثلة، ولا يوجد بث فعلي حتى تُنشئ حسابًا وتربط وكيل البث.</span><button type="button" onClick={() => open({ kind: "setup" })}>ابدأ الآن <ArrowLeft size={16} /></button></div>}
      {tab === "overview" && overview()}{tab === "streams" && contentView(false)}{tab === "library" && contentView(true)}{tab === "subscribers" && subscribersView()}{tab === "nodes" && nodesView()}{tab === "activity" && activityView()}{tab === "settings" && settingsView()}</main>
      <footer className="app-footer"><span>© 2026 مدار · صُنع ليوصل بثّك أبعد</span><span><span className="footer-dot" />{data.demo ? "بيانات توضيحية" : "لوحة الإدارة"} <span className="middle-dot">·</span> v1.0</span></footer></div>
    {modal && <DashboardModal modal={modal} data={data} busy={busy} onClose={() => setModal(null)} onOpen={open} onSave={save} onDelete={(resource, id, name) => requestDelete(resource, id, name)} onSetup={setup} />}
    {confirm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirm(null); }}><div className="modal-panel confirm-panel" role="alertdialog" aria-modal="true" aria-label="تأكيد الحذف"><span className="confirm-icon"><Trash2 size={25} /></span><h2>حذف «{confirm.name}»؟</h2><p>لا يمكن التراجع عن هذه الخطوة. سيتم حذف العنصر من مساحة عملك.</p><div className="modal-footer"><button className="secondary-button" type="button" onClick={() => setConfirm(null)}>إلغاء</button><button className="danger-button" type="button" disabled={busy} onClick={async () => { const result = await mutate(confirm.resource, "delete", confirm.id); if (result) setConfirm(null); }}>{busy ? "جارٍ الحذف..." : "نعم، احذف العنصر"}</button></div></div></div>}
    {credential && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCredential(null); }}><div className="modal-panel credential-panel" role="dialog" aria-modal="true" aria-label="رابط الاشتراك"><div className="credential-success"><Check size={27} /></div><h2>رابط الاشتراك جاهز!</h2><p>هذا الرابط خاص بالمشترك وسيظهر الآن فقط. احتفظ به في مكان آمن وشاركه عبر قناة موثوقة.</p><div className="credential-url" dir="ltr">{typeof window !== "undefined" ? `${window.location.origin}/api/playlist?token=${credential}` : ""}</div><button type="button" className="primary-button full-button" onClick={() => void copyText(`${window.location.origin}/api/playlist?token=${credential}`)}><Copy size={17} /> نسخ رابط قائمة M3U</button><button type="button" className="text-button credential-close" onClick={() => setCredential(null)}>إغلاق النافذة</button></div></div>}
    {toast && <div className={`toast ${toast.error ? "toast-error" : ""}`} role="status">{toast.error ? <Info size={18} /> : <CheckCircle2 size={18} />}{toast.message}<button type="button" onClick={() => setToast(null)} aria-label="إغلاق"><X size={16} /></button></div>}
  </div>;
}
