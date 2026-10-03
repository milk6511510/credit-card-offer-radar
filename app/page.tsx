"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  publishedAt?: string;
  officialOrder?: number;
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

type HistoryConfidence = "exact" | "date-only" | "month-only";

type HistoryRecord = {
  id: string;
  platform: string;
  month: string;
  campaignTitle: string;
  merchant?: string;
  bank?: string;
  rewardLabel: string;
  rate?: number;
  cap?: number;
  exhaustedAt?: string;
  exhaustedDate?: string;
  exhaustedTime?: string;
  exhaustionType: "quota-full" | "ended" | "early-ended";
  confidence: HistoryConfidence;
  evidence: string;
  sourceUrl: string;
  source: "official";
};

type HistoryTrackGroup = {
  key: string;
  platform: string;
  merchant: string;
  campaignTitle: string;
  rewardLabel: string;
  records: HistoryRecord[];
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
  history?: HistoryRecord[];
};

type Offer = Campaign & {
  payment: PaymentSource;
};

type AppView = "latest" | "favorites" | "history";
type ActivityViewMode = "scan" | "detail";

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
  | "heart"
  | "bell"
  | "timeline"
  | "sliders"
  | "arrow-right"
  | "x";

const fallbackData: CampaignData = bundledCampaignData as CampaignData;
const FAVORITES_STORAGE_KEY = "paymentrader:favorites";
const LEGACY_FAVORITES_STORAGE_KEY = "reward-radar:favorites";
const PREFERRED_PLATFORMS_STORAGE_KEY = "paymentrader:preferred-platforms";
const LAST_SYNC_STORAGE_KEY = "paymentrader:last-sync";
const INITIAL_VISIBLE_OFFERS = 24;
type NotificationStatus = NotificationPermission | "unsupported";

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
    case "heart":
      return <svg {...common}><path d="M20.8 8.9c0 5.2-8.8 10.4-8.8 10.4S3.2 14.1 3.2 8.9A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.7Z" /></svg>;
    case "bell":
      return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
    case "timeline":
      return <svg {...common}><path d="M5 5v14" /><path d="M19 5v14" /><path d="M5 8h14" /><path d="M5 16h14" /><circle cx="5" cy="5" r="1.5" fill="currentColor" stroke="none" /><circle cx="19" cy="19" r="1.5" fill="currentColor" stroke="none" /><circle cx="19" cy="5" r="1.5" fill="currentColor" stroke="none" /><circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" /></svg>;
    case "sliders":
      return <svg {...common}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" /><circle cx="8" cy="18" r="2" fill="currentColor" stroke="none" /></svg>;
    case "arrow-right":
      return <svg {...common}><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
    case "x":
      return <svg {...common}><path d="m6 6 12 12" /><path d="m18 6-12 12" /></svg>;
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
  return name.replace(/\s*官方活動$/, "").trim();
}

function getOfferId(offer: Offer) {
  return [paymentDisplayName(offer.payment.name), offer.officialId || offer.sourceUrl || offer.title].join("::");
}

function getLegacyOfferIdPrefix(offer: Offer) {
  return `${paymentDisplayName(offer.payment.name)}::${offer.officialId || offer.sourceUrl || offer.title}::`;
}

function isOfferFavorite(offer: Offer, favoriteIds: string[]) {
  const stableId = getOfferId(offer);
  const legacyPrefix = getLegacyOfferIdPrefix(offer);
  return favoriteIds.some((favoriteId) => favoriteId === stableId || favoriteId.startsWith(legacyPrefix));
}

