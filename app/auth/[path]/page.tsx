import { AuthView } from "@neondatabase/auth-ui";
import { authViewPaths, type AuthViewPath } from "@neondatabase/auth-ui/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;

  return (
    <main className="auth-route-shell">
      <section className="auth-route-intro" aria-label="paymentrader 登入資訊">
        <img src="/branding/paymentrader/paymentrader-option-05-final.png" alt="paymentrader" className="auth-route-logo" />
        <span className="eyebrow">PAYMENT INTELLIGENCE</span>
        <h1>把你的支付偏好，帶到每一台裝置。</h1>
        <p>登入後，收藏活動與偏好平台會自動同步。Google 或 Email 都可以使用。</p>
      </section>
      <section className="auth-route-panel" aria-label="帳號登入">
        <div className="auth-route-panel-heading">
          <span className="auth-route-panel-kicker">paymentrader account</span>
          <strong>安全登入</strong>
        </div>
        <AuthView path={path as AuthViewPath} />
      </section>
    </main>
  );
}

