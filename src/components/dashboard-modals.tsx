"use client";

import { type FormEvent, type ReactNode } from "react";
import { ArrowLeft, FolderPlus, Info, Plus, Server, Tv, UserRoundPlus, Video, X } from "lucide-react";
import type { CategoryRecord, ConsoleData, NodeRecord, StreamRecord, SubscriberRecord } from "@/lib/types";

export type ModalConfig = {
  kind: "stream" | "node" | "subscriber" | "category" | "categories" | "setup";
  record?: StreamRecord | NodeRecord | SubscriberRecord | CategoryRecord;
  streamKind?: "live" | "vod";
};

type EditableResource = "stream" | "node" | "subscriber" | "category";

type Props = {
  modal: ModalConfig;
  data: ConsoleData;
  busy: boolean;
  onClose: () => void;
  onOpen: (config: ModalConfig) => void;
  onSave: (resource: EditableResource, action: "create" | "update", id: number | undefined, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (resource: EditableResource, id: number, name: string) => void;
  onSetup: (payload: { name: string; email: string; password: string; setupKey: string }) => Promise<void>;
};

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="form-field"><span>{label}</span>{children}{hint && <small className="field-hint">{hint}</small>}</label>;
}

export function DashboardModal({ modal, data, busy, onClose, onOpen, onSave, onDelete, onSetup }: Props) {
  const stream = modal.kind === "stream" ? modal.record as StreamRecord | undefined : undefined;
  const node = modal.kind === "node" ? modal.record as NodeRecord | undefined : undefined;
  const subscriber = modal.kind === "subscriber" ? modal.record as SubscriberRecord | undefined : undefined;
  const category = modal.kind === "category" ? modal.record as CategoryRecord | undefined : undefined;
  const kind = stream?.kind ?? modal.streamKind ?? "live";
  const isEdit = Boolean(modal.record);
  const titles = {
    stream: isEdit ? "تعديل المحتوى" : kind === "vod" ? "إضافة فيديو جديد" : "إضافة قناة جديدة",
    node: isEdit ? "تعديل الخادم" : "إضافة خادم جديد",
    subscriber: isEdit ? "تعديل المشترك" : "إضافة مشترك جديد",
    category: isEdit ? "تعديل التصنيف" : "تصنيف جديد",
    categories: "إدارة التصنيفات",
    setup: "ابدأ مع مدار",
  };
  const icons = { stream: kind === "vod" ? Video : Tv, node: Server, subscriber: UserRoundPlus, category: FolderPlus, categories: FolderPlus, setup: Tv };
  const Icon = icons[modal.kind];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (modal.kind === "setup") {
      void onSetup({ name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""), setupKey: String(form.get("setupKey") ?? "") });
      return;
    }
    if (modal.kind === "stream") {
      void onSave("stream", isEdit ? "update" : "create", stream?.id, {
        name: String(form.get("name") ?? "").trim(), sourceUrl: String(form.get("sourceUrl") ?? "").trim(),
        logoUrl: String(form.get("logoUrl") ?? "").trim(), kind: String(form.get("kind") ?? "live"),
        categoryId: Number(form.get("categoryId")) || null, nodeId: Number(form.get("nodeId")) || null,
      });
    } else if (modal.kind === "node") {
      void onSave("node", isEdit ? "update" : "create", node?.id, {
        name: String(form.get("name") ?? "").trim(), address: String(form.get("address") ?? "").trim(),
        region: String(form.get("region") ?? "").trim(), role: String(form.get("role") ?? "origin"),
      });
    } else if (modal.kind === "subscriber") {
      const date = String(form.get("expiresAt") ?? "");
      void onSave("subscriber", isEdit ? "update" : "create", subscriber?.id, {
        name: String(form.get("name") ?? "").trim(), username: String(form.get("username") ?? "").trim(),
        expiresAt: date ? new Date(`${date}T23:59:59`).toISOString() : null,
      });
    } else if (modal.kind === "category") {
      void onSave("category", isEdit ? "update" : "create", category?.id, {
        name: String(form.get("name") ?? "").trim(), color: String(form.get("color") ?? "#6876ef"),
      });
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} role="presentation">
    <div className="modal-panel" role="dialog" aria-modal="true" aria-label={titles[modal.kind]}>
      <div className="modal-header"><div className="modal-heading-icon"><Icon size={22} /></div><div><h2>{titles[modal.kind]}</h2><p>{modal.kind === "setup" ? "أنشئ حساب المدير، وابدأ بإدارة بثّك بنفسك." : modal.kind === "categories" ? "نظّم محتواك ليصل إلى المشاهدين بسهولة." : "أكمل البيانات التالية لحفظ التغييرات في مساحة عملك."}</p></div><button type="button" className="icon-button modal-close" onClick={onClose} aria-label="إغلاق"><X size={19} /></button></div>

      {modal.kind === "categories" ? <div className="modal-body"><div className="category-list">{data.categories.length === 0 && <p className="muted-text">لا توجد تصنيفات حتى الآن.</p>}{data.categories.map((item) => <div className="category-list-row" key={item.id}><span className="category-color-dot" style={{ background: item.color }} /><strong>{item.name}</strong><span className="category-item-actions"><button className="text-button" type="button" onClick={() => onOpen({ kind: "category", record: item })}>تعديل</button><button className="text-button danger-text" type="button" onClick={() => onDelete("category", item.id, item.name)}>حذف</button></span></div>)}</div><button type="button" className="secondary-button full-button" onClick={() => onOpen({ kind: "category" })}><Plus size={17} /> إضافة تصنيف</button></div> :
      <form onSubmit={handleSubmit}>
        <div className="modal-body form-stack">
          {modal.kind === "setup" && <>
            <div className="modal-info"><Info size={18} /><span>هذه بيانات معاينة فقط. بعد إنشاء الحساب تبدأ بمساحة عمل فارغة وآمنة.</span></div>
            <Field label="اسم المدير"><input name="name" required minLength={2} maxLength={120} placeholder="مثال: مدير النظام" autoFocus /></Field>
            <Field label="البريد الإلكتروني"><input name="email" type="email" required placeholder="admin@example.com" dir="ltr" /></Field>
            <Field label="كلمة مرور قوية" hint="12 حرفًا على الأقل"><input name="password" type="password" required minLength={12} autoComplete="new-password" placeholder="••••••••••••" dir="ltr" /></Field>
            <Field label="رمز التهيئة" hint="إن ظهرت هذه الرسالة فالقيمة مضبوطة في بيئة التشغيل: على الخادم في deploy/.env، وفي المعاينة ضمن إعدادات بيئة المنصة."><input name="setupKey" type="password" placeholder="رمز التهيئة (اختياري)" dir="ltr" /></Field>
          </>}
          {modal.kind === "stream" && <>
            <div className="form-grid-two"><Field label="اسم المحتوى"><input name="name" defaultValue={stream?.name ?? ""} required minLength={2} maxLength={150} placeholder={kind === "vod" ? "مثال: رحلة إلى الطبيعة" : "مثال: الأخبار الرئيسية"} autoFocus /></Field><Field label="نوع المحتوى"><select name="kind" defaultValue={kind}><option value="live">بث مباشر</option><option value="vod">فيديو عند الطلب</option></select></Field></div>
            <Field label="رابط المصدر" hint="رابط HTTP أو HTTPS لمصدر تملك حق بثّه. يقبل MP4 وMPEG-TS والمصادر التي يدعمها FFmpeg."><input name="sourceUrl" type="url" dir="ltr" defaultValue={stream?.sourceUrl ?? ""} required placeholder="https://example.com/stream.m3u8" /></Field>
            <div className="form-grid-two"><Field label="التصنيف"><select name="categoryId" defaultValue={stream?.categoryId ?? ""}><option value="">بدون تصنيف</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="خادم البث"><select name="nodeId" defaultValue={stream?.nodeId ?? ""}><option value="">تعيين لاحقًا</option>{data.nodes.map((item) => <option key={item.id} value={item.id}>{item.name} (#{item.id})</option>)}</select></Field></div>
            <Field label="رابط الشعار (اختياري)"><input name="logoUrl" type="url" dir="ltr" defaultValue={stream?.logoUrl ?? ""} placeholder="https://example.com/logo.png" /></Field>
            {data.nodes.length === 0 && <div className="modal-info"><Info size={18} /><span>أضف خادمًا أولًا ليتمكن وكيل Python من تشغيل هذا المحتوى.</span></div>}
          </>}
          {modal.kind === "node" && <>
            <Field label="اسم الخادم"><input name="name" defaultValue={node?.name ?? ""} required minLength={2} placeholder="مثال: الخادم الرئيسي" autoFocus /></Field>
            <Field label="عنوان وكيل البث" hint="عند استخدام Docker Compose على الخادم نفسه: http://agent:9000"><input name="address" type="url" dir="ltr" defaultValue={node?.address ?? "http://agent:9000"} required placeholder="http://agent:9000" /></Field>
            <div className="form-grid-two"><Field label="المنطقة"><input name="region" defaultValue={node?.region ?? ""} required placeholder="مثال: الشرق الأوسط" /></Field><Field label="دور الخادم"><select name="role" defaultValue={node?.role ?? "origin"}><option value="origin">رئيسي (Origin)</option><option value="edge">توزيع (Edge)</option></select></Field></div>
            <div className="modal-info"><Info size={18} /><span>بعد الحفظ، اضبط NODE_ID في الوكيل على الرقم الذي سيظهر بجوار الخادم.</span></div>
          </>}
          {modal.kind === "subscriber" && <>
            <Field label="الاسم الكامل"><input name="name" defaultValue={subscriber?.name ?? ""} required minLength={2} placeholder="مثال: أحمد محمد" autoFocus /></Field>
            <Field label="اسم المستخدم" hint="حروف إنجليزية وأرقام و _ أو - فقط"><input name="username" dir="ltr" pattern="[a-zA-Z0-9_-]{3,80}" defaultValue={subscriber?.username ?? ""} required placeholder="ahmad_01" /></Field>
            <Field label="تاريخ الانتهاء (اختياري)"><input name="expiresAt" type="date" defaultValue={subscriber?.expiresAt?.slice(0, 10) ?? ""} /></Field>
            {!subscriber && <div className="modal-info"><Info size={18} /><span>سيظهر رابط قائمة التشغيل مرة واحدة فقط بعد الإنشاء. احفظه في مكان آمن.</span></div>}
          </>}
          {modal.kind === "category" && <><Field label="اسم التصنيف"><input name="name" defaultValue={category?.name ?? ""} required minLength={2} placeholder="مثال: أخبار" autoFocus /></Field><Field label="لون التصنيف"><div className="color-input-wrap"><input name="color" type="color" defaultValue={category?.color ?? "#6876ef"} /><span>اختر لونًا يميّز هذا التصنيف في اللوحة</span></div></Field></>}
        </div>
        <div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>إلغاء</button><button type="submit" className="primary-button" disabled={busy}>{busy ? "جارٍ الحفظ..." : modal.kind === "setup" ? "إنشاء مساحة العمل" : isEdit ? "حفظ التعديلات" : "إضافة الآن"}<ArrowLeft size={17} /></button></div>
      </form>}
    </div>
  </div>;
}
