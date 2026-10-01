"use client";

import { useEffect, useMemo, useState } from "react";

type Audience = "new-user" | "existing-user" | "mixed" | "not-stated";

type Campaign = {
  title: string;
  category: string;
  stores: string[];
  paymentMethods?: string[];
  audience?: Audience;
  rate: number;
  cap: number;
  status: string;
  sourceUrl?: string;
  officialId?: string;
  image?: string;
  rawText?: string;
};

type PaymentSource = {
  name: string;
  logo: string;
  color: string;
  focus: string;
  freshness: string;
  campaigns: Campaign[];
};

type CampaignData = {
  updatedAt: string;
  source?: {
    name: string;
    url: string;
    officialSite: string;
    counts: Record<string, number>;
  };
  payments: PaymentSource[];
};

type Offer = Campaign & {
  payment: PaymentSource;
  rebate: number;
};

type IconName =
  | "search"
  | "grid"
  | "spark"
  | "layers"
  | "database"
  | "external"
  | "clock"
  | "wallet"
  | "user"
  | "info"
  | "check"
  | "sliders";

const fallbackData: CampaignData = {
  updatedAt: "",
  source: {
    name: "7-ELEVEN 官方活動 XML",
    url: "https://www.7-11.com.tw/include/SalesPromo.xml?12",
    officialSite: "https://www.7-11.com.tw/index.aspx",
    counts: {},
  },
  payments: [
    {
      name: "7-ELEVEN 官方活動",
      logo: "/logos/7-eleven.png",
      color: "#00a651",
      focus: "同步 7-ELEVEN 官網活動資料。",
      freshness: "等待匯入",
      campaigns: [],
    },
  ],
};

const quickTerms = ["明德正", "LINE Pay", "icash Pay", "OPENPOINT", "CITY CAFE", "咖啡", "飲料", "uniopen"];
const audienceChoices: Array<{ id: "all" | Audience; label: string }> = [
  { id: "all", label: "全部條件" },
  { id: "new-user", label: "新戶優先" },
  { id: "existing-user", label: "既有用戶" },
];

const paymentLogos: Record<string, string> = {
  "LINE Pay": "/logos/line-pay.svg",
  "icash Pay": "/logos/icash-pay.png",
  "街口支付": "/logos/jkos-pay.png",
  "台灣 Pay": "/logos/taiwan-pay.png",
  "iPASS MONEY": "/logos/ipass-money.png",
  "Pi 拍錢包": "/logos/pi-wallet.svg",
};

const audienceMeta: Record<Audience, { label: string; description: string; className: string }> = {
  "new-user": {
    label: "新戶條件",
    description: "官方文字提到新戶、新客或首次使用",
    className: "border-[#2f8a64]/20 bg-[#e8f6ed] text-[#276d50]",
  },
  "existing-user": {
    label: "既有用戶",
    description: "官方文字提到既有持有、續卡或原卡友",
    className: "border-[#3b82a0]/20 bg-[#e9f2fb] text-[#2b6088]",
  },
  mixed: {
    label: "條件分流",
    description: "官方文字同時提到不同使用者條件",
    className: "border-[#b9822b]/25 bg-[#fff3df] text-[#8b6122]",
  },
  "not-stated": {
    label: "官方未標示",
    description: "活動頁未明確寫新戶或既有用戶條件",
    className: "border-[#d5dfdc] bg-[#f3f6f5] text-[#66736f]",
  },
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="6.7" /><path d="m16 16 4.2 4.2" /></svg>;
    case "grid":
      return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1.2" /><rect x="14" y="4" width="6" height="6" rx="1.2" /><rect x="4" y="14" width="6" height="6" rx="1.2" /><rect x="14" y="14" width="6" height="6" rx="1.2" /></svg>;
    case "spark":
      return <svg {...common}><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></svg>;
    case "layers":
      return <svg {...common}><path d="m12 4 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4" /><path d="m4 16 8 4 8-4" /></svg>;
    case "database":
      return <svg {...common}><ellipse cx="12" cy="5.5" rx="7" ry="3" /><path d="M5 5.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /><path d="M5 11.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></svg>;
    case "external":
      return <svg {...common}><path d="M14 5h5v5" /><path d="m19 5-8 8" /><path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.3 2" /></svg>;
    case "wallet":
      return <svg {...common}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M4 8h14.5a1.5 1.5 0 0 1 0 3H16" /><circle cx="16.8" cy="9.5" r=".5" fill="currentColor" /></svg>;
    case "user":
      return <svg {...common}><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5" /></svg>;
    case "info":
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 10.5v5" /><path d="M12 7.5h.01" /></svg>;
    case "check":
      return <svg {...common}><path d="m5 12.5 4.2 4.2L19 7" /></svg>;
    case "sliders":
      return <svg {...common}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="8" cy="18" r="2" fill="currentColor" stroke="none" /></svg>;
  }
}

