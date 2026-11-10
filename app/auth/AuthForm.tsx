"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../../lib/auth-client";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    try {
      const result = mode === "sign-up"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password, callbackURL: "/" });

      if (result.error) {
        setMessage(result.error.message || "目前無法完成登入，請確認資料後再試一次。");
        return;
      }

      if (mode === "sign-up") {
        setMessage("帳號已建立。請依 Email 內的驗證碼完成驗證，再回來登入。");
        setMode("sign-in");
        setPassword("");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setMessage("連線暫時忙碌，請稍後再試一次。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithGoogle = async () => {
    setIsSubmitting(true);
    setMessage("");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
      if (result.error) setMessage(result.error.message || "Google 登入目前無法使用，請改用 Email 登入。");
    } catch {
      setMessage("Google 登入目前無法使用，請改用 Email 登入。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage("");
    router.replace(`/auth/${nextMode}`, { scroll: false });
  };

  return (
    <div className="auth-form-shell">
      <button type="button" className="auth-google-button" onClick={signInWithGoogle} disabled={isSubmitting}>
        <span className="auth-google-mark" aria-hidden="true">G</span>
        以 Google 繼續
      </button>
      <div className="auth-form-divider"><span>或使用 Email</span></div>
      <form className="auth-form" onSubmit={submitEmailAuth}>
        {mode === "sign-up" ? (
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
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={8} required placeholder="至少 8 個字元" />
        </label>
        {message ? <p className="auth-form-message" role="status">{message}</p> : null}
        <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
          {isSubmitting ? "處理中..." : mode === "sign-up" ? "建立 Email 帳號" : "登入 paymentrader"}
        </button>
      </form>
      <div className="auth-mode-switch">
        <span>{mode === "sign-up" ? "已經有帳號？" : "第一次使用 paymentrader？"}</span>
        <button type="button" onClick={() => switchMode(mode === "sign-up" ? "sign-in" : "sign-up")}>
          {mode === "sign-up" ? "回到登入" : "建立帳號"}
        </button>
      </div>
      <p className="auth-form-footnote">登入後可同步收藏與平台偏好；Email 註冊會寄出驗證碼。</p>
    </div>
  );
}
