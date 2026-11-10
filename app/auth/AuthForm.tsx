"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient, getSessionWithTimeout } from "../../lib/auth-client";

type AuthMode = "sign-in" | "sign-up";
type FormView = AuthMode | "verify-email" | "forgot-password" | "reset-password";
type MessageTone = "error" | "success" | "info";

function getCallbackUrl() {
  if (typeof window === "undefined") return "/account";
  const candidate = new URLSearchParams(window.location.search).get("callbackURL");
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return "/account";
  const target = new URL(candidate, window.location.origin);
  return target.origin === window.location.origin ? `${target.pathname}${target.search}${target.hash}` : "/account";
}

function authErrorMessage(message: string) {
  if (/invalid.*(email|credential|password)|email or password|unauthorized/i.test(message)) {
    return "Email 或密碼不正確。若你是用 Google 建立帳號，請改用 Google 登入，或使用忘記密碼為此 Email 設定密碼。";
  }
  if (/verif|unverified|email_not_verified/i.test(message)) {
    return "這個 Email 尚未驗證，請完成驗證後再登入。";
  }
  if (/rate|too many|limit/i.test(message)) {
    return "嘗試次數較多，請稍候幾分鐘再試。";
  }
  return message || "目前無法完成登入，請確認資料後再試一次。";
}

