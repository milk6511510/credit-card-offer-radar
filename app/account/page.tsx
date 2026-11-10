"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getAuthClient, getSessionWithTimeout } from "../../lib/auth-client";

type AccountUser = { id: string; name?: string | null; email: string };
type StoredPreferences = { favoriteIds: string[]; preferredPlatforms: string[]; notificationsEnabled: boolean; updatedAt: string | null };
type GoogleLinkState = "checking" | "linked" | "not-linked" | "unavailable" | "linking";

const emptyPreferences: StoredPreferences = { favoriteIds: [], preferredPlatforms: [], notificationsEnabled: false, updatedAt: null };
const platformOptions = ["LINE Pay", "街口支付", "悠遊付", "iPASS MONEY", "icash Pay", "Pi 拍錢包", "全盈+PAY", "OPEN錢包", "7-ELEVEN", "台灣 Pay", "全支付", "橘子支付", "歐付寶 O'Pay", "ezPay 簡單付"];

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "尚無雲端同步紀錄";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "同步時間暫不可用";
  return new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function AccountPage() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [preferences, setPreferences] = useState<StoredPreferences | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [preferencesError, setPreferencesError] = useState(false);
  const [platformSaveState, setPlatformSaveState] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [googleLinkState, setGoogleLinkState] = useState<GoogleLinkState>("checking");
  const [notice, setNotice] = useState("");
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  const loadAccount = useCallback(async () => {
    setIsPending(true);
    setLoadError(false);
    setPreferencesError(false);
    try {
      const { data } = await getSessionWithTimeout();
      const nextUser = data?.user ? { id: data.user.id, name: data.user.name, email: data.user.email } : null;
      setUser(nextUser);
      if (!nextUser) {
        setPreferences(null);
        setGoogleLinkState("not-linked");
        return;
      }

      try {
        const authClient = await getAuthClient();
        const accountsResult = await authClient.listAccounts();
        if (accountsResult.error) throw new Error(accountsResult.error.message);
        setGoogleLinkState(accountsResult.data?.some((account) => account.providerId === "google") ? "linked" : "not-linked");
      } catch {
        setGoogleLinkState("unavailable");
      }

      try {
        const response = await fetch("/api/preferences", { cache: "no-store" });
        if (!response.ok) throw new Error("Preference sync unavailable.");
        const payload = await response.json() as { preferences?: Partial<StoredPreferences> | null };
        const stored = payload.preferences;
        setPreferences(stored ? {
          favoriteIds: stringList(stored.favoriteIds),
          preferredPlatforms: stringList(stored.preferredPlatforms),
          notificationsEnabled: stored.notificationsEnabled === true,
          updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : null,
        } : emptyPreferences);
      } catch {
        setPreferencesError(true);
        setPreferences(null);
      }
    } catch {
      setLoadError(true);
    } finally {
      setIsPending(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAccount(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAccount]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if ("Notification" in window) setBrowserPermission(Notification.permission);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const displayName = user?.name?.trim() || user?.email.split("@")[0] || "個人帳號";

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      setBrowserPermission("unsupported");
      return;
    }
    try {
      setBrowserPermission(await Notification.requestPermission());
    } catch {
      setNotice("無法取得瀏覽器通知權限，請檢查網站的通知設定。");
    }
  };

  const togglePreferredPlatform = async (platform: string) => {
    if (!preferences || preferencesError || platformSaveState === "saving") return;
    const preferredPlatforms = preferences.preferredPlatforms.includes(platform)
      ? preferences.preferredPlatforms.filter((item) => item !== platform)
      : [...preferences.preferredPlatforms, platform];
    const nextPreferences = { ...preferences, preferredPlatforms };
    setPreferences(nextPreferences);
    setPlatformSaveState("saving");
    try {
      window.localStorage.setItem("paymentrader:preferred-platforms", JSON.stringify(preferredPlatforms));
    } catch {
      // Cloud sync can still complete when browser storage is unavailable.
    }
    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          favoriteIds: preferences.favoriteIds,
          preferredPlatforms,
          notificationsEnabled: preferences.notificationsEnabled,
        }),
      });
      if (!response.ok) throw new Error("Preference sync unavailable.");
      const payload = await response.json() as { updatedAt?: string | null };
      setPreferences((current) => current ? { ...current, updatedAt: payload.updatedAt || current.updatedAt } : current);
      setPreferencesError(false);
      setPlatformSaveState("saved");
    } catch {
      setPlatformSaveState("offline");
    }
  };

  const signOut = async () => {
    setIsSigningOut(true);
    setNotice("");
    try {
      const authClient = await getAuthClient();
      await authClient.signOut();
      window.location.assign("/account");
    } catch {
      setNotice("登出服務暫時沒有回應，請稍後再試。你的收藏不會因此刪除。");
    } finally {
      setIsSigningOut(false);
    }
  };

  const linkGoogle = async () => {
    setGoogleLinkState("linking");
    setNotice("");
    try {
      const authClient = await getAuthClient();
      const result = await authClient.linkSocial({ provider: "google", callbackURL: "/account" });
      if (result.error) {
        setGoogleLinkState("not-linked");
        const message = result.error.message || "Google 帳號連結未完成。";
        setNotice(/already.*linked|linked.*different|account.*exists/i.test(message)
          ? "這個 Google 帳號可能已連到另一個 paymentrader 帳號。請先確認目前登入的 Email 帳號。"
          : "Google 帳號連結未完成，請確認 Neon Auth 已啟用 Google，並檢查網站網域與 OAuth 回呼設定。");
        return;
      }

      const accountsResult = await authClient.listAccounts();
      if (accountsResult.error) throw new Error(accountsResult.error.message);
      const isLinked = accountsResult.data?.some((account) => account.providerId === "google") || false;
      setGoogleLinkState(isLinked ? "linked" : "not-linked");
      setNotice(isLinked ? "Google 已成功連結至這個帳號。" : "授權流程已返回，但尚未確認 Google 已連結；請重新整理後檢查狀態。");
    } catch {
      setGoogleLinkState("unavailable");
      setNotice("目前無法確認 Google 連結狀態。請重新讀取帳號，並確認 Neon Auth 與 Google OAuth 設定。");
    }
  };

  const notificationLabel = browserPermission === "granted"
    ? "此裝置已允許"
    : browserPermission === "denied"
      ? "瀏覽器已封鎖"
      : browserPermission === "unsupported"
        ? "瀏覽器不支援"
        : "尚未啟用";

  return (
    <main className="account-page">
      <div className="account-shell">
        <header className="account-header">
          <Link className="account-brand" href="/" aria-label="回到 paymentrader 活動總覽">
            <Image src="/branding/paymentrader/paymentrader-option-05-final.png" width={32} height={32} alt="" unoptimized />
            <span>paymentrader</span>
          </Link>
          <Link className="account-home-link" href="/">回活動總覽</Link>
        </header>

        {isPending ? (
          <section className="account-gate" aria-live="polite">
            <span className="eyebrow">PERSONAL SPACE</span>
            <h1>正在載入個人專區</h1>
            <p>正在確認帳號與偏好同步狀態。</p>
            <Link className="account-back-link" href="/">返回活動總覽</Link>
          </section>
        ) : loadError ? (
          <section className="account-gate" aria-live="polite">
            <span className="eyebrow">ACCOUNT CONNECTION</span>
            <h1>暫時無法讀取帳號</h1>
            <p>登入服務沒有回應。你可以重新讀取，或先返回活動頁；不會因此刪除本機收藏。</p>
            <div className="account-actions">
              <button type="button" className="account-primary-action" onClick={() => void loadAccount()}>重新讀取</button>
              <Link className="account-secondary-action" href="/auth/sign-in?callbackURL=%2Faccount">重新登入</Link>
            </div>
          </section>
        ) : !user ? (
          <>
            <section className="account-gate account-welcome">
              <span className="eyebrow">PERSONAL SPACE</span>
              <h1>你的支付優惠專區</h1>
              <p>集中管理活動收藏、常用支付平台、瀏覽器提醒與跨裝置同步狀態。</p>
              <div className="account-preview-grid">
                <article><strong>收藏活動</strong><span>把重要優惠集中追蹤</span></article>
                <article><strong>平台偏好</strong><span>優先查看常用支付方式</span></article>
                <article><strong>同步狀態</strong><span>登入後延續個人設定</span></article>
              </div>
              <div className="account-actions">
                <Link className="account-primary-action" href="/auth/sign-in?callbackURL=%2Faccount">Google 或 Email 登入</Link>
                <Link className="account-secondary-action" href="/">先逛活動</Link>
              </div>
            </section>
          </>
        ) : (
          <div className="account-dashboard">
            <div className="account-heading">
              <span className="eyebrow">PERSONAL SPACE</span>
              <h1>個人使用專區</h1>
              <p>收藏、常用平台與裝置提醒，都在這裡快速查看。</p>
            </div>

            <section className="account-profile" aria-label="帳號資料">
              <span className="account-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
              <div className="account-profile-copy">
                <span className="account-status-label"><span className="status-light" />帳號已連線</span>
                <h2>{displayName}</h2>
                <p>{user.email}</p>
              </div>
              <span className="account-sync-summary">{preferencesError ? "同步暫不可用" : preferences?.updatedAt ? `最近同步 ${formatUpdatedAt(preferences.updatedAt)}` : "偏好尚未同步"}</span>
            </section>

            <section className="account-metrics" aria-label="個人設定摘要">
              <Link className="account-metric" href="/#favorites"><span>收藏活動</span><strong>{preferences?.favoriteIds.length ?? 0}</strong><small>查看我的最愛</small></Link>
              <Link className="account-metric" href="#account-platform-preferences"><span>常用平台</span><strong>{preferences?.preferredPlatforms.length ?? 0}</strong><small>編輯個人偏好</small></Link>
              <div className="account-metric"><span>瀏覽器提醒</span><strong className="account-metric-status">{notificationLabel}</strong><small>僅適用此裝置</small></div>
            </section>

            <div className="account-content-grid">
              <section className="account-section" aria-labelledby="account-favorites-title">
                <div className="account-section-heading">
                  <div><span className="eyebrow">WATCHLIST</span><h2 id="account-favorites-title">我的收藏</h2></div>
                  <Link href="/#favorites">全部收藏</Link>
                </div>
                <div className="account-favorites-overview">
                  <strong>{preferences?.favoriteIds.length ?? 0}</strong>
                  <p>{preferences?.favoriteIds.length ? "筆活動已收藏在你的帳號中。" : "目前還沒有收藏活動，回到活動清單點選愛心即可加入。"}</p>
                  <Link className="account-secondary-action" href="/#favorites">前往我的最愛</Link>
                </div>
              </section>

              <section className="account-section" id="account-platform-preferences" aria-labelledby="account-preferences-title">
                <div className="account-section-heading">
                  <div><span className="eyebrow">YOUR PREFERENCES</span><h2 id="account-preferences-title">常用平台</h2></div>
                  <span className="account-save-state" aria-live="polite">{platformSaveState === "saving" ? "同步中..." : platformSaveState === "saved" ? "已同步" : platformSaveState === "offline" ? "已保存在本機" : "點選切換"}</span>
                </div>
                <div className="account-platform-list" aria-label="選擇常用支付平台">
                  {platformOptions.map((platform) => {
                    const selected = preferences?.preferredPlatforms.includes(platform) || false;
                    return <button type="button" key={platform} className={selected ? "is-selected" : ""} aria-pressed={selected} disabled={preferencesError || platformSaveState === "saving"} onClick={() => void togglePreferredPlatform(platform)}>{platform}</button>;
                  })}
                </div>
                <p className="account-empty-note">已選平台會優先出現在活動清單。{preferencesError ? "雲端資料暫時無法讀取，先重新同步再調整可避免覆蓋收藏。" : "設定會同步到你的帳號，並保存在本機。"}</p>
                <div className="account-notification-row">
                  <div><strong>本裝置活動提醒</strong><small>瀏覽器權限需在每台裝置分別設定。</small></div>
                  <button type="button" className="account-secondary-action" onClick={() => void requestNotifications()} disabled={browserPermission === "granted" || browserPermission === "denied" || browserPermission === "unsupported"}>
                    {browserPermission === "granted" ? "已允許" : browserPermission === "denied" ? "查看瀏覽器設定" : browserPermission === "unsupported" ? "不支援" : "開啟提醒"}
                  </button>
                </div>
              </section>
            </div>

            <section className="account-security-row" aria-label="帳號管理">
              <div>
                <strong>帳號與安全</strong>
                <span>登出不會清除本機儲存的活動收藏。</span>
                <span className={`account-google-status is-${googleLinkState}`} role="status">
                  <span className="status-light" />
                  {googleLinkState === "checking" ? "正在確認 Google 連結狀態" : googleLinkState === "linked" ? "Google 已連結" : googleLinkState === "linking" ? "正在連結 Google..." : googleLinkState === "unavailable" ? "Google 連結狀態暫不可用" : "Google 尚未連結"}
                </span>
              </div>
              <div className="account-security-actions">
                {googleLinkState === "linked" ? <span className="account-google-connected">已連結</span> : <button type="button" className="account-secondary-action" onClick={() => void linkGoogle()} disabled={googleLinkState === "checking" || googleLinkState === "linking"}>{googleLinkState === "linking" ? "連結中..." : "連結 Google"}</button>}
                <button type="button" className="account-secondary-action" onClick={() => void signOut()} disabled={isSigningOut}>{isSigningOut ? "正在登出..." : "登出"}</button>
              </div>
            </section>
            {preferencesError ? <p className="account-inline-notice" role="status">雲端偏好暫時無法讀取，<button type="button" onClick={() => void loadAccount()}>重新同步</button></p> : null}
            {notice ? <p className="account-inline-notice" role="status">{notice}</p> : null}
          </div>
        )}
      </div>
    </main>
  );
}
