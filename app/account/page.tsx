"use client";

import Link from "next/link";
import { authClient } from "../../lib/auth-client";

export default function AccountPage() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  if (isPending) {
    return <main className="account-page"><div className="account-panel"><span className="eyebrow">PAYMENTRADER ACCOUNT</span><h1>載入帳號中</h1></div></main>;
  }

  if (!user) {
    return (
      <main className="account-page">
        <div className="account-panel">
          <span className="eyebrow">PAYMENTRADER ACCOUNT</span>
          <h1>登入後管理你的偏好</h1>
          <p>登入即可在不同裝置延續收藏與平台偏好。</p>
          <Link className="account-primary-action" href="/auth/sign-in">前往登入</Link>
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
          <button type="button" className="account-secondary-action" onClick={async () => { await authClient.signOut(); window.location.assign("/"); }}>登出</button>
        </div>
      </div>
    </main>
  );
}
