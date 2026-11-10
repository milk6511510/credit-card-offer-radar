"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient, getSessionWithTimeout } from "../../lib/auth-client";

type AccountUser = { id: string; name?: string | null; email: string };

export default function AccountPage() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadSession = async () => {
    setIsPending(true);
    setLoadError(false);
    try {
      const { data } = await getSessionWithTimeout();
      setUser(data?.user ? { id: data.user.id, name: data.user.name, email: data.user.email } : null);
    } catch {
      setLoadError(true);
    } finally {
      setIsPending(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void getSessionWithTimeout().then(({ data }) => {
      if (cancelled) return;
      setUser(data?.user ? { id: data.user.id, name: data.user.name, email: data.user.email } : null);
    }).catch(() => {
      if (!cancelled) setLoadError(true);
    }).finally(() => {
      if (!cancelled) setIsPending(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (isPending) {
    return <main className="account-page"><div className="account-panel"><span className="eyebrow">PAYMENTRADER ACCOUNT</span><h1>載入帳號中</h1><p>正在確認登入狀態，最長等待 8 秒。</p><Link className="account-back-link" href="/">返回活動總覽</Link></div></main>;
  }

  if (loadError) {
    return (
      <main className="account-page">
        <div className="account-panel">
          <span className="eyebrow">PAYMENTRADER ACCOUNT</span>
          <h1>無法連線帳號</h1>
          <p>登入服務沒有回應或連線逾時。你可以重新讀取、重新登入，或先回到活動頁。</p>
          <div className="account-actions"><button type="button" className="account-primary-action" onClick={() => void loadSession()}>重新讀取</button><Link className="account-secondary-action" href="/auth/sign-in?callbackURL=%2Faccount">重新登入</Link></div>
          <Link className="account-back-link" href="/">返回活動總覽</Link>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="account-page">
        <div className="account-panel">
          <span className="eyebrow">PAYMENTRADER ACCOUNT</span>
          <h1>登入後管理你的偏好</h1>
          <p>登入即可在不同裝置延續收藏與平台偏好。</p>
          <Link className="account-primary-action" href="/auth/sign-in?callbackURL=%2Faccount">前往登入</Link>
          <Link className="account-back-link" href="/">回到活動總覽</Link>
        </div>
      </main>
    );
  }

  const displayName = user.name || user.email.split("@")[0];

  return (
    <main className="account-page">
      <div className="account-panel">
        <Link className="account-brand" href="/" aria-label="回到 paymentrader">
          <img src="/branding/paymentrader/paymentrader-option-05-final.png" alt="" />
          <span>paymentrader</span>
        </Link>
        <span className="eyebrow">PAYMENTRADER ACCOUNT</span>
        <h1>{displayName}，你的偏好已連線</h1>
        <p>{user.email}</p>
        <div className="account-sync-note"><span className="status-light" />收藏與平台偏好會透過 Ellis Project 跨裝置同步</div>
        <div className="account-actions">
          <Link className="account-primary-action" href="/">查看活動</Link>
          <button type="button" className="account-secondary-action" onClick={async () => { try { await authClient.signOut(); } catch { /* Clear the local view even when the session endpoint is unavailable. */ } finally { window.location.assign("/"); } }}>登出</button>
        </div>
      </div>
    </main>
  );
}