function belongsToPlatform(offer: Offer, platformName: string) {
  return paymentDisplayName(offer.payment.name) === platformName;
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

function formatHistoryMonth(value: string) {
  const [year, month] = String(value || "").split("-");
  return year && month ? `${year}/${month}` : "月份未標示";
}

function formatHistoryDate(record: HistoryRecord) {
  if (record.confidence === "month-only") return `${formatHistoryMonth(record.month)} 已額滿`;
  if (!record.exhaustedDate) return "尚未記錄";
  const date = record.exhaustedDate.replaceAll("-", "/");
  return `${date}${record.exhaustedTime ? ` ${record.exhaustedTime}` : "（時間未公布）"}`;
}

function formatHistoryTrackDate(record: HistoryRecord) {
  return record.exhaustedDate ? record.exhaustedDate.replaceAll("-", "/") : formatHistoryMonth(record.month);
}

function historyRecordSortValue(record: HistoryRecord) {
  return `${record.exhaustedDate || record.month} ${record.exhaustedTime || ""}`;
}

function taiwanDateKey() {
  const parts = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isObservedHistoryRecord(record: HistoryRecord) {
  return !record.exhaustedDate || record.exhaustedDate <= taiwanDateKey();
}

function normalizeHistoryCampaignTitle(record: HistoryRecord) {
  return record.campaignTitle.replace(/綁\s*[^｜|]+銀行\s*[｜|]/, "綁多家銀行｜");
}

function historyConfidenceLabel(confidence: HistoryConfidence) {
  if (confidence === "exact") return "官方公告到時間";
  if (confidence === "date-only") return "官方公告到日期";
  return "官方只公布月份";
}

function rewardLabel(offer: Campaign) {
  if (offer.rewardLabel) return offer.rewardLabel;
  if (offer.rate > 0 && offer.cap > 0) return `最高 ${Math.round(offer.rate * 100)}%／上限 ${offer.cap.toLocaleString("zh-TW")} 元／點`;
  if (offer.rate > 0) return `最高 ${Math.round(offer.rate * 100)}% 回饋`;
  if (offer.cap > 0) return `最高 ${offer.cap.toLocaleString("zh-TW")} 元／點`;
  return "條件型回饋";
}

function getActivityHighlights(offer: Campaign) {
  const normalizedTitle = offer.title.replace(/[。！？；;，,：:\s]+$/g, "");
  const fragments = (offer.rawText || "")
    .split(/(?<=[。！？；])|\n+/)
    .map((fragment) => fragment.replace(/\s+/g, " ").trim())
    .map((fragment) => fragment.replace(/^(?:活動方式|活動說明|優惠內容|回饋方式)\s*[:：]?\s*/i, "").trim())
    .filter((fragment) => fragment.length >= 8 && fragment.length <= 220)
    .filter((fragment) => !/^(?:活動期間|活動時間|詳細活動辦法|注意事項|不適用|排除|商品排除)/i.test(fragment))
    .filter((fragment) => fragment.replace(/[。！？；;，,：:\s]+$/g, "") !== normalizedTitle);

  const usefulFragments = fragments
    .filter((fragment) => /滿\s*[\d,]+|\d+\s*%|回饋|贈|送|折|券|每月|每筆|週[一二三四五六日]|前\s*\d+|綁定|登錄|首筆|首次|指定/i.test(fragment))
    .map((fragment, index) => {
      const score =
        (/(?:單筆|單次|每筆)?\s*滿\s*[\d,]+\s*(?:元|點)?/i.test(fragment) ? 6 : 0) +
        (/(?:\d+(?:\.\d+)?\s*%|回饋)/i.test(fragment) ? 4 : 0) +
        (/(?:每月|每筆|週[一二三四五六日]|前\s*\d+)/i.test(fragment) ? 3 : 0) +
        (/(?:上限|送完|額滿|綁定|登錄|首筆|首次|新戶|新客|指定)/i.test(fragment) ? 2 : 0) +
        (/(?:回饋|贈|送|折|券)/i.test(fragment) ? 2 : 0) -
        (/(?:客服|系統|不得|保留|資格認定|詳細活動辦法)/i.test(fragment) ? 3 : 0);
      return { fragment, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ fragment }) => fragment.replace(/^[，,；;：:\s]+|[，,；;：:\s]+$/g, ""));

  const unique = Array.from(new Set(usefulFragments));
  if (unique.length) return unique.slice(0, 2).map((fragment) => (fragment.length > 108 ? `${fragment.slice(0, 108)}…` : fragment));
  return [`${rewardLabel(offer)}；詳細條件請見官方活動頁`];
}

function compareOffers(a: Campaign, b: Campaign) {
  return (b.rate || 0) - (a.rate || 0) || (b.cap || 0) - (a.cap || 0) || a.title.localeCompare(b.title, "zh-Hant");
}

function compareLatestOffers(a: Campaign, b: Campaign) {
  const aOrder = Number.isFinite(a.officialOrder) ? a.officialOrder! : Number.POSITIVE_INFINITY;
  const bOrder = Number.isFinite(b.officialOrder) ? b.officialOrder! : Number.POSITIVE_INFINITY;
  return aOrder - bOrder || String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")) || a.title.localeCompare(b.title, "zh-Hant");
}

function CategoryScroller({
  categories,
  activeCategory,
  categoryCounts,
  onSelect,
}: {
  categories: string[];
  activeCategory: string;
  categoryCounts: Record<string, number>;
  onSelect: (category: string) => void;
}) {
  const allCategory = categories[0] === "全部" ? categories[0] : "全部";
  const scrollCategories = categories.filter((category) => category !== allCategory);
  const tabsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const categoryKey = categories.join("|");

  const updateScrollState = () => {
    const element = tabsRef.current;
    if (!element) return;
    setCanScrollLeft(element.scrollLeft > 4);
    setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 4);
  };

  useLayoutEffect(() => {
    updateScrollState();
    const element = tabsRef.current;
    if (!element) return;
    const refreshFrames = [requestAnimationFrame(updateScrollState), requestAnimationFrame(() => requestAnimationFrame(updateScrollState))];
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(element);
    element.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    document.fonts?.ready.then(updateScrollState);
    return () => {
      refreshFrames.forEach((frame) => cancelAnimationFrame(frame));
      resizeObserver.disconnect();
      element.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [categories.length, categoryKey]);

  const moveTabs = (direction: number) => {
    tabsRef.current?.scrollBy({ left: direction * Math.max(180, tabsRef.current.clientWidth * 0.7), behavior: "smooth" });
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button")) return;
    dragRef.current = { startX: event.clientX, startScrollLeft: event.currentTarget.scrollLeft, moved: false };
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const continueDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 5) {
      drag.moved = true;
      setIsDragging(true);
    }
    if (drag.moved) event.currentTarget.scrollLeft = drag.startScrollLeft - distance;
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setIsDragging(false);
  };

  return (
    <div className="category-strip">
      <button
        type="button"
        className={`category-all-button ${activeCategory === allCategory ? "selected" : ""}`}
        onClick={() => onSelect(allCategory)}
        aria-pressed={activeCategory === allCategory}
      >
        <span>全部活動</span>
        <small>{categoryCounts[allCategory] || 0}</small>
      </button>
      <button type="button" className="category-scroll-control is-backward" onClick={() => moveTabs(-1)} disabled={!canScrollLeft} aria-label="向左滑動活動分類" title="向左滑動活動分類">
        <Icon name="arrow-right" size={14} />
      </button>
      <div
        ref={tabsRef}
        className={`category-tabs${isDragging ? " is-dragging" : ""}`}
        role="tablist"
        aria-label="活動分類"
        onPointerDown={beginDrag}
        onPointerMove={continueDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        {scrollCategories.map((category) => (
          <button
            type="button"
            key={category}
            className={activeCategory === category ? "selected" : ""}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              onSelect(category);
            }}
            aria-pressed={activeCategory === category}
          >
            {category}<span>{categoryCounts[category] || 0}</span>
          </button>
        ))}
      </div>
      <button type="button" className="category-scroll-control is-forward" onClick={() => moveTabs(1)} disabled={!canScrollRight} aria-label="向右滑動活動分類" title="向右滑動活動分類">
        <Icon name="arrow-right" size={14} />
      </button>
    </div>
  );
}

function OfferCard({ offer, isFavorite, onToggleFavorite, viewMode }: { offer: Offer; isFavorite: boolean; onToggleFavorite: (offer: Offer) => void; viewMode: ActivityViewMode }) {
  const isNewUser = getAudience(offer) === "new-user";
  const newUserAudience = audienceMeta["new-user"];
  const paymentMethods = getPaymentMethods(offer);
  const activityHighlights = getActivityHighlights(offer);
  const paymentName = paymentDisplayName(offer.payment.name);
  const paymentLogo = offer.payment.logo || paymentLogos[paymentName];
  const paymentColor = offer.payment.color || platformColors[paymentName] || "#2e8b62";
  const storeSummary = offer.stores.length ? offer.stores.join(" · ") : "以官方活動頁列示通路為準";

  return (
    <article className={`offer-card offer-bar-card glass-card is-${viewMode}`}>
      <div className="offer-bar-main">
        <BrandMark name={paymentName} logo={paymentLogo} color={paymentColor} />
        <div className="offer-bar-identity">
          <div className="offer-type-row">
            <span className="offer-type-tag">{offer.category || "一般活動"}</span>
            <span className="offer-platform-label">{paymentName}</span>
          </div>
          <h3 className="offer-title">{offer.title}</h3>
          <p className="offer-bar-store"><Icon name="wallet" size={13} />{storeSummary}</p>
        </div>
        <div className="offer-bar-reward">
          <span className="reward-highlight"><Icon name="spark" size={14} />{rewardLabel(offer)}</span>
          <span className="offer-bar-period"><Icon name="clock" size={14} />{offer.status}</span>
        </div>
        <div className="offer-card-actions">
          <span className="source-badge">官方</span>
          <button
            type="button"
            className={`favorite-button${isFavorite ? " is-favorite" : ""}`}
            onClick={() => onToggleFavorite(offer)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `取消收藏 ${offer.title}` : `收藏 ${offer.title}`}
            title={isFavorite ? "取消我的最愛" : "加入我的最愛"}
          >
            <Icon name="heart" size={16} />
          </button>
        </div>
      </div>

      <div className="offer-bar-summary activity-summary" aria-label="活動精要">
        <div className="offer-bar-summary-label"><span className="data-label">活動精要</span>{isNewUser ? <span className={`offer-audience-chip ${newUserAudience.className}`} title={newUserAudience.description}>新戶優惠</span> : null}</div>
        <ul className="activity-summary-list">
          {activityHighlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
        </ul>
        {paymentMethods.length ? <div className="offer-payment-list offer-bar-payment-list">{paymentMethods.map((method) => <span className="signal-pill" key={method}>{method}</span>)}</div> : null}
      </div>

      <div className="offer-bar-footer">
        <span className="offer-bar-source"><Icon name="check" size={13} />{paymentName} 官方活動，已同步</span>
        <div className="offer-bar-actions">
          {offer.rawText ? (
            <details className="details-panel offer-bar-details">
              <summary><span className="details-long-label">查看完整條件</span><span className="details-short-label">完整條件</span></summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/70">{offer.rawText}</p>
            </details>
          ) : null}
          {offer.sourceUrl ? (
            <a className="primary-link offer-bar-link" href={offer.sourceUrl} target="_blank" rel="noreferrer">
              官方詳情 <Icon name="external" size={15} />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function HistoryTrackGroupCard({ group, compact = false }: { group: HistoryTrackGroup; compact?: boolean }) {
  const visibleRecords = group.records.slice(0, compact ? 5 : 3);
  const extraRecordCount = Math.max(0, group.records.length - visibleRecords.length);

  return (
    <article className={`history-track-card${compact ? " is-compact" : ""}`}>
      <div className="history-track-card-top">
        <span className="history-track-platform"><Icon name="clock" size={13} />{group.platform}</span>
        <span className="history-track-count">{group.records.length} 筆</span>
      </div>
      <h3>{group.campaignTitle}</h3>
      <p>{[group.merchant, group.rewardLabel].filter(Boolean).join(" · ") || "官方活動回饋"}</p>
      <div className="history-track-bank-list">
        {visibleRecords.map((record) => (
          <span className="history-track-bank" key={record.id} title={formatHistoryDate(record)}>
            <strong>{record.bank || "全通路"}</strong>
            <small>{formatHistoryTrackDate(record)}</small>
          </span>
        ))}
        {extraRecordCount ? <span className="history-track-more">+{extraRecordCount} 筆</span> : null}
      </div>
    </article>
  );
}

export default function Home() {
  const [data, setData] = useState<CampaignData>(fallbackData);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [preferredPlatforms, setPreferredPlatforms] = useState<string[]>([]);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>("unsupported");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部");
  const [selectedPlatform, setSelectedPlatform] = useState("全部平台");
  const [sortMode, setSortMode] = useState<"latest" | "reward" | "ending">("latest");
  const [activityViewMode, setActivityViewMode] = useState<ActivityViewMode>("scan");
  const [activeView, setActiveView] = useState<AppView>("latest");
  const [historyPlatform, setHistoryPlatform] = useState("全部平台");
  const [historyMonth, setHistoryMonth] = useState("全部月份");
  const [historyQuery, setHistoryQuery] = useState("");
  const [visibleOfferState, setVisibleOfferState] = useState({ key: "", count: INITIAL_VISIBLE_OFFERS });
  const favoriteIdsRef = useRef<string[]>([]);
  const notificationStatusRef = useRef<NotificationStatus>("unsupported");

  const isFavoritesView = activeView === "favorites";
  const isHistoryView = activeView === "history";

  useEffect(() => {
    const syncView = () => {
      const hash = window.location.hash.toLowerCase();
      setActiveView(hash === "#history" ? "history" : hash === "#favorites" ? "favorites" : "latest");
    };
    syncView();
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, []);

  useEffect(() => {
    if (activeView === "latest") return;
    requestAnimationFrame(() => document.getElementById(activeView)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [activeView]);

  useEffect(() => {
    const hydratePreferences = () => {
      try {
        const readStoredIds = (key: string) => {
          try {
            const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
            return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
          } catch {
            return [];
          }
        };
        const storedFavorites = Array.from(new Set([...readStoredIds(FAVORITES_STORAGE_KEY), ...readStoredIds(LEGACY_FAVORITES_STORAGE_KEY)]));
        const storedPreferredPlatforms = JSON.parse(window.localStorage.getItem(PREFERRED_PLATFORMS_STORAGE_KEY) || "[]");
        setFavoriteIds(storedFavorites);
        setPreferredPlatforms(Array.isArray(storedPreferredPlatforms) ? storedPreferredPlatforms.filter((value): value is string => typeof value === "string") : []);
        if ("Notification" in window) setNotificationStatus(Notification.permission);
      } catch {
        setFavoriteIds([]);
        setPreferredPlatforms([]);
      }
    };
    const hydrateTimer = window.setTimeout(hydratePreferences, 0);

    const syncFavorites = (event: StorageEvent) => {
      if (event.key !== FAVORITES_STORAGE_KEY && event.key !== LEGACY_FAVORITES_STORAGE_KEY) return;
      try {
        const next = JSON.parse(event.newValue || "[]");
        setFavoriteIds(Array.isArray(next) ? next.filter((value): value is string => typeof value === "string") : []);
      } catch {
        setFavoriteIds([]);
      }
    };
    const syncPreferredPlatforms = (event: StorageEvent) => {
      if (event.key !== PREFERRED_PLATFORMS_STORAGE_KEY) return;
      try {
        const next = JSON.parse(event.newValue || "[]");
        setPreferredPlatforms(Array.isArray(next) ? next.filter((value): value is string => typeof value === "string") : []);
      } catch {
        setPreferredPlatforms([]);
      }
    };
    window.addEventListener("storage", syncFavorites);
    window.addEventListener("storage", syncPreferredPlatforms);
    return () => {
      window.clearTimeout(hydrateTimer);
      window.removeEventListener("storage", syncFavorites);
      window.removeEventListener("storage", syncPreferredPlatforms);
    };
  }, []);

  useEffect(() => {
    favoriteIdsRef.current = favoriteIds;
  }, [favoriteIds]);

  useEffect(() => {
    notificationStatusRef.current = notificationStatus;
  }, [notificationStatus]);

  const offers = useMemo<Offer[]>(() => {
    return data.payments
      .flatMap((payment) =>
        payment.campaigns.map((campaign) => ({
          ...campaign,
          payment,
        })),
      );
  }, [data]);

  const syncCampaignData = () => {
    fetch(`/data/campaigns.json?t=${Date.now()}`)
      .then((response) => (response.ok ? response.json() : fallbackData))
      .then((nextData: CampaignData) => {
        const previousSync = window.localStorage.getItem(LAST_SYNC_STORAGE_KEY);
        const hasChanged = Boolean(previousSync && previousSync !== nextData.updatedAt);
        setData(nextData);
        window.localStorage.setItem(LAST_SYNC_STORAGE_KEY, nextData.updatedAt);
        if (hasChanged && favoriteIdsRef.current.length && notificationStatusRef.current === "granted") {
          new Notification("回饋雷達：追蹤活動有更新", { body: "你收藏的活動清單可能有新內容，點開我的最愛查看。" });
        }
      })
      .catch(() => setData(fallbackData));
  };

  useEffect(() => {
    syncCampaignData();
    const refreshTimer = window.setInterval(syncCampaignData, 15 * 60 * 1000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  const categories = useMemo(() => {
    const scopedOffers = isFavoritesView ? offers.filter((offer) => isOfferFavorite(offer, favoriteIds)) : offers;
    const platformOffers = scopedOffers.filter((offer) => selectedPlatform === "全部平台" || belongsToPlatform(offer, selectedPlatform));
    return ["全部", ...Array.from(new Set(platformOffers.map((offer) => offer.category).filter(Boolean)))];
  }, [favoriteIds, isFavoritesView, offers, selectedPlatform]);

  const categoryCounts = useMemo(() => {
    const scopedOffers = isFavoritesView ? offers.filter((offer) => isOfferFavorite(offer, favoriteIds)) : offers;
    const platformOffers = scopedOffers.filter((offer) => selectedPlatform === "全部平台" || belongsToPlatform(offer, selectedPlatform));
    return Object.fromEntries(categories.map((category) => [category, category === "全部" ? platformOffers.length : platformOffers.filter((offer) => offer.category === category).length]));
  }, [categories, favoriteIds, isFavoritesView, offers, selectedPlatform]);

  const filteredOffers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const scopedOffers = isFavoritesView ? offers.filter((offer) => isOfferFavorite(offer, favoriteIds)) : offers;
    const matchingOffers = scopedOffers
      .filter((offer) => activeCategory === "全部" || offer.category === activeCategory)
      .filter((offer) => selectedPlatform === "全部平台" || belongsToPlatform(offer, selectedPlatform))
      .filter((offer) => {
        if (!keyword) return true;
        return [offer.title, offer.category, offer.payment.name, offer.status, ...offer.stores, ...getPaymentMethods(offer), offer.rawText || ""]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      });
    const preferenceRank = (offer: Offer) => {
      const rank = preferredPlatforms.indexOf(paymentDisplayName(offer.payment.name));
      return rank === -1 ? preferredPlatforms.length : rank;
    };
    const comparePersonalized = (a: Offer, b: Offer) => preferenceRank(a) - preferenceRank(b);

    if (sortMode === "ending") {
      return [...matchingOffers].sort((a, b) => {
        const preferenceComparison = comparePersonalized(a, b);
        if (preferenceComparison) return preferenceComparison;
        const aEnd = a.endsAt ? Date.parse(a.endsAt) : Number.POSITIVE_INFINITY;
        const bEnd = b.endsAt ? Date.parse(b.endsAt) : Number.POSITIVE_INFINITY;
        return (Number.isNaN(aEnd) ? Number.POSITIVE_INFINITY : aEnd) - (Number.isNaN(bEnd) ? Number.POSITIVE_INFINITY : bEnd) || compareOffers(a, b);
      });
    }
    return [...matchingOffers].sort((a, b) => comparePersonalized(a, b) || (sortMode === "reward" ? compareOffers(a, b) : compareLatestOffers(a, b)));
  }, [activeCategory, favoriteIds, isFavoritesView, offers, preferredPlatforms, query, selectedPlatform, sortMode]);

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
        const platformOffers = offers.filter((offer) => belongsToPlatform(offer, platform.name));
        const bestByCap = [...platformOffers].filter((offer) => offer.cap > 0).sort((a, b) => (b.cap || 0) - (a.cap || 0) || (b.rate || 0) - (a.rate || 0))[0];
        return {
          platform,
          offers: platformOffers,
          best: [...platformOffers].sort(compareOffers)[0],
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
  const favoriteOfferCount = offers.filter((offer) => isOfferFavorite(offer, favoriteIds)).length;
  const selectedPlatformSummary = selectedPlatform === "全部平台" ? null : platformSummaries.find(({ platform }) => platform.name === selectedPlatform);
  const historyRecords = useMemo(() => {
    return [...(data.history || [])].filter(isObservedHistoryRecord).sort((a, b) => {
      return historyRecordSortValue(b).localeCompare(historyRecordSortValue(a)) || a.platform.localeCompare(b.platform, "zh-Hant");
    });
  }, [data.history]);
  const historyTrackGroups = useMemo<HistoryTrackGroup[]>(() => {
    const groups = new Map<string, HistoryTrackGroup>();
    historyRecords.forEach((record) => {
      const campaignTitle = normalizeHistoryCampaignTitle(record);
      const key = [record.platform, record.merchant || "", record.rewardLabel, campaignTitle].join("|");
      const current = groups.get(key);
      if (current) {
        current.records.push(record);
        return;
      }
      groups.set(key, {
        key,
        platform: record.platform,
        merchant: record.merchant || "",
        campaignTitle,
        rewardLabel: record.rewardLabel,
        records: [record],
      });
    });
    return Array.from(groups.values())
      .map((group) => ({ ...group, records: [...group.records].sort((a, b) => historyRecordSortValue(b).localeCompare(historyRecordSortValue(a))) }))
      .sort((a, b) => historyRecordSortValue(b.records[0]).localeCompare(historyRecordSortValue(a.records[0])) || a.platform.localeCompare(b.platform, "zh-Hant"));
  }, [historyRecords]);
  const historyPlatforms = useMemo(() => Array.from(new Set(historyRecords.map((record) => record.platform))).sort((a, b) => a.localeCompare(b, "zh-Hant")), [historyRecords]);
  const historyMonths = useMemo(() => Array.from(new Set(historyRecords.map((record) => record.month))).sort((a, b) => b.localeCompare(a)), [historyRecords]);
  const filteredHistoryRecords = useMemo(() => {
    const keyword = historyQuery.trim().toLowerCase();
    return historyRecords.filter((record) => {
      if (historyPlatform !== "全部平台" && record.platform !== historyPlatform) return false;
      if (historyMonth !== "全部月份" && record.month !== historyMonth) return false;
      if (!keyword) return true;
      return [record.platform, record.month, record.campaignTitle, record.merchant || "", record.bank || "", record.rewardLabel, record.evidence]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [historyMonth, historyPlatform, historyQuery, historyRecords]);
  const exactHistoryCount = historyRecords.filter((record) => record.confidence === "exact").length;
  const monthOnlyHistoryCount = historyRecords.filter((record) => record.confidence === "month-only").length;
  const historyMonthCount = new Set(historyRecords.map((record) => record.month)).size;
  const choosePlatform = (platformName: string) => {
    setSelectedPlatform(platformName);
    setActiveCategory("全部");
    setQuery("");
    setFiltersOpen(false);
    if (activeView === "history") {
      window.location.hash = "latest";
      return;
    }
    document.getElementById(activeView === "favorites" ? "favorites" : "latest")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filterSignature = `${activeCategory}|${isFavoritesView ? "favorites" : "all"}|${query.trim()}|${selectedPlatform}|${sortMode}|${data.updatedAt}`;
  const visibleOfferCount = visibleOfferState.key === filterSignature ? visibleOfferState.count : INITIAL_VISIBLE_OFFERS;
  const visibleOffers = filteredOffers.slice(0, visibleOfferCount);
  const remainingOfferCount = Math.max(0, filteredOffers.length - visibleOffers.length);
  const activeFilterCount = (selectedPlatform !== "全部平台" ? 1 : 0) + (activeCategory !== "全部" ? 1 : 0) + (query.trim() ? 1 : 0);

  const jumpToHistoryRecords = () => {
    const scrollToRecords = () => document.getElementById("history-records")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.location.hash !== "#history") {
      window.location.hash = "history";
      window.setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(scrollToRecords)), 260);
      return;
    }
    scrollToRecords();
  };

  const toggleFavorite = (offer: Offer) => {
    const id = getOfferId(offer);
    setFavoriteIds((current) => {
      const next = isOfferFavorite(offer, current)
        ? current.filter((favoriteId) => favoriteId !== id && !favoriteId.startsWith(getLegacyOfferIdPrefix(offer)))
        : [...current, id];
      try {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Browser storage may be unavailable in private browsing contexts.
      }
      return next;
    });
  };

  const togglePreferredPlatform = (platformName: string) => {
    setPreferredPlatforms((current) => {
      const next = current.includes(platformName)
        ? current.filter((name) => name !== platformName)
        : [...current, platformName];
      try {
        window.localStorage.setItem(PREFERRED_PLATFORMS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Browser storage may be unavailable in private browsing contexts.
      }
      return next;
    });
  };

  const clearPreferredPlatforms = () => {
    setPreferredPlatforms([]);
    try {
      window.localStorage.removeItem(PREFERRED_PLATFORMS_STORAGE_KEY);
    } catch {
      // Browser storage may be unavailable in private browsing contexts.
    }
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setNotificationStatus("unsupported");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      if (permission === "granted") {
        new Notification("回饋雷達通知已開啟", { body: "追蹤活動同步更新時，會在此瀏覽器提醒你。" });
      }
    } catch {
      setNotificationStatus("denied");
    }
  };

  const notificationLabel = notificationStatus === "granted"
    ? "通知已開啟"
    : notificationStatus === "denied"
      ? "通知已封鎖"
      : notificationStatus === "unsupported"
        ? "瀏覽器不支援通知"
        : "開啟更新通知";
  const notificationDisabled = notificationStatus !== "default";

  return (
    <main className="app-shell light-theme">
      <header className="topbar">
        <div className="topbar-inner">
          <a href="#latest" className="brand-lockup" aria-label="paymentrader 活動總覽">
            <img className="paymentrader-mark" src="/branding/paymentrader/paymentrader-option-05-final.png" alt="" />
            <span className="paymentrader-wordmark"><strong>paymentrader</strong><small>PAYMENT INTELLIGENCE</small></span>
          </a>
          <nav className="topnav" aria-label="主要導覽">
            <a className={activeView === "latest" ? "active" : ""} href="#latest" aria-current={activeView === "latest" ? "page" : undefined}>活動總覽</a>
            <a href="#platforms">平台分類</a>
            <a className={isFavoritesView ? "active" : ""} href="#favorites" aria-current={isFavoritesView ? "page" : undefined}>我的最愛{favoriteOfferCount ? <span className="nav-count">{favoriteOfferCount}</span> : null}</a>
            <a className={isHistoryView ? "active" : ""} href="#history" aria-current={isHistoryView ? "page" : undefined}>歷史回饋</a>
            <a href="#sources">官方入口</a>
          </nav>
          <div className="topbar-actions">
            <div className="topbar-status" aria-label={`官方資料同步 ${updatedTime}`} title="官方活動資料最後同步時間">
              <span className="status-light" />
              <span className="hidden sm:inline">官方資料同步</span>
              <time dateTime={data.updatedAt}>{updatedTime}</time>
            </div>
            {!isHistoryView ? (
              <button type="button" className={`topbar-filter-button${filtersOpen ? " is-open" : ""}`} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-controls="platform-filter-panel">
                <Icon name="sliders" size={15} />
                <span>平台分類</span>
                {activeFilterCount ? <b>{activeFilterCount}</b> : null}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="app-layout">
        <div className="content-column">
          <section className="workspace-header" aria-labelledby="workspace-title">
            <div className="workspace-header-copy">
              <span className="kicker"><span className="kicker-line" />paymentrader / 支付優惠情報站</span>
              <h1 id="workspace-title">{isHistoryView ? "歷史回饋紀錄" : isFavoritesView ? "我的最愛" : "有效活動總覽"}</h1>
              <p>{isHistoryView ? "回看官方曾公告的額滿日期與時間，作為下次安排回饋的參考。" : isFavoritesView ? "集中查看你正在追蹤的活動，資料同步後更快確認變化。" : "先看回饋，再看條件。所有平台活動集中在同一份清單，可直接搜尋與篩選。"}</p>
            </div>
            <div className="workspace-header-tools">
              <div className="workspace-actions">
                <a className="workspace-action" href={isFavoritesView ? "#latest" : "#favorites"}><Icon name={isFavoritesView ? "search" : "heart"} size={16} />{isFavoritesView ? "全部活動" : "我的最愛"}</a>
                <a className="workspace-action" href="#history"><Icon name="clock" size={16} />歷史耗盡</a>
                <button type="button" className={`workspace-action${preferencesOpen ? " is-selected" : ""}`} onClick={() => setPreferencesOpen((open) => !open)} aria-expanded={preferencesOpen} aria-controls="local-preferences"><Icon name="sliders" size={16} />偏好平台</button>
              </div>
            </div>
          </section>

          <section className="history-trail-preview" aria-labelledby="history-trail-preview-title">
            <div className="history-trail-preview-heading">
              <div className="history-trail-title-wrap">
                <span className="history-trail-icon"><Icon name="timeline" size={19} /></span>
                <div>
                  <span className="eyebrow">HISTORY TRACK</span>
                  <h2 id="history-trail-preview-title">歷史耗盡軌跡</h2>
                  <p>把同一活動的銀行與額滿日期收在一起，先看趨勢，再進完整紀錄。</p>
                </div>
              </div>
              <button type="button" className="history-trail-jump" onClick={jumpToHistoryRecords}>
                <span>查看完整紀錄</span><Icon name="arrow-right" size={15} />
              </button>
            </div>
            <div className="history-trail-metrics" aria-label="歷史耗盡摘要">
              <span><strong>{historyTrackGroups.length}</strong> 個活動軌跡</span>
              <span><strong>{historyRecords.length}</strong> 筆官方紀錄</span>
              <span><strong>{exactHistoryCount ? "日期／時間" : "日期"}</strong> 優先保留</span>
            </div>
            {historyTrackGroups.length ? (
              <div className="history-track-grid history-track-grid-preview">
                {historyTrackGroups.slice(0, 3).map((group) => <HistoryTrackGroupCard group={group} key={group.key} />)}
              </div>
            ) : (
              <p className="history-trail-empty">目前尚未收集到官方額滿紀錄。</p>
            )}
          </section>

          <section id={isFavoritesView ? "favorites" : "latest"} className={`activity-workspace${isHistoryView ? " app-view-hidden" : ""}`}>
            <div className="workspace-section-heading">
              <div>
                <span className="eyebrow"><Icon name={isFavoritesView ? "heart" : "database"} size={14} />{isFavoritesView ? "TRACKED OFFERS" : "ACTIVE OFFERS"}</span>
                <h2>{isFavoritesView ? "我的最愛" : selectedPlatformSummary ? selectedPlatformSummary.platform.name : "全部有效活動"}</h2>
                <p>{isFavoritesView ? "你收藏的活動會留在這裡，點卡片上的愛心即可取消追蹤。" : preferredPlatforms.length ? `優先顯示 ${preferredPlatforms.join("、")}，再依官方更新順序排列。` : "按回饋高低排列，活動類型與使用條件直接寫在卡片上。"}</p>
              </div>
              <div className="workspace-count"><strong>{filteredOffers.length}</strong><span>{isFavoritesView ? "筆收藏" : "筆活動"}</span></div>
            </div>

            <div className={`favorites-strip glass-panel${isFavoritesView ? " is-active" : ""}`}>
              <span className="favorites-strip-icon"><Icon name="heart" size={20} /></span>
              <div className="favorites-strip-copy">
                <span className="eyebrow">MY WATCHLIST</span>
                <strong>我的最愛</strong>
                <p>{favoriteOfferCount ? `已追蹤 ${favoriteOfferCount} 筆活動，資料會保留在這部裝置。` : "在活動卡片點選愛心，就能把重要活動集中在這裡。"}</p>
              </div>
              <div className="favorites-strip-actions">
                <button type="button" className="favorites-notification" onClick={enableNotifications} disabled={notificationDisabled} title="允許此瀏覽器在活動資料更新時提醒你">
                  <Icon name="bell" size={15} />{notificationLabel}
                </button>
                <a className="favorites-strip-link" href={isFavoritesView ? "#latest" : "#favorites"}>
                  {isFavoritesView ? "繼續找活動" : "查看收藏"}<Icon name="arrow-right" size={14} />
                </a>
              </div>
            </div>

            {preferencesOpen ? (
              <section id="local-preferences" className="local-preferences glass-panel" aria-labelledby="local-preferences-title">
                <div className="local-preferences-heading">
                  <div>
                    <span className="eyebrow"><Icon name="sliders" size={14} />DEVICE PROFILE</span>
                    <h3 id="local-preferences-title">本機偏好</h3>
                    <p>選定平台後，新的活動會優先出現在清單前段。資料只保存在這部裝置的瀏覽器。</p>
                  </div>
                  <span className="local-save-badge"><Icon name="check" size={13} />僅本機</span>
                </div>
                <div className="preference-platforms">
                  {platformCatalog.map((platform) => {
                    const platformName = paymentDisplayName(platform.name);
                    const selected = preferredPlatforms.includes(platformName);
                    return (
                      <button type="button" key={platformName} className={`preference-platform${selected ? " selected" : ""}`} onClick={() => togglePreferredPlatform(platformName)} aria-pressed={selected}>
                        <BrandMark name={platformName} logo={platform.logo || paymentLogos[platformName]} color={platform.color || platformColors[platformName] || "#2e8b62"} />
                        <span>{platformName}</span>
                        {selected ? <Icon name="check" size={14} /> : null}
                      </button>
                    );
                  })}
                </div>
                <div className="local-preferences-footer">
                  <span>{preferredPlatforms.length ? `已優先顯示 ${preferredPlatforms.join("、")}` : "尚未指定平台，依官方更新順序顯示"}</span>
                  {preferredPlatforms.length ? <button type="button" className="clear-preferences" onClick={clearPreferredPlatforms}>清除偏好</button> : null}
                </div>
              </section>
            ) : null}

            <div className="activity-layout">
              <div id="platforms" className="activity-results">
                <div className="activity-toolbar glass-panel">
                  <label className="field-block activity-search">
                    <span>搜尋活動、通路或平台</span>
                    <div className="input-shell">
                      <Icon name="search" size={19} />
                      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：咖啡、7-ELEVEN、iPASS MONEY" aria-label="搜尋活動、通路或平台" />
                    </div>
                  </label>
                  <div className="activity-toolbar-controls">
                    <div className="activity-view-switch" role="group" aria-label="活動資訊顯示方式">
                      <button type="button" className={activityViewMode === "scan" ? "selected" : ""} onClick={() => setActivityViewMode("scan")} aria-pressed={activityViewMode === "scan"} title="只顯示回饋、期限與一行活動精要">
                        <Icon name="layers" size={14} />
                        <span>快速瀏覽</span>
                      </button>
                      <button type="button" className={activityViewMode === "detail" ? "selected" : ""} onClick={() => setActivityViewMode("detail")} aria-pressed={activityViewMode === "detail"} title="顯示更多活動摘要與支付方式">
                        <Icon name="database" size={14} />
                        <span>完整資訊</span>
                      </button>
                    </div>
                    <label className="sort-control">
                      <span>排序方式</span>
                      <select value={sortMode} onChange={(event) => setSortMode(event.target.value as "latest" | "reward" | "ending")} aria-label="排序方式">
                        <option value="latest">官方更新順序</option>
                        <option value="reward">高回饋優先</option>
                        <option value="ending">即將截止優先</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="active-filter-row">
                  <div className="desktop-category-filter">
                    <CategoryScroller categories={categories} activeCategory={activeCategory} categoryCounts={categoryCounts} onSelect={setActiveCategory} />
                  </div>
                  <div className="active-filter-summary" aria-live="polite">
                    <span>顯示 {Math.min(visibleOfferCount, filteredOffers.length)} / {filteredOffers.length} 筆</span>
                    <strong>{selectedPlatform}</strong>
                    {activeCategory !== "全部" ? <em>{activeCategory}</em> : null}
                    {query.trim() ? <em>搜尋：{query.trim()}</em> : null}
                  </div>
                  {activeFilterCount ? <button type="button" className="clear-filter" onClick={() => choosePlatform("全部平台")}><Icon name="check" size={14} />清除篩選</button> : null}
                </div>

                {filtersOpen ? (
                  <>
                    <button type="button" className="filter-popover-backdrop" onClick={() => setFiltersOpen(false)} aria-label="關閉篩選選單" />
                    <section id="platform-filter-panel" className="filter-popover glass-panel" role="dialog" aria-modal="true" aria-labelledby="platform-filter-title">
                      <div className="filter-popover-header">
                        <div>
                          <span className="eyebrow"><Icon name="layers" size={14} />DISCOVERY FILTER</span>
                          <h3 id="platform-filter-title">平台與分類</h3>
                          <p>選一個平台，活動清單會立即重新整理。</p>
                        </div>
                        <button type="button" className="filter-close" onClick={() => setFiltersOpen(false)} aria-label="關閉篩選選單"><Icon name="x" size={18} /></button>
                      </div>
                      <div className="filter-popover-section">
                        <div className="filter-section-heading"><strong>支付平台</strong><span>{platformSummaries.length} 個平台</span></div>
                        <div className="filter-platform-list">
                          <button type="button" className={`platform-filter-button ${selectedPlatform === "全部平台" ? "selected" : ""}`} onClick={() => choosePlatform("全部平台")} aria-pressed={selectedPlatform === "全部平台"}>
                            <span className="directory-all-icon"><Icon name="grid" size={16} /></span>
                            <span><strong>全部平台</strong><small>{totalCount} 筆有效活動</small></span>
                            <Icon name="arrow-right" size={15} />
                          </button>
                          {platformGroups.map((group) => (
                            <div className="directory-group" key={group.segment}>
                              <div className="directory-group-heading"><span>{group.label}</span><small>{group.items.length}</small></div>
                              <div className="directory-list">
                                {group.items.map(({ platform, offers: platformOffers }) => (
                                  <button type="button" key={platform.name} className={`platform-filter-button ${selectedPlatform === platform.name ? "selected" : ""}`} onClick={() => choosePlatform(platform.name)} aria-pressed={selectedPlatform === platform.name} title={`篩選 ${platform.name} 活動`}>
                                    <BrandMark name={platform.name} logo={platform.logo || paymentLogos[platform.name]} color={platform.color || platformColors[platform.name] || "#2e8b62"} />
                                    <span><strong>{platform.name}</strong><small>{platformOffers.length ? `${platformOffers.length} 筆活動` : "官方入口已建立"}</small></span>
                                    <span className={`directory-status ${platformOffers.length ? "is-active" : ""}`}>{platformOffers.length ? "有活動" : "索引"}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="filter-popover-section filter-category-section">
                        <div className="filter-section-heading"><strong>活動分類</strong><span>{activeCategory === "全部" ? "全部活動" : activeCategory}</span></div>
                        <CategoryScroller categories={categories} activeCategory={activeCategory} categoryCounts={categoryCounts} onSelect={setActiveCategory} />
                      </div>
                      <div className="filter-popover-footer">
                        <button type="button" className="clear-filter" onClick={() => choosePlatform("全部平台")}><Icon name="check" size={14} />重設條件</button>
                        <button type="button" className="filter-apply" onClick={() => setFiltersOpen(false)}>完成篩選 <Icon name="arrow-right" size={14} /></button>
                      </div>
                    </section>
                  </>
                ) : null}

                {filteredOffers.length === 0 ? (
                  <div className="empty-state glass-panel"><Icon name={isFavoritesView ? "heart" : "search"} size={24} /><h3>{isFavoritesView ? "還沒有收藏活動" : "目前沒有符合的活動"}</h3><p>{isFavoritesView ? "回到活動總覽，點選卡片右上角的愛心開始追蹤。" : "換一個平台或關鍵字，重新查看同步資料。"}</p>{isFavoritesView ? <a className="empty-state-link" href="#latest"><Icon name="search" size={14} />瀏覽全部活動</a> : null}</div>
                ) : (
                  <>
                    <div className={`offer-grid is-${activityViewMode}`}>{visibleOffers.map((offer, index) => <OfferCard key={`${offer.payment.name}-${offer.officialId || offer.sourceUrl || offer.title}-${index}`} offer={offer} isFavorite={isOfferFavorite(offer, favoriteIds)} onToggleFavorite={toggleFavorite} viewMode={activityViewMode} />)}</div>
                    {remainingOfferCount ? <button type="button" className="load-more-offers" onClick={() => setVisibleOfferState({ key: filterSignature, count: visibleOfferCount + INITIAL_VISIBLE_OFFERS })}><span>載入更多活動</span><small>還有 {remainingOfferCount} 筆</small><Icon name="arrow-right" size={15} /></button> : null}
                  </>
                )}
              </div>
            </div>
            <p className="panel-footnote"><Icon name="info" size={14} />活動細項、名額與期限請以各平台、各通路的官方頁面為準。</p>
          </section>

          <section id="history" className={`history-section${isHistoryView ? " is-standalone" : " app-view-hidden"}`} aria-labelledby="history-title">
            <div className="history-heading">
              <div>
                <span className="eyebrow"><Icon name="clock" size={14} />EXHAUSTION HISTORY</span>
                <h2 id="history-title">歷史回饋耗盡</h2>
                <p>把官方曾公告的額滿時間留下來，下一次先判斷哪個月份、哪家銀行需要優先使用。</p>
              </div>
              <div className="history-total"><strong>{historyRecords.length}</strong><span>筆官方紀錄</span></div>
            </div>

            <div className="history-kpi-grid">
              <div className="history-kpi glass-panel"><span>已記錄月份</span><strong>{historyMonthCount}</strong><small>跨平台累積</small></div>
              <div className="history-kpi glass-panel"><span>精確到時間</span><strong>{exactHistoryCount}</strong><small>可用來比較先後</small></div>
              <div className="history-kpi glass-panel"><span>待補完整時間</span><strong>{monthOnlyHistoryCount}</strong><small>官方只公布月份</small></div>
            </div>

            <div className="history-watch-section" aria-labelledby="history-watch-title">
              <div className="history-watch-heading">
                <div className="history-trail-title-wrap">
                  <span className="history-trail-icon is-watch"><Icon name="bell" size={18} /></span>
                  <div>
                    <span className="eyebrow">EXHAUSTION WATCH</span>
                    <h3 id="history-watch-title">額滿追蹤</h3>
                    <p>同一活動集中顯示各家銀行最近一次額滿日期；官方沒提供時間時，先保留日期或月份。</p>
                  </div>
                </div>
                <span className="history-watch-count">{historyTrackGroups.length} 個活動</span>
              </div>
              {historyTrackGroups.length ? (
                <div className="history-track-grid history-track-grid-watch">
                  {historyTrackGroups.map((group) => <HistoryTrackGroupCard group={group} compact key={group.key} />)}
                </div>
              ) : <p className="history-trail-empty">目前尚未收集到可追蹤的額滿活動。</p>}
            </div>

            <div className="history-toolbar glass-panel">
              <label className="history-filter-field"><span>平台</span><select value={historyPlatform} onChange={(event) => setHistoryPlatform(event.target.value)}><option>全部平台</option>{historyPlatforms.map((platform) => <option key={platform}>{platform}</option>)}</select></label>
              <label className="history-filter-field"><span>月份</span><select value={historyMonth} onChange={(event) => setHistoryMonth(event.target.value)}><option>全部月份</option>{historyMonths.map((month) => <option key={month} value={month}>{formatHistoryMonth(month)}</option>)}</select></label>
              <label className="field-block history-search"><span>搜尋銀行、通路或活動</span><div className="input-shell"><Icon name="search" size={17} /><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="例如：聯邦、7-ELEVEN、4%" aria-label="搜尋歷史活動" /></div></label>
            </div>

            <div id="history-records" className="history-records-section">
              <div className="history-record-heading"><div><span className="eyebrow"><Icon name="database" size={14} />OFFICIAL LOG</span><h3>完整額滿紀錄</h3></div><span>{filteredHistoryRecords.length} 筆符合</span></div>
              {filteredHistoryRecords.length ? (
                <div className="history-record-list">
                {filteredHistoryRecords.map((record) => (
                  <article className="history-record-card glass-panel" key={record.id}>
                    <div className="history-record-main">
                      <div className="history-record-meta"><span>{formatHistoryMonth(record.month)}</span><span>{record.platform}</span>{record.bank ? <span>{record.bank}</span> : null}</div>
                      <h4>{record.campaignTitle}</h4>
                      <p>{[record.merchant, record.rewardLabel].filter(Boolean).join(" · ") || "官方活動回饋"}</p>
                    </div>
                    <div className="history-record-time"><span>官方額滿</span><strong>{formatHistoryDate(record)}</strong><small>{historyConfidenceLabel(record.confidence)}</small></div>
                    <div className="history-record-evidence"><p>{record.evidence}</p>{record.sourceUrl ? <a href={record.sourceUrl} target="_blank" rel="noreferrer">看官方活動頁 <Icon name="external" size={13} /></a> : null}</div>
                  </article>
                ))}
                </div>
              ) : (
                <div className="history-empty glass-panel"><Icon name="clock" size={22} /><strong>目前沒有符合的歷史紀錄</strong><p>換一個平台、月份或關鍵字。</p></div>
              )}
            </div>
            <p className="panel-footnote"><Icon name="info" size={14} />「尚不能判定先後」代表官方頁面沒有公開時間，不代表活動一定沒有提前額滿；後續同步會持續補上新月份。</p>
          </section>

          <section id="sources" className={`sources-section${isHistoryView || isFavoritesView ? " app-view-hidden" : ""}`}>
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
      <nav className="mobile-tabbar" aria-label="手機版快速導覽">
        <a className={activeView === "latest" ? "active" : ""} href="#latest"><Icon name="database" size={18} /><span>活動</span></a>
        <button type="button" className={`mobile-filter-shortcut${filtersOpen ? " active" : ""}`} onClick={() => { setFiltersOpen(true); document.getElementById("platforms")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} aria-label={activeFilterCount ? `篩選，已套用 ${activeFilterCount} 個條件` : "開啟平台與分類篩選"}><Icon name="sliders" size={18} /><span>篩選</span>{activeFilterCount ? <b>{activeFilterCount}</b> : null}</button>
        <a className={isFavoritesView ? "active" : ""} href="#favorites"><Icon name="heart" size={18} /><span>最愛{favoriteOfferCount ? ` ${favoriteOfferCount}` : ""}</span></a>
        <a className={isHistoryView ? "active" : ""} href="#history"><Icon name="clock" size={18} /><span>歷史</span></a>
      </nav>
    </main>
  );
}