export function AuthForm({ initialMode, initialView }: { initialMode: AuthMode; initialView?: "forgot-password" | "reset-password" }) {
  const router = useRouter();
  const [view, setView] = useState<FormView>(initialView || initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (initialView) return;
    let cancelled = false;
    void getSessionWithTimeout().then(({ data }) => {
      if (!cancelled && data?.user) window.location.replace(getCallbackUrl());
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [initialView]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reset") === "success") {
        setMessage("密碼已更新，請使用新密碼登入。若原帳號是 Google 建立，也可改用 Google 登入。 ");
        setMessageTone("success");
      } else if (params.get("error") === "INVALID_TOKEN") {
        setMessage("重設連結已失效或已使用，請重新申請一封重設信。 ");
        setMessageTone("error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
    setPassword("");
    setConfirmPassword("");
    setNotice("");
    router.replace(`/auth/${nextMode}?callbackURL=${encodeURIComponent(getCallbackUrl())}`, { scroll: false });
  };

  const openForgotPassword = () => {
    setView("forgot-password");
    setPassword("");
    setConfirmPassword("");
    setNotice("");
    router.push(`/auth/forgot-password?callbackURL=${encodeURIComponent(getCallbackUrl())}`, { scroll: false });
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
          setNotice(authErrorMessage(result.error.message || "目前無法建立帳號。"), "error");
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
        setNotice(authErrorMessage(result.error.message || "目前無法完成登入。"), "error");
        if (/verif|unverified|email_not_verified/i.test(result.error.message || "")) setView("verify-email");
        return;
      }
      window.location.assign(getCallbackUrl());
    } catch {
      setNotice("登入服務暫時無回應。若帳號是用 Google 建立，請改用 Google 登入或使用忘記密碼設定 Email 密碼。", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice("");
    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (result.error) {
        setNotice(authErrorMessage(result.error.message || "目前無法寄送重設信。"), "error");
        return;
      }
      setNotice("若此 Email 已註冊，密碼重設連結已寄出。請檢查收件匣與垃圾郵件。", "success");
    } catch {
      setNotice("重設信暫時無法寄出，請稍後再試；也可以返回並使用 Google 登入。", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setNotice("兩次輸入的新密碼不一致。", "error");
      return;
    }
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setNotice("重設連結缺少驗證資料，請重新申請重設信。", "error");
      return;
    }

    setIsSubmitting(true);
    setNotice("");
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setNotice(authErrorMessage(result.error.message || "無法更新密碼，請重新申請重設信。"), "error");
        return;
      }
      window.location.assign(`/auth/sign-in?callbackURL=${encodeURIComponent(getCallbackUrl())}&reset=success`);
    } catch {
      setNotice("密碼更新服務暫時無回應，請稍後重試或重新申請重設信。", "error");
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
      const callbackURL = getCallbackUrl();
      const result = await authClient.signIn.social({ provider: "google", callbackURL, newUserCallbackURL: callbackURL });
      if (result.error) setNotice(authErrorMessage(result.error.message || "Google 登入目前無法使用，請改用 Email 登入。"), "error");
    } catch {
      setNotice("Google 登入目前無法使用。請確認 Neon Auth 已啟用 Google，並檢查登入來源網域設定。", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVerifying = view === "verify-email";
  const isSigningUp = view === "sign-up";
  const isForgotPassword = view === "forgot-password";
  const isResettingPassword = view === "reset-password";
  const isCredentialForm = view === "sign-in" || view === "sign-up";

  return (
    <div className="auth-form-shell">
      <div className="auth-escape-actions">
        {isVerifying || isForgotPassword || isResettingPassword ? (
          <button type="button" onClick={() => switchMode("sign-in")}>返回登入</button>
        ) : null}
        <Link href="/">回到活動總覽</Link>
      </div>

      {isCredentialForm ? (
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
          <div className="auth-verification-heading"><span className="eyebrow">EMAIL VERIFICATION</span><strong>輸入 6 位數驗證碼</strong><span>寄送至 {email || "註冊 Email"}</span></div>
          <label className="auth-form-field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="name@example.com" /></label>
          <label className="auth-form-field"><span>驗證碼</span><input className="auth-otp-input" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required placeholder="000000" aria-describedby="auth-otp-hint" /><small id="auth-otp-hint">若未收到，請稍候後重寄；也請檢查垃圾郵件。</small></label>
          {message ? <p className={`auth-form-message is-${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{message}</p> : null}
          <button type="submit" className="auth-submit-button" disabled={isSubmitting || otp.length !== 6}>{isSubmitting ? "驗證中..." : "驗證 Email"}</button>
          <button type="button" className="auth-resend-button" onClick={resendVerificationCode} disabled={isSubmitting || resendCountdown > 0}>{resendCountdown > 0 ? `${resendCountdown} 秒後可重新寄送` : "重新寄送驗證碼"}</button>
          <button type="button" className="auth-edit-email-button" onClick={() => switchMode("sign-up")}>Email 有誤？返回修改資料</button>
        </form>
      ) : isForgotPassword ? (
        <form className="auth-form" onSubmit={requestPasswordReset}>
          <div className="auth-verification-heading"><span className="eyebrow">PASSWORD RECOVERY</span><strong>找回你的帳號</strong><span>輸入註冊 Email，我們會寄送安全的重設連結。</span></div>
          <label className="auth-form-field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="name@example.com" /></label>
          {message ? <p className={`auth-form-message is-${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{message}</p> : null}
          <button type="submit" className="auth-submit-button" disabled={isSubmitting}>{isSubmitting ? "寄送中..." : "寄送重設連結"}</button>
          <p className="auth-reset-hint">如果原本是使用 Google 建立帳號，重設密碼可為同一個 Email 設定密碼。</p>
        </form>
      ) : isResettingPassword ? (
        <form className="auth-form" onSubmit={resetPassword}>
          <div className="auth-verification-heading"><span className="eyebrow">NEW PASSWORD</span><strong>設定新密碼</strong><span>請設定至少 8 個字元，更新後需重新登入。</span></div>
          <label className="auth-form-field"><span>新密碼</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required placeholder="至少 8 個字元" /></label>
          <label className="auth-form-field"><span>再次輸入新密碼</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required placeholder="再次輸入新密碼" /></label>
          {message ? <p className={`auth-form-message is-${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{message}</p> : null}
          <button type="submit" className="auth-submit-button" disabled={isSubmitting}>{isSubmitting ? "更新中..." : "更新密碼"}</button>
          <Link className="auth-resend-button" href={`/auth/forgot-password?callbackURL=${encodeURIComponent(getCallbackUrl())}`}>重新申請重設信</Link>
        </form>
      ) : (
        <form className="auth-form" onSubmit={submitEmailAuth}>
          {isSigningUp ? <label className="auth-form-field"><span>名稱</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required placeholder="你的顯示名稱" /></label> : null}
          <label className="auth-form-field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="name@example.com" /></label>
          <label className="auth-form-field"><span>密碼</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSigningUp ? "new-password" : "current-password"} minLength={8} required placeholder="至少 8 個字元" /></label>
          {view === "sign-in" ? <button type="button" className="auth-forgot-password-button" onClick={openForgotPassword}>忘記密碼？</button> : null}
          {message ? <p className={`auth-form-message is-${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{message}</p> : null}
          {view === "sign-in" && /verif|unverified|email_not_verified/i.test(message) ? <button type="button" className="auth-resend-button" onClick={() => setView("verify-email")}>改用驗證碼完成 Email 驗證</button> : null}
          <button type="submit" className="auth-submit-button" disabled={isSubmitting}>{isSubmitting ? "處理中..." : isSigningUp ? "建立 Email 帳號" : "登入 paymentrader"}</button>
          {view === "sign-in" ? <p className="auth-reset-hint">若帳號最初使用 Google 建立，請使用 Google 登入，或以忘記密碼設定 Email 密碼。</p> : null}
        </form>
      )}

      {isCredentialForm ? (
        <div className="auth-mode-switch"><span>{isSigningUp ? "已經有帳號？" : "第一次使用 paymentrader？"}</span><button type="button" onClick={() => switchMode(isSigningUp ? "sign-in" : "sign-up")}>{isSigningUp ? "取消註冊，返回登入" : "建立帳號"}</button></div>
      ) : null}
      {!isForgotPassword && !isResettingPassword ? <p className="auth-form-footnote">登入後可同步收藏與平台偏好；註冊需要完成 Email 驗證。</p> : null}
    </div>
  );
}
