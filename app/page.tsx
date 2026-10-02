"use client";

import { useEffect, useMemo, useState } from "react";
import bundledCampaignData from "../public/data/campaigns.json";

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
  rewardLabel?: string;
  startsAt?: string;
  endsAt?: string;
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

type PlatformSegment = "daily" | "merchant" | "cross-network";

type PlatformInfo = {
  name: string;
  logo?: string;
  color: string;
  focus: string;
  segment?: PlatformSegment;
  officialSite: string;
  sourceUrl?: string;
  checkedAt?: string;
};

type CampaignData = {
  updatedAt: string;
  source?: {
    name: string;
    url: string;
    officialSite: string;
    counts: Record<string, number>;
  };
  sources?: Array<{
    name: string;
    url: string;
    officialSite: string;
    status?: string;
    checkedAt?: string;
  }>;
  platforms?: PlatformInfo[];
  payments: PaymentSource[];
};

type Offer = Campaign & {
  payment: PaymentSource;
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
  | "sliders"
  | "arrow-right";

const fallbackData: CampaignData = bundledCampaignData as CampaignData;

const paymentLogos: Record<string, string> = {
  "LINE Pay": "/logos/line-pay.svg",
  "icash Pay": "/logos/icash-pay.png",
  "街口支付": "/logos/jkos-pay.png",
  "台灣 Pay": "/logos/taiwan-pay.png",
  "iPASS MONEY": "/logos/ipass-money.png",
  "Pi 拍錢包": "/logos/pi-wallet.svg",
  "悠遊付": "/logos/easywallet.png",
  "全支付": "/logos/pxpay.png",
  "全盈+PAY": "/logos/pluspay.png",
  "OPEN錢包": "/logos/open-wallet.png",
  "橘子支付": "/logos/gama-pay.png",
  "歐付寶 O'Pay": "/logos/opay-icon.png",
  "ezPay 簡單付": "/logos/ezpay.png",
  "7-ELEVEN": "/logos/7-eleven.png",
};

const platformColors: Record<string, string> = {
  "LINE Pay": "#00c300",
  "icash Pay": "#e95e22",
  "街口支付": "#eb6a2a",
  "台灣 Pay": "#b22637",
  "iPASS MONEY": "#00a6d6",
  "Pi 拍錢包": "#ed6b31",
  "悠遊付": "#007c70",
  "全支付": "#5f49a6",
  "全盈+PAY": "#ef7d32",
  "OPEN錢包": "#ef5a24",
  "橘子支付": "#f58220",
  "歐付寶 O'Pay": "#1388c9",
  "ezPay 簡單付": "#1877b9",
  "7-ELEVEN": "#00a651",
};

const platformSegmentMeta: Record<PlatformSegment, { label: string; description: string }> = {
  daily: {
    label: "日常支付與交通",
    description: "通勤、餐飲、繳費與日常消費最常遇到的支付工具。",
  },
  merchant: {
    label: "通路與電商錢包",
    description: "電商、便利商店與指定品牌的高額回饋集中在這裡。",
  },
  "cross-network": {
    label: "銀行／跨通路支付",
    description: "銀行合作、TWQR 與跨店家支付活動，條件通常依通路而定。",
  },
};

const platformSegmentByName: Record<string, PlatformSegment> = {
  "LINE Pay": "daily",
  "街口支付": "daily",
  "悠遊付": "daily",
  "iPASS MONEY": "daily",
  "icash Pay": "daily",
  "Pi 拍錢包": "merchant",
  "全盈+PAY": "merchant",
  "全支付": "merchant",
  "OPEN錢包": "merchant",
  "台灣 Pay": "cross-network",
  "橘子支付": "cross-network",
  "歐付寶 O'Pay": "cross-network",
  "ezPay 簡單付": "cross-network",
  "7-ELEVEN": "merchant",
};

const platformSegmentOrder: PlatformSegment[] = ["daily", "merchant", "cross-network"];

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
    case "arrow-right":
      return <svg {...common}><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
  }
}

