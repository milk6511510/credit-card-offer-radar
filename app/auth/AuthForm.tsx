"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient, getSessionWithTimeout } from "../../lib/auth-client";

type AuthMode = "sign-in" | "sign-up";
type FormView = AuthMode | "verify-email";
type MessageTone = "error" | "success" | "info";

function getCallbackUrl() {
  const candidate = new URLSearchParams(window.location.search).get("callbackURL");
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return "/account";
  const target = new URL(candidate, window.location.origin);
  return target.origin === window.location.origin ? `${target.pathname}${target.search}${target.hash}` : "/account";
}

export function AuthForm({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter();
  const [view, setView] = useState<FormView>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(() => setResendCountdown((count) => count - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  const setNotice = (nextMessage: string, tone: MessageTone = "info") => {
    setMessage(nextMessage);
    setMessageTone(tone);
  };

  const switchMode = (nextMode: AuthMode) => {
    setView(nextMode);
    setOtp("");
    setNotice("");
    router.replace(`/auth/${nextMode}${window.location.search}`, { scroll: false });
  };

  const submitEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice("");
    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (view === "sign-up") {
        const result = await authClient.signUp.email({ name: name.trim(), email: normalizedEmail, password });
        if (result.error) {
          setNotice(result.error.message || "目前無法建立帳號，請確認資料後再試一次。", "error");
          return;
        }
        setPassword("");
        setOtp("");
        setView("verify-email");
        setNotice(`帳號已建立。請查看 ${normalizedEmail} 的驗證碼郵件；若沒有收到，可以重新寄送。`, "success");
        return;
      }

      const result = await authClient.signIn.email({ email: normalizedEmail, password, callbackURL: getCallbackUrl() });
      if (result.error) {
        const errorMessage = result.error.message || "目前無法完成登入，請確認資料後再試一次。";
        setNotice(errorMessage, "error");
        if (/verif|unverified|email_not_verified/i.test(errorMessage)) setView("verify-email");
        return;
      }
      window.location.assign(getCallbackUrl());
    } catch {
      setNotice("連線逾時或暫時忙碌，請重試；你也可以返回活動頁，不必停留在此畫面。", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendVerificationCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setNotice("請先輸入註冊時使用的 Email。", "error");
      return;
    }
    setIsSubmitting(true);
    setNotice("");
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email: normalizedEmail, type: "email-verification" });
      if (result.error) {
        setNotice(result.error.message || "目前無法寄送驗證碼，請稍後再試。", "error");
        return;
      }
      setResendCountdown(30);
      setNotice(`已重新寄送驗證碼至 ${normalizedEmail}。請檢查收件匣與垃圾郵件。`, "success");
    } catch {
      setNotice("驗證碼寄送失敗或連線逾時，請稍後重試。", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice("");
    try {
      const result = await authClient.emailOtp.verifyEmail({ email: email.trim().toLowerCase(), otp: otp.trim() });
      if (result.error) {
        setNotice(result.error.message || "驗證碼無效或已過期，請確認後重試或重新寄送。", "error");
        return;
      }

      try {
        const session = await getSessionWithTimeout();
        if (session.data?.user) {
          window.location.assign(getCallbackUrl());
          return;
        }
      } catch {
        // Email verification may succeed even when automatic sign-in is unavailable.
      }
      setView("sign-in");
      setPassword("");
      setNotice("Email 已驗證完成，請使用剛建立的密碼登入。", "success");
    } catch {
      setNotice("驗證服務暫時無回應，請重試；你仍可返回登入或活動頁。", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithGoogle = async () => {
    setIsSubmitting(true);
    setNotice("");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: getCallbackUrl() });
      if (result.error) setNotice(result.error.message || "Google 登入目前無法使用，請改用 Email 登入。", "error");
    } catch {
      setNotice("Google 登入目前無法使用，請改用 Email 登入。", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVerifying = view === "verify-email";
  const isSigningUp = view === "sign-up";

  return (
    <div className="auth-form-shell">
      <div className="auth-escape-actions">
        {isVerifying ? <button type="button" onClick={() => switchMode("sign-in")}>返回登入</button> : null}
        <Link href="/">回到活動總覽</Link>
      </div>

      {!isVerifying ? (
        <>
          <button type="button" className="auth-google-button" onClick={signInWithGoogle} disabled={isSubmitting}>
            <span className="auth-google-mark" aria-hidden="true">G</span>
            以 Google 繼續
          </button>
          <div className="auth-form-divider"><span>或使用 Email</span></div>
        </>
      ) : null}

      {isVerifying ? (
        <form className="auth-form" onSubmit={verifyEmail}>
          <div className="auth-verification-heading">
            <span className="eyebrow">EMAIL VERIFICATION</span>
            <strong>輸入 6 位數驗證碼</strong>
            <span>寄送至 {email || "註冊 Email"}</span>
          </div>
          <label className="auth-form-field">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="name@example.com" />
          </label>
          <label className="auth-form-field">
            <span>驗證碼</span>
            <input className="auth-otp-input" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required placeholder="000000" aria-describedby="auth-otp-hint" />
            <small id="auth-otp-hint">若未收到，請稍候後重寄；也請檢查垃圾郵件。</small>
          </label>
          {message ? <p className={`auth-form-message is-${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{message}</p> : null}
          <button type="submit" className="auth-submit-button" disabled={isSubmitting || otp.length !== 6}>{isSubmitting ? "驗證中..." : "驗證 Email"}</button>
          <button type="button" className="auth-resend-button" onClick={resendVerificationCode} disabled={isSubmitting || resendCountdown > 0}>
            {resendCountdown > 0 ? `${resendCountdown} 秒後可重新寄送` : "重新寄送驗證碼"}
          </button>
          <button type="button" className="auth-edit-email-button" onClick={() => switchMode("sign-up")}>Email 有誤？返回修改資料</button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={submitEmailAuth}>
          {isSigningUp ? (
            <label className="auth-form-field">
              <span>名稱</span>
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required placeholder="你的顯示名稱" />
            </label>
          ) : null}
          <label className="auth-form-field">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="name@example.com" />
          </label>
          <label className="auth-form-field">
            <span>密碼</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSigningUp ? "new-password" : "current-password"} minLength={8} required placeholder="至少 8 個字元" />
          </label>
          {message ? <p className={`auth-form-message is-${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{message}</p> : null}
          {view === "sign-in" && /verif|unverified|email_not_verified/i.test(message) ? <button type="button" className="auth-resend-button" onClick={() => setView("verify-email")}>改用驗證碼完成 Email 驗證</button> : null}
          <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
            {isSubmitting ? "處理中..." : isSigningUp ? "建立 Email 帳號" : "登入 paymentrader"}
          </button>
        </form>
      )}

      {!isVerifying ? (
        <div className="auth-mode-switch">
          <span>{isSigningUp ? "已經有帳號？" : "第一次使用 paymentrader？"}</span>
          <button type="button" onClick={() => switchMode(isSigningUp ? "sign-in" : "sign-up")}>
            {isSigningUp ? "取消註冊，返回登入" : "建立帳號"}
          </button>
        </div>
      ) : null}
      <p className="auth-form-footnote">登入後可同步收藏與平台偏好；註冊需要完成 Email 驗證。</p>
    </div>
  );
}
