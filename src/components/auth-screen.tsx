"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, RadioTower, ShieldCheck, Sparkles, Waves } from "lucide-react";

export function AuthScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [setupNotice] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("created"));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "تعذر تسجيل الدخول"); return; }
      // Confirm the session cookie was actually stored before navigating.
      const verify = await fetch("/api/console", { cache: "no-store" });
      if (verify.status === 401) {
        setError("تم قبول بيانات الدخول لكن المتصفح لم يخزّن جلسة الدخول. افتح اللوحة من رابط المعاينة الرئيسي مباشرة (لا ضمن إطار مضمّن) وتأكد من السماح بملفات تعريف الارتباط.");
        return;
      }
      window.location.href = "/";
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-art">
          <div className="auth-art-grid" />
          <div className="auth-brand"><span className="brand-symbol"><Waves size={23} strokeWidth={2.4} /></span><span>مدار<span className="brand-dot">.</span></span></div>
          <div className="auth-orbit"><div className="auth-orbit-inner"><RadioTower size={54} strokeWidth={1.3} /></div><span className="orbit-dot orbit-dot-one" /><span className="orbit-dot orbit-dot-two" /><span className="orbit-dot orbit-dot-three" /></div>
          <div className="auth-art-copy"><span className="auth-art-eyebrow"><Sparkles size={15} /> الجيل الجديد لإدارة البث</span><h1>كل بثّك.<br /><span>في مدارك.</span></h1><p>تحكم بالقنوات، المشتركين، والخوادم من مساحة عمل واحدة مصممة لتكون أبسط وأذكى.</p></div>
          <div className="auth-art-footer"><span className="live-pulse" /> منصة مفتوحة، بُنيت للمستقبل <span>© 2026 مدار</span></div>
        </div>
        <div className="auth-form-side">
          <div className="auth-mobile-brand"><span className="brand-symbol"><Waves size={20} /></span> مدار.</div>
          <div className="auth-form-container">
            <div className="auth-lock-icon"><ShieldCheck size={25} strokeWidth={1.8} /></div>
            <p className="auth-overline">مرحبًا بعودتك</p>
            <h2>تسجيل الدخول</h2>
            <p className="auth-description">أدخل بيانات حساب المدير للمتابعة إلى لوحة التحكم.</p>
            {setupNotice && <div className="form-success"><CheckCircle2 size={16} /> تم إنشاء حساب المدير بنجاح. سجّل دخولك الآن ببياناته.</div>}
            <form onSubmit={handleSubmit} className="auth-form">
              <label className="form-field"><span>البريد الإلكتروني</span><div className="input-icon-wrap"><Mail size={18} /><input name="email" type="email" placeholder="name@example.com" required autoComplete="email" dir="ltr" /></div></label>
              <label className="form-field"><span>كلمة المرور</span><div className="input-icon-wrap"><LockKeyhole size={18} /><input name="password" type={showPassword ? "text" : "password"} placeholder="أدخل كلمة المرور" required autoComplete="current-password" /><button className="password-eye" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
              {error && <div className="form-error" role="alert">{error}</div>}
              <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "جارٍ التحقق..." : "الدخول إلى اللوحة"}<ArrowLeft size={18} /></button>
            </form>
            <div className="auth-secure-note"><ShieldCheck size={16} /> اتصال محمي وجلسة خاصة بمدير النظام</div>
          </div>
        </div>
      </section>
    </main>
  );
}
