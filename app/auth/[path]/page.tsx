import { AuthForm } from "../AuthForm";

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  const mode = path === "sign-up" ? "sign-up" : "sign-in";
  const initialView = path === "forgot-password" || path === "reset-password" ? path : undefined;
  const panelHeading = path === "sign-up" ? "建立帳號" : path === "forgot-password" ? "找回密碼" : path === "reset-password" ? "設定新密碼" : "安全登入";

  return (
    <main className="auth-route-shell">
      <section className="auth-route-intro" aria-label="paymentrader 登入資訊">
        <img src="/branding/paymentrader/paymentrader-option-05-final.png" alt="paymentrader" className="auth-route-logo" />
        <span className="eyebrow">PAYMENT INTELLIGENCE</span>
        <h1>{path === "forgot-password" ? "安全找回你的帳號。" : path === "reset-password" ? "更新密碼，繼續追蹤優惠。" : "把你的支付偏好，帶到每一台裝置。"}</h1>
        <p>{path === "forgot-password" || path === "reset-password" ? "使用安全驗證連結設定新密碼；Google 帳號也可透過此流程設定 Email 密碼。" : "登入後，收藏活動與偏好平台會自動同步。Google 或 Email 都可以使用。"}</p>
      </section>
      <section className="auth-route-panel" aria-label="帳號登入">
        <div className="auth-route-panel-heading">
          <span className="auth-route-panel-kicker">paymentrader account</span>
          <strong>{panelHeading}</strong>
        </div>
        <AuthForm initialMode={mode} initialView={initialView} />
      </section>
    </main>
  );
}