function BrandMark({ name, logo, color = "#ffffff" }: { name: string; logo?: string; color?: string }) {
  return (
    <span className="brand-mark" style={{ "--brand-color": color } as React.CSSProperties}>
      {logo ? <img src={logo} alt={`${name} logo`} /> : <span className="brand-initial" aria-hidden="true">{brandInitial(name)}</span>}
    </span>
  );
}

function brandInitial(name: string) {
  const initials: Record<string, string> = {
    "LINE Pay": "LINE",
    "街口支付": "街口",
    "悠遊付": "悠遊",
    "全支付": "全付",
    "全盈+PAY": "+PAY",
    "OPEN錢包": "OPEN",
    "橘子支付": "橘子",
    "歐付寶 O'Pay": "O",
    "ezPay 簡單付": "ez",
  };
  return initials[name] || name.slice(0, 2);
}

function paymentDisplayName(name: string) {
  return name.replace(/ 官方活動$/, "");
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
    ["悠遊付", /悠遊付|easywallet/i],
    ["全支付", /全支付|pxpay/i],
    ["全盈+PAY", /全盈\s*\+?\s*pay|pluspay/i],
    ["橘子支付", /橘子支付|gamapay/i],
    ["歐付寶 O'Pay", /歐付寶|o['’]?pay|opay/i],
    ["ezPay 簡單付", /ezpay|簡單付/i],
    ["7-ELEVEN", /7[-\s]?eleven|統一超商/i],
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

function rewardLabel(offer: Campaign) {
  if (offer.rewardLabel) return offer.rewardLabel;
  if (offer.rate > 0 && offer.cap > 0) return `最高 ${Math.round(offer.rate * 100)}%／上限 ${offer.cap.toLocaleString("zh-TW")} 元／點`;
  if (offer.rate > 0) return `最高 ${Math.round(offer.rate * 100)}% 回饋`;
  if (offer.cap > 0) return `最高 ${offer.cap.toLocaleString("zh-TW")} 元／點`;
  return "條件型回饋";
}

function compareOffers(a: Campaign, b: Campaign) {
  return (b.rate || 0) - (a.rate || 0) || (b.cap || 0) - (a.cap || 0) || a.title.localeCompare(b.title, "zh-Hant");
}

function OfferCard({ offer }: { offer: Offer }) {
  const audience = audienceMeta[getAudience(offer)];
  const paymentMethods = getPaymentMethods(offer);
  const officialId = offer.officialId || offer.sourceUrl?.match(/[?&]item=([^&]+)/i)?.[1];
  const paymentName = paymentDisplayName(offer.payment.name);
  const paymentLogo = offer.payment.logo || paymentLogos[paymentName];
  const paymentColor = offer.payment.color || platformColors[paymentName] || "#2e8b62";
  const storeSummary = offer.stores.length ? offer.stores.join(" · ") : "以官方活動頁列示通路為準";

  return (
    <article className="offer-card glass-card overflow-hidden">
      {offer.image ? (
        <div className="offer-image">
          <img alt={offer.title} src={offer.image} loading="lazy" />
          <span className="image-label"><Icon name="database" size={13} /> 官方活動素材</span>
        </div>
      ) : null}
      <div className="offer-card-body p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <BrandMark name={paymentName} logo={paymentLogo} color={paymentColor} />
            <div className="min-w-0">
              <div className="offer-type-row">
                <span className="offer-type-tag">{offer.category || "一般活動"}</span>
                <span className="offer-platform-label">{paymentName}</span>
              </div>
              <h3 className="offer-title">{offer.title}</h3>
            </div>
          </div>
          <span className="source-badge">官方</span>
        </div>

        <div className="offer-reward-row mt-5">
          <span className="reward-highlight"><Icon name="spark" size={14} />{rewardLabel(offer)}</span>
        </div>

        <div className="offer-info-grid">
          <div className="offer-info-item offer-info-wide">
            <p className="data-label">適用通路</p>
            <p className="offer-info-value">{storeSummary}</p>
          </div>
          <div className="offer-info-item">
            <p className="data-label">活動期間</p>
            <p className="offer-info-value offer-period"><Icon name="clock" size={15} />{offer.status}</p>
          </div>
          <div className="offer-info-item">
            <p className="data-label">適用對象</p>
            <span className={`offer-audience-chip ${audience.className}`} title={audience.description}>{audience.label}</span>
          </div>
          <div className="offer-info-item offer-info-wide">
            <p className="data-label">支付工具</p>
            <div className="offer-payment-list">
              {paymentMethods.length ? paymentMethods.map((method) => <span className="signal-pill" key={method}>{method}</span>) : <span className="offer-muted">官方未明確提及</span>}
            </div>
          </div>
        </div>

        <div className="activity-source-row mt-5">
          <div>
            <p className="data-label">官方資料來源</p>
            <p className="activity-source-name">{paymentName} 官方活動</p>
          </div>
          <span className="sync-tag"><Icon name="check" size={13} />已同步</span>
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
  const [activeCategory, setActiveCategory] = useState("全部");
  const [selectedPlatform, setSelectedPlatform] = useState("全部平台");
  const [sortMode, setSortMode] = useState<"reward" | "ending">("reward");

  useEffect(() => {
    fetch(`/data/campaigns.json?t=${Date.now()}`)
      .then((response) => (response.ok ? response.json() : fallbackData))
      .then(setData)
      .catch(() => setData(fallbackData));
  }, []);

  const offers = useMemo<Offer[]>(() => {
    return data.payments
      .flatMap((payment) =>
        payment.campaigns.map((campaign) => ({
          ...campaign,
          payment,
        })),
      )
      .sort(compareOffers);
  }, [data]);

  const categories = useMemo(() => ["全部", ...Array.from(new Set(offers.map((offer) => offer.category)))], [offers]);

  const filteredOffers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const matchingOffers = offers
      .filter((offer) => activeCategory === "全部" || offer.category === activeCategory)
      .filter((offer) => selectedPlatform === "全部平台" || offer.payment.name.replace(/ 官方活動$/, "") === selectedPlatform || getPaymentMethods(offer).includes(selectedPlatform))
      .filter((offer) => {
        if (!keyword) return true;
        return [offer.title, offer.category, offer.payment.name, offer.status, ...offer.stores, ...getPaymentMethods(offer), offer.rawText || ""]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      });
    if (sortMode === "ending") {
      return [...matchingOffers].sort((a, b) => {
        const aEnd = a.endsAt ? Date.parse(a.endsAt) : Number.POSITIVE_INFINITY;
        const bEnd = b.endsAt ? Date.parse(b.endsAt) : Number.POSITIVE_INFINITY;
        return (Number.isNaN(aEnd) ? Number.POSITIVE_INFINITY : aEnd) - (Number.isNaN(bEnd) ? Number.POSITIVE_INFINITY : bEnd) || compareOffers(a, b);
      });
    }
    return [...matchingOffers].sort(compareOffers);
  }, [activeCategory, offers, query, selectedPlatform, sortMode]);

  const platformCatalog = useMemo<PlatformInfo[]>(() => {
    if (data.platforms?.length) return data.platforms;
    return Array.from(new Set(offers.flatMap((offer) => getPaymentMethods(offer)))).map((name) => ({
      name,
      logo: paymentLogos[name],
      color: platformColors[name] || "#2e8b62",
      focus: "官方活動來源",
      officialSite: "",
    }));
  }, [data.platforms, offers]);

  const platformSummaries = useMemo(() => {
    return platformCatalog
      .map((platform) => {
        const platformOffers = offers.filter((offer) => getPaymentMethods(offer).includes(platform.name));
        const bestByCap = [...platformOffers].filter((offer) => offer.cap > 0).sort((a, b) => (b.cap || 0) - (a.cap || 0) || (b.rate || 0) - (a.rate || 0))[0];
        return {
          platform,
          offers: platformOffers,
          best: platformOffers[0],
          bestByCap,
        };
      })
      .sort((a, b) => {
        if (a.best && b.best) return compareOffers(a.best, b.best);
        if (a.best) return -1;
        if (b.best) return 1;
        return a.platform.name.localeCompare(b.platform.name, "zh-Hant");
      });
  }, [offers, platformCatalog]);

  const platformGroups = useMemo(() => {
    return platformSegmentOrder
      .map((segment) => ({
        segment,
        ...platformSegmentMeta[segment],
        items: platformSummaries.filter(({ platform }) => (platform.segment || platformSegmentByName[platform.name] || "cross-network") === segment),
      }))
      .filter((group) => group.items.length > 0);
  }, [platformSummaries]);

  const source = data.source || fallbackData.source!;
  const sourceLinks = (data.sources?.length ? data.sources : [source]).filter((sourceLink, index, all) => all.findIndex((item) => item.name === sourceLink.name) === index);
  const visibleSourceLinks = sourceLinks.slice(0, 6);
  const updatedTime = formatUpdatedAt(data.updatedAt);
  const totalCount = offers.length;
  const selectedPlatformSummary = selectedPlatform === "全部平台" ? null : platformSummaries.find(({ platform }) => platform.name === selectedPlatform);

  return (
    <main className="app-shell light-theme">
      <header className="topbar">
        <div className="topbar-inner">
          <a href="#latest" className="brand-lockup" aria-label="回饋雷達活動總覽">
            <span className="brand-orb"><Icon name="spark" size={19} /></span>
            <span>
              <strong>回饋雷達</strong>
              <small>PAYMENT OFFERS</small>
            </span>
          </a>
          <nav className="topnav" aria-label="主要導覽">
            <a className="active" href="#latest">活動總覽</a>
            <a href="#platforms">平台分類</a>
            <a href="#sources">官方入口</a>
          </nav>
          <div className="topbar-status">
            <span className="status-light" />
            <span className="hidden sm:inline">已同步</span>
            <time dateTime={data.updatedAt}>{updatedTime}</time>
          </div>
        </div>
      </header>

      <div className="app-layout">
        <div className="content-column">
          <section className="workspace-header" aria-labelledby="workspace-title">
            <div>
              <span className="kicker"><span className="kicker-line" />支付優惠情報站</span>
              <h1 id="workspace-title">有效活動總覽</h1>
              <p>先看回饋，再看條件。所有平台活動集中在同一份清單，可直接搜尋與篩選。</p>
            </div>
            <div className="workspace-actions">
              <a className="workspace-action" href="#platforms"><Icon name="layers" size={16} />平台分類</a>
              <a className="workspace-action is-primary" href="#latest"><Icon name="search" size={16} />找活動</a>
            </div>
          </section>

          <section id="latest" className="activity-workspace">
            <div className="workspace-section-heading">
              <div>
                <span className="eyebrow"><Icon name="database" size={14} />ACTIVE OFFERS</span>
                <h2>{selectedPlatformSummary ? selectedPlatformSummary.platform.name : "全部有效活動"}</h2>
                <p>按回饋高低排列，活動類型與使用條件直接寫在卡片上。</p>
              </div>
              <div className="workspace-count"><strong>{filteredOffers.length}</strong><span>筆活動</span></div>
            </div>

            <div className="activity-layout">
              <aside id="platforms" className="platform-directory glass-panel" aria-label="支付平台分類">
                <div className="directory-header">
                  <div>
                    <h3>支付平台</h3>
                    <p>選擇平台，立即查看對應活動</p>
                  </div>
                  <span>{platformSummaries.length} 個</span>
                </div>
                <div className="directory-scroll">
                  <button className={`platform-filter-button ${selectedPlatform === "全部平台" ? "selected" : ""}`} onClick={() => { setSelectedPlatform("全部平台"); setActiveCategory("全部"); }}>
                    <span className="directory-all-icon"><Icon name="grid" size={16} /></span>
                    <span><strong>全部平台</strong><small>{totalCount} 筆有效活動</small></span>
                    <Icon name="arrow-right" size={15} />
                  </button>
                  {platformGroups.map((group) => (
                    <div className="directory-group" key={group.segment}>
                      <div className="directory-group-heading"><span>{group.label}</span><small>{group.items.length}</small></div>
                      <div className="directory-list">
                        {group.items.map(({ platform, offers: platformOffers }) => (
                          <button key={platform.name} className={`platform-filter-button ${selectedPlatform === platform.name ? "selected" : ""}`} onClick={() => { setSelectedPlatform(platform.name); setActiveCategory("全部"); document.getElementById("latest")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} title={`篩選 ${platform.name} 活動`}>
                            <BrandMark name={platform.name} logo={platform.logo || paymentLogos[platform.name]} color={platform.color || platformColors[platform.name] || "#2e8b62"} />
                            <span><strong>{platform.name}</strong><small>{platformOffers.length ? `${platformOffers.length} 筆活動` : "官方入口已建立"}</small></span>
                            <span className={`directory-status ${platformOffers.length ? "is-active" : ""}`}>{platformOffers.length ? "有活動" : "索引"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              <div className="activity-results">
                <div className="activity-toolbar glass-panel">
                  <label className="field-block activity-search">
                    <span>搜尋活動、通路或平台</span>
                    <div className="input-shell">
                      <Icon name="search" size={19} />
                      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：咖啡、7-ELEVEN、iPASS MONEY" aria-label="搜尋活動、通路或平台" />
                    </div>
                  </label>
                  <label className="sort-control">
                    <span>排序方式</span>
                    <select value={sortMode} onChange={(event) => setSortMode(event.target.value as "reward" | "ending")} aria-label="排序方式">
                      <option value="reward">高回饋優先</option>
                      <option value="ending">即將截止優先</option>
                    </select>
                  </label>
                </div>

                <div className="active-filter-row">
                  <div className="category-tabs" role="tablist" aria-label="活動分類">
                    {categories.map((category) => <button key={category} className={activeCategory === category ? "selected" : ""} onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category}>{category}<span>{category === "全部" ? (selectedPlatform === "全部平台" ? totalCount : filteredOffers.length) : offers.filter((offer) => offer.category === category && (selectedPlatform === "全部平台" || offer.payment.name.replace(/ 官方活動$/, "") === selectedPlatform || getPaymentMethods(offer).includes(selectedPlatform))).length}</span></button>)}
                  </div>
                  {selectedPlatform !== "全部平台" || query ? <button className="clear-filter" onClick={() => { setSelectedPlatform("全部平台"); setQuery(""); setActiveCategory("全部"); }}><Icon name="check" size={14} />清除篩選</button> : null}
                </div>

                {filteredOffers.length === 0 ? (
                  <div className="empty-state glass-panel"><Icon name="search" size={24} /><h3>目前沒有符合的活動</h3><p>換一個平台或關鍵字，重新查看同步資料。</p></div>
                ) : (
                  <div className="offer-grid">{filteredOffers.map((offer) => <OfferCard key={`${offer.payment.name}-${offer.title}`} offer={offer} />)}</div>
                )}
              </div>
            </div>
            <p className="panel-footnote"><Icon name="info" size={14} />活動細項、名額與期限請以各平台、各通路的官方頁面為準。</p>
          </section>

          <section id="sources" className="sources-section">
            <div className="sources-heading">
              <div>
                <span className="eyebrow"><Icon name="external" size={14} />OFFICIAL SOURCES</span>
                <h2>官方入口</h2>
              </div>
              <p>資料由官方活動頁整理；點擊後可回到原頁確認最新規則。</p>
            </div>
            <div className="source-link-grid">
              {visibleSourceLinks.map((sourceLink) => <a className="source-link-card" href={sourceLink.officialSite || sourceLink.url} target="_blank" rel="noreferrer" key={sourceLink.url}><span><strong>{sourceLink.name}</strong><small>開啟官方活動入口</small></span><Icon name="external" size={16} /></a>)}
              {sourceLinks.length > visibleSourceLinks.length ? <span className="source-links-note">另有 {sourceLinks.length - visibleSourceLinks.length} 個官方來源</span> : null}
            </div>
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