function BrandMark({ name, logo, color = "#ffffff" }: { name: string; logo?: string; color?: string }) {
  return (
    <span className="brand-mark" style={{ "--brand-color": color } as React.CSSProperties}>
      {logo ? <img src={logo} alt={`${name} logo`} /> : <Icon name="wallet" size={19} />}
    </span>
  );
}

function getRebate(spend: number, rate: number, cap: number) {
  if (!rate) return 0;
  const value = Math.round(spend * rate);
  return cap ? Math.min(value, cap) : value;
}

function getAudience(offer: Campaign): Audience {
  if (offer.audience) return offer.audience;
  const text = `${offer.title} ${offer.rawText || ""}`;
  const newUser = /新戶|新客|新會員|新申辦|首次|首刷|首筆|新卡友/i.test(text);
  const existingUser = /既有|原卡友|持卡人|續卡|老客|已持有/i.test(text);
  if (newUser && existingUser) return "mixed";
  if (newUser) return "new-user";
  if (existingUser) return "existing-user";
  return "not-stated";
}

function getPaymentMethods(offer: Campaign) {
  if (offer.paymentMethods?.length) return offer.paymentMethods;
  const text = `${offer.title} ${offer.rawText || ""}`;
  const patterns: Array<[string, RegExp]> = [
    ["LINE Pay", /line\s*pay/i],
    ["icash Pay", /icash\s*pay/i],
    ["街口支付", /街口(?:支付)?/i],
    ["台灣 Pay", /台灣\s*pay/i],
    ["iPASS MONEY", /iPASS\s*MONEY|一卡通\s*MONEY/i],
    ["Pi 拍錢包", /pi\s*拍錢包|拍錢包/i],
    ["Apple Pay", /apple\s*pay/i],
    ["Google Pay", /google\s*pay/i],
    ["OPEN錢包", /open\s*錢包/i],
  ];
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "尚未取得";
  return date.toLocaleString("zh-TW", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OfferCard({ offer }: { offer: Offer }) {
  const audience = audienceMeta[getAudience(offer)];
  const paymentMethods = getPaymentMethods(offer);
  const officialId = offer.officialId || offer.sourceUrl?.match(/[?&]item=([^&]+)/i)?.[1];

  return (
    <article className="glass-card overflow-hidden">
      {offer.image ? (
        <div className="offer-image">
          <img alt={offer.title} src={offer.image} loading="lazy" />
          <span className="image-label"><Icon name="database" size={13} /> 官方活動素材</span>
        </div>
      ) : null}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <BrandMark name={offer.payment.name} logo={offer.payment.logo} color={offer.payment.color} />
            <div className="min-w-0">
              <p className="eyebrow">{offer.category}</p>
              <h3 className="mt-1 text-xl font-semibold leading-tight tracking-[-0.02em] text-white">{offer.title}</h3>
            </div>
          </div>
          <span className="source-badge">官方</span>
        </div>

        <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-sm leading-6 text-white/65">
          <Icon name="clock" size={16} />
          <span>{offer.status}</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-y border-white/10 py-4 text-sm">
          <div>
            <p className="data-label">使用者條件</p>
            <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${audience.className}`} title={audience.description}>
              {audience.label}
            </span>
          </div>
          <div>
            <p className="data-label">支付方式線索</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {paymentMethods.length ? paymentMethods.map((method) => <span className="signal-pill" key={method}>{method}</span>) : <span className="text-xs text-white/45">官方未明確提及</span>}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="data-label">依目前消費額試算</p>
            <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[#cafa9b]">{offer.rebate ? `NT$ ${offer.rebate}` : "看活動條件"}</p>
          </div>
          <div className="text-right text-xs text-white/45">
            <p>推估比例</p>
            <p className="mt-1 text-sm font-semibold text-white/75">{offer.rate ? `${Math.round(offer.rate * 100)}%` : "未量化"}</p>
          </div>
        </div>

        {officialId ? <p className="mt-4 text-xs font-medium text-white/45">官方項目：{officialId}</p> : null}

        {offer.rawText ? (
          <details className="details-panel mt-5">
            <summary>查看完整活動條件</summary>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/70">{offer.rawText}</p>
          </details>
        ) : null}

        {offer.sourceUrl ? (
          <a className="primary-link mt-5" href={offer.sourceUrl} target="_blank" rel="noreferrer">
            開啟官方活動頁 <Icon name="external" size={15} />
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default function Home() {
  const [data, setData] = useState<CampaignData>(fallbackData);
  const [query, setQuery] = useState("");
  const [spend, setSpend] = useState(300);
  const [activeCategory, setActiveCategory] = useState("全部");
  const [activeAudience, setActiveAudience] = useState<"all" | Audience>("all");

  useEffect(() => {
    fetch(`/data/campaigns.json?t=${Date.now()}`)
      .then((response) => (response.ok ? response.json() : fallbackData))
      .then(setData)
      .catch(() => setData(fallbackData));
  }, []);

  const offers = useMemo<Offer[]>(() => {
    return data.payments.flatMap((payment) =>
      payment.campaigns.map((campaign) => ({
        ...campaign,
        payment,
        rebate: getRebate(spend, campaign.rate, campaign.cap),
      })),
    );
  }, [data, spend]);

  const categories = useMemo(() => ["全部", ...Array.from(new Set(offers.map((offer) => offer.category)))], [offers]);

  const filteredOffers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return offers
      .filter((offer) => activeCategory === "全部" || offer.category === activeCategory)
      .filter((offer) => {
        if (activeAudience === "all") return true;
        const audience = getAudience(offer);
        return audience === activeAudience || audience === "mixed";
      })
      .filter((offer) => {
        if (!keyword) return true;
        return [offer.title, offer.category, offer.payment.name, offer.status, ...offer.stores, ...getPaymentMethods(offer), offer.rawText || ""]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => b.rebate - a.rebate || b.rate - a.rate || a.title.localeCompare(b.title, "zh-Hant"));
  }, [activeAudience, activeCategory, offers, query]);

  const groupedOffers = useMemo(() => {
    return categories
      .filter((category) => category !== "全部")
      .map((category) => ({
        category,
        offers: filteredOffers.filter((offer) => offer.category === category),
      }))
      .filter((group) => group.offers.length > 0);
  }, [categories, filteredOffers]);

  const paymentSignals = useMemo(() => {
    const signalMap = new Map<string, { count: number; maxRate: number; bestTitle: string }>();
    offers.forEach((offer) => {
      getPaymentMethods(offer).forEach((method) => {
        const current = signalMap.get(method);
        if (!current || offer.rate > current.maxRate) {
          signalMap.set(method, { count: (current?.count || 0) + 1, maxRate: offer.rate, bestTitle: offer.title });
        } else {
          signalMap.set(method, { ...current, count: current.count + 1 });
        }
      });
    });
    return [...signalMap.entries()].sort((a, b) => b[1].count - a[1].count || b[1].maxRate - a[1].maxRate);
  }, [offers]);

  const best = filteredOffers[0];
  const source = data.source || fallbackData.source!;
  const updatedTime = formatUpdatedAt(data.updatedAt);
  const totalCount = offers.length;

  return (
    <main className="app-shell light-theme">
      <header className="topbar">
        <div className="topbar-inner">
          <a href="#overview" className="brand-lockup" aria-label="回饋雷達總覽">
            <span className="brand-orb"><Icon name="spark" size={19} /></span>
            <span>
              <strong>回饋雷達</strong>
              <small>PAYMENT INTELLIGENCE</small>
            </span>
          </a>
          <nav className="topnav" aria-label="主要導覽">
            <a className="active" href="#overview">總覽</a>
            <a href="#match">找回饋</a>
            <a href="#platforms">支付平台</a>
            <a href="#latest">最新優惠</a>
          </nav>
          <div className="topbar-status">
            <span className="status-light" />
            <span className="hidden sm:inline">官方資料同步</span>
          </div>
        </div>
      </header>

      <div className="app-layout">
        <aside className="side-rail">
          <div className="side-rail-inner">
            <div>
              <p className="rail-label">探索</p>
              <nav className="rail-nav" aria-label="頁面導覽">
                <a className="active" href="#overview"><Icon name="grid" size={17} />總覽</a>
                <a href="#match"><Icon name="search" size={17} />找回饋</a>
                <a href="#platforms"><Icon name="layers" size={17} />平台情報</a>
                <a href="#latest"><Icon name="database" size={17} />活動資料</a>
              </nav>
            </div>

            <div className="source-rail-card">
              <div className="flex items-center justify-between gap-3">
                <p className="rail-label">目前來源</p>
                <span className="source-dot" />
              </div>
              <div className="mt-5 flex items-center gap-3">
                <BrandMark name={data.payments[0]?.name || "7-ELEVEN"} logo={data.payments[0]?.logo} color={data.payments[0]?.color} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{data.payments[0]?.name || "7-ELEVEN"}</p>
                  <p className="mt-1 text-xs text-white/45">{totalCount} 筆官方活動</p>
                </div>
              </div>
              <a className="rail-link mt-5" href={source.officialSite} target="_blank" rel="noreferrer">查看官方網站 <Icon name="external" size={14} /></a>
            </div>

            <div className="rail-note">
              <Icon name="info" size={17} />
              <p>只顯示已從官方活動文字讀到的條件，沒有寫明的項目會標記為待確認。</p>
            </div>
          </div>
        </aside>

        <div className="content-column">
          <section id="overview" className="overview-section">
            <div className="overview-copy">
              <span className="kicker"><span className="kicker-line" />支付優惠情報站</span>
              <h1>今天怎麼付，<br /><span>回饋比較清楚。</span></h1>
              <p>把官方活動、使用門檻與支付方式放在同一個決策畫面。先輸入你的消費情境，再看哪一個回饋值得花時間研究。</p>
            </div>
            <div className="overview-metrics" aria-label="資料摘要">
              <div>
                <span>已同步來源</span>
                <strong>{data.payments.length}</strong>
                <small>目前以 7-ELEVEN 官方資料為第一個來源</small>
              </div>
              <div>
                <span>可查活動</span>
                <strong>{totalCount}</strong>
                <small>保留官方活動細項與原始連結</small>
              </div>
              <div>
                <span>最近更新</span>
                <strong className="metric-time">{updatedTime}</strong>
                <small>開啟官方頁確認最終名額與期限</small>
              </div>
            </div>
          </section>

          <section id="match" className="match-panel glass-panel">
            <div className="section-heading-row">
              <div>
                <span className="eyebrow"><Icon name="spark" size={14} />MATCH ENGINE</span>
                <h2>先告訴我你的消費情境</h2>
                <p>用店家、商品、支付工具或活動名稱搜尋，結果會依可試算回饋排序。</p>
              </div>
              <span className="control-hint"><Icon name="sliders" size={15} />條件即時重算</span>
            </div>

            <div className="match-inputs">
              <label className="field-block">
                <span>搜尋店家、支付、商品或活動</span>
                <div className="input-shell">
                  <Icon name="search" size={19} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：LINE Pay、咖啡、OPENPOINT" aria-label="搜尋店家、支付、商品或活動" />
                </div>
              </label>
              <label className="field-block spend-field">
                <span>預計消費金額</span>
                <div className="input-shell">
                  <span className="currency">NT$</span>
                  <input value={spend} onChange={(event) => setSpend(Math.max(0, Number(event.target.value) || 0))} min="0" type="number" inputMode="numeric" aria-label="預計消費金額" />
                </div>
              </label>
            </div>

            <div className="quick-searches">
              <span>快速搜尋</span>
              {quickTerms.map((term) => <button key={term} onClick={() => setQuery(term)} className={query === term ? "selected" : ""}>{term}</button>)}
            </div>

            <div className="audience-row">
              <div className="audience-label"><Icon name="user" size={16} /><span>使用者狀態</span><small>依官方文案判讀</small></div>
              <div className="segmented-control" role="group" aria-label="使用者狀態篩選">
                {audienceChoices.map((choice) => <button key={choice.id} className={activeAudience === choice.id ? "selected" : ""} onClick={() => setActiveAudience(choice.id)} aria-pressed={activeAudience === choice.id}>{choice.label}</button>)}
              </div>
            </div>
          </section>

          <section className="decision-grid" aria-label="回饋決策摘要">
            <div className="best-panel glass-panel">
              <div className="section-heading-row compact">
                <div>
                  <span className="eyebrow"><Icon name="check" size={14} />FIRST LOOK</span>
                  <h2>現在最值得先看</h2>
                </div>
                <span className="result-count">{filteredOffers.length} 筆符合</span>
              </div>
              {best ? (
                <div className="best-result">
                  <div className="best-result-top">
                    <div>
                      <p className="text-sm text-white/50">{best.payment.name} · {best.category}</p>
                      <h3>{best.title}</h3>
                    </div>
                    <BrandMark name={best.payment.name} logo={best.payment.logo} color={best.payment.color} />
                  </div>
                  <div className="best-result-divider" />
                  <div className="best-result-bottom">
                    <div>
                      <span className="data-label">本次消費可試算回饋</span>
                      <strong>{best.rebate ? `NT$ ${best.rebate}` : "需看活動條件"}</strong>
                    </div>
                    <div className="best-tags">
                      <span className={`audience-chip ${audienceMeta[getAudience(best)].className}`}>{audienceMeta[getAudience(best)].label}</span>
                      {getPaymentMethods(best).slice(0, 2).map((method) => <span className="signal-pill" key={method}>{method}</span>)}
                    </div>
                  </div>
                  {best.sourceUrl ? <a className="secondary-link mt-6" href={best.sourceUrl} target="_blank" rel="noreferrer">先看官方條件 <Icon name="external" size={15} /></a> : null}
                </div>
              ) : <div className="empty-result"><Icon name="search" size={22} /><p>沒有符合目前條件的活動，換一個關鍵字或回到全部條件。</p></div>}
            </div>

            <div id="platforms" className="signal-panel glass-panel">
              <div className="section-heading-row compact">
                <div>
                  <span className="eyebrow"><Icon name="wallet" size={14} />PAYMENT SIGNALS</span>
                  <h2>活動裡明確提到的支付方式</h2>
                </div>
                <span className="result-count">{paymentSignals.length} 個</span>
              </div>
              {paymentSignals.length ? (
                <div className="signal-list">
                  {paymentSignals.map(([method, signal]) => (
                    <button key={method} className="signal-row" onClick={() => setQuery(method)} title={`搜尋 ${method} 相關活動`}>
                      <BrandMark name={method} logo={paymentLogos[method]} color="#8de3b1" />
                      <span className="min-w-0 text-left"><strong>{method}</strong><small>{signal.count} 筆活動明確提及</small></span>
                      <span className="signal-rate">{signal.maxRate ? `${Math.round(signal.maxRate * 100)}%` : "看條件"}</span>
                    </button>
                  ))}
                </div>
              ) : <div className="empty-result"><Icon name="wallet" size={22} /><p>目前官方活動文字尚未明確點名支付方式。</p></div>}
              <p className="panel-footnote"><Icon name="info" size={14} />支付方式只在官方活動內容明確出現時列入，不把平台名稱當成活動證明。</p>
            </div>
          </section>

          <section id="latest" className="latest-section">
            <div className="latest-header">
              <div>
                <span className="eyebrow"><Icon name="database" size={14} />OFFICIAL CAMPAIGNS</span>
                <h2>最新優惠資料</h2>
                <p>每筆活動都可以展開完整細項，並直接回到官方活動頁確認期限、名額與排除條件。</p>
              </div>
              <a className="secondary-link" href={source.officialSite} target="_blank" rel="noreferrer">來源：{source.name} <Icon name="external" size={15} /></a>
            </div>

            <div className="category-tabs" role="tablist" aria-label="活動分類">
              {categories.map((category) => <button key={category} className={activeCategory === category ? "selected" : ""} onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category}>{category}<span>{category === "全部" ? totalCount : offers.filter((offer) => offer.category === category).length}</span></button>)}
            </div>

            {filteredOffers.length === 0 ? (
              <div className="empty-state glass-panel"><Icon name="search" size={24} /><h3>目前沒有符合的活動</h3><p>把使用者狀態切回「全部條件」，或換一個店家、商品與支付關鍵字。</p></div>
            ) : activeCategory !== "全部" ? (
              <div className="offer-grid">{filteredOffers.map((offer) => <OfferCard key={`${offer.payment.name}-${offer.title}`} offer={offer} />)}</div>
            ) : (
              <div className="category-groups">
                {groupedOffers.map((group) => <div key={group.category} className="category-group"><div className="category-heading"><h3>{group.category}</h3><span>{group.offers.length} 筆</span></div><div className="offer-grid">{group.offers.map((offer) => <OfferCard key={`${offer.payment.name}-${offer.title}`} offer={offer} />)}</div></div>)}
              </div>
            )}
          </section>

          <footer className="site-footer">
            <span>回饋雷達 · 以官方活動內容為準</span>
            <span>最後同步 {updatedTime}</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
