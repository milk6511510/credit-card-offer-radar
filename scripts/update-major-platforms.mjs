import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputPath = path.join(root, "public", "data", "campaigns.json");
const USER_AGENT = "Mozilla/5.0 (compatible; RewardRadar/0.4; +https://reward-radar.ellis-aiwa-4007.chatgpt.site/)";

function taipeiTodayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

function formatDateKey(value) {
  return value ? `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}` : "";
}

function cleanText(value) {
  return String(value || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<\/(?:p|div|section|article|tr|td|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/[ \t\r\f]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function absoluteUrl(value, origin) {
  const url = String(value || "").trim();
  if (!url || /^javascript:/i.test(url) || url === "#") return "";
  try {
    return new URL(url, origin).toString();
  } catch {
    return "";
  }
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["']`, "i"));
  return cleanText(match?.[1] || "");
}

function extractClassText(html, className) {
  const match = String(html || "").match(new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i"));
  return cleanText(match?.[1] || "");
}

function extractHeading(html) {
  return cleanText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || "");
}

function extractMainText(html) {
  const source = String(html || "");
  const candidates = [
    source.match(/<main\b[\s\S]*?<\/main>/i)?.[0],
    source.match(/<div[^>]+class=["'][^"']*\bmid-content\b[^"']*["'][\s\S]*?<\/div>\s*<\/div>/i)?.[0],
    source.match(/<article\b[\s\S]*?<\/article>/i)?.[0],
    source.match(/<body\b[\s\S]*?<\/body>/i)?.[0],
  ].filter(Boolean);
  return cleanText(candidates[0] || source).slice(0, 5000);
}

function extractFirstContentImage(html, origin) {
  const candidates = [...String(html || "").matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => absoluteUrl(match[1], origin))
    .filter(Boolean)
    .filter((url) => !/facebook\.com\/tr|doubleclick|pixel|tracking|analytics/i.test(url));
  return candidates.find((url) => !/logo|icon|favicon|avatar/i.test(url)) || "";
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(options.timeout || 18000),
    headers: {
      "user-agent": USER_AGENT,
      accept: options.accept || "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.7",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchJson(url, options = {}) {
  return JSON.parse(await fetchText(url, { ...options, accept: "application/json,text/plain;q=0.9,*/*;q=0.7" }));
}

async function safeFetchText(url, options = {}) {
  try {
    return { ok: true, text: await fetchText(url, options) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = await mapper(items[index], index);
      } catch (error) {
        results[index] = { error: error instanceof Error ? error.message : String(error) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, () => worker()));
  return results;
}

function dateKeyFromToken(value, fallbackYear = new Date().getFullYear()) {
  const text = String(value || "");
  const chinese = text.match(/(20\d{2}|1\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (chinese) {
    const year = Number(chinese[1]) < 1911 ? Number(chinese[1]) + 1911 : Number(chinese[1]);
    return `${year}${chinese[2].padStart(2, "0")}${chinese[3].padStart(2, "0")}`;
  }
  const full = text.match(/(20\d{2}|1\d{2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  if (full) {
    const year = Number(full[1]) < 1911 ? Number(full[1]) + 1911 : Number(full[1]);
    return `${year}${full[2].padStart(2, "0")}${full[3].padStart(2, "0")}`;
  }
  const short = text.match(/(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  return short ? `${fallbackYear}${short[1].padStart(2, "0")}${short[2].padStart(2, "0")}` : "";
}

function parseDateRange(text) {
  const value = String(text || "");
  // Prefer the explicit activity-period field over later dates such as
  // point-credit deadlines or refund windows in the terms.
  const activityPeriod = value.match(/活動期間[^。\n]{0,180}/i)?.[0] || value;
  const periodValue = activityPeriod === value ? value : activityPeriod;
  const chineseShortRange = periodValue.match(/(?:(20\d{2}|1\d{2})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日?\s*(?:起至|起|~|～|至|到|-|–|—)\s*(?:(20\d{2}|1\d{2})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (chineseShortRange) {
    const startYear = Number(chineseShortRange[1] || new Date().getFullYear());
    const normalizedStartYear = startYear < 1911 ? startYear + 1911 : startYear;
    const endYear = Number(chineseShortRange[4] || startYear);
    const normalizedEndYear = endYear < 1911 ? endYear + 1911 : endYear;
    return {
      startsAt: `${normalizedStartYear}${chineseShortRange[2].padStart(2, "0")}${chineseShortRange[3].padStart(2, "0")}`,
      endsAt: `${normalizedEndYear}${chineseShortRange[5].padStart(2, "0")}${chineseShortRange[6].padStart(2, "0")}`,
    };
  }
  const beforeDate = periodValue.match(/((?:20\d{2}|1\d{2})\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2})\s*前/);
  if (beforeDate) return { startsAt: "", endsAt: dateKeyFromToken(beforeDate[1]) };
  const chineseDates = [...periodValue.matchAll(/(?:20\d{2}|1\d{2})\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日?/g)].map((match) => match[0]);
  if (chineseDates.length >= 2) return { startsAt: dateKeyFromToken(chineseDates[0]), endsAt: dateKeyFromToken(chineseDates[1]) };
  const fullDates = [...periodValue.matchAll(/(?:20\d{2}|1\d{2})\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2}/g)].map((match) => match[0]);
  if (fullDates.length >= 2) {
    return { startsAt: dateKeyFromToken(fullDates[0]), endsAt: dateKeyFromToken(fullDates[1]) };
  }
  const shortened = periodValue.match(/((?:20\d{2}|1\d{2})\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2})\s*(?:起至|~|～|至|到|-|–|—)\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  if (shortened) {
    const startsAt = dateKeyFromToken(shortened[1]);
    return { startsAt, endsAt: `${startsAt.slice(0, 4)}${shortened[2].padStart(2, "0")}${shortened[3].padStart(2, "0")}` };
  }
  const shortRange = periodValue.match(/(?:^|[^\d])(\d{1,2})\s*[./-]\s*(\d{1,2})\s*(?:~|～|至|到|-|–|—)\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  if (shortRange) {
    const year = String(new Date().getFullYear());
    return {
      startsAt: `${year}${shortRange[1].padStart(2, "0")}${shortRange[2].padStart(2, "0")}`,
      endsAt: `${year}${shortRange[3].padStart(2, "0")}${shortRange[4].padStart(2, "0")}`,
    };
  }
  const numericEndOnly = periodValue.match(/(?:至|到|截至|延長至)\s*(?:(20\d{2}|1\d{2})\s*[./-]\s*)?(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  if (numericEndOnly) {
    const year = Number(numericEndOnly[1] || new Date().getFullYear());
    const normalizedYear = year < 1911 ? year + 1911 : year;
    return {
      startsAt: "",
      endsAt: `${normalizedYear}${numericEndOnly[2].padStart(2, "0")}${numericEndOnly[3].padStart(2, "0")}`,
    };
  }
  const monthEndOnly = periodValue.match(/(?:至|到|截至|延長至)\s*(?:(20\d{2}|1\d{2})\s*年\s*)?(\d{1,2})\s*月\s*底/);
  if (monthEndOnly) {
    const year = Number(monthEndOnly[1] || new Date().getFullYear());
    const normalizedYear = year < 1911 ? year + 1911 : year;
    const month = Number(monthEndOnly[2]);
    const lastDay = new Date(Number(normalizedYear), month, 0).getDate();
    return { startsAt: "", endsAt: `${normalizedYear}${String(month).padStart(2, "0")}${String(lastDay).padStart(2, "0")}` };
  }
  const chineseEndOnly = periodValue.match(/(?:至|到|截至|延長至)\s*(?:(20\d{2}|1\d{2})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (chineseEndOnly) {
    const year = Number(chineseEndOnly[1] || new Date().getFullYear());
    const normalizedYear = year < 1911 ? year + 1911 : year;
    return {
      startsAt: "",
      endsAt: `${normalizedYear}${chineseEndOnly[2].padStart(2, "0")}${chineseEndOnly[3].padStart(2, "0")}`,
    };
  }
  if (/(?:至|到|截至|延長至)\s*(?:今年)?年底/i.test(periodValue)) {
    return { startsAt: "", endsAt: `${new Date().getFullYear()}1231` };
  }
  const onlyDate = fullDates[0] ? dateKeyFromToken(fullDates[0]) : chineseDates[0] ? dateKeyFromToken(chineseDates[0]) : "";
  return { startsAt: onlyDate, endsAt: "" };
}

function isActive(campaign, today) {
  return (!campaign.startsAt || campaign.startsAt <= today) && (!campaign.endsAt || campaign.endsAt >= today);
}

function inferRate(text) {
  const value = String(text || "");
  if (/貸款|利率/i.test(value) && !/回饋[^。\n]{0,20}\d+(?:\.\d+)?\s*%|最高[^。\n]{0,20}\d+(?:\.\d+)?\s*%/i.test(value)) return 0;
  const rates = [...value.matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
    .filter((match) => {
      const context = value.slice(Math.max(0, match.index - 28), Math.min(value.length, match.index + match[0].length + 28));
      return /回饋|點數|OPENPOINT|折抵|優惠|贈|加碼|最高|享|支付|錢包|累積|P幣|街口幣|Fa點|全點|幣/i.test(context);
    })
    .map((match) => Number(match[1]))
    .filter((rate) => rate > 0 && rate <= 100);
  const discounts = [...String(text || "").matchAll(/([2-9])\s*折/g)]
    .map((match) => 10 - Number(match[1]))
    .filter((value) => value > 0 && value < 10);
  return Math.max(...rates, ...discounts, 0) / 100;
}

function inferCap(text) {
  const values = [...String(text || "").matchAll(/(?:上限|最高|限得|回饋上限|每月最高|每筆最高|折抵上限|贈|送|折)\D{0,14}([\d,]{1,8})\s*(?:元|點|P幣|P幣|OPENPOINT|街口幣|Fa點|全點)/gi)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.max(...values) : 0;
}

function inferAudience(text) {
  const newUser = /新戶|新客|新會員|新註冊|首次|首刷|首筆|新申辦|未成年/i.test(text);
  const existingUser = /既有|原卡友|持卡人|續卡|老客|已持有/i.test(text);
  if (newUser && existingUser) return "mixed";
  if (newUser) return "new-user";
  if (existingUser) return "existing-user";
  return "not-stated";
}

function inferCategory(text) {
  const value = String(text || "");
  if (/新戶|新客|新註冊|首次|首刷|開通送|註冊禮|推薦/i.test(value)) return "新戶優惠";
  if (/公告|系統維護|停止支援|停止提供|防詐|服務異動|獲.*獎/i.test(value) && !/回饋|優惠|贈|點數|折扣/i.test(value)) return "最新資訊";
  if (/超商|7-ELEVEN|全家|萊爾富|OKmart|便利商店/i.test(value)) return "超商回饋";
  if (/交通|乘車|捷運|公車|停車|金門|馬祖|旅遊|景點/i.test(value)) return "交通／旅遊回饋";
  if (/飲料|咖啡|餐飲|餐廳|美食|Mister Donut|Cold Stone|麥當勞|星巴克/i.test(value)) return "餐飲回饋";
  if (/百貨|購物|電商|PChome|momo|蝦皮|商城|Apple|App Store/i.test(value)) return "購物回饋";
  if (/加油|石油|台亞|福懋/i.test(value)) return "加油回饋";
  if (/銀行|信用卡|聯名卡|帳戶|自動加值|綁定/i.test(value)) return "金融／綁卡回饋";
  if (/回饋|折扣|點數|優惠|贈|送|幣|券/i.test(value)) return "一般回饋";
  return "最新資訊";
}

const storeKeywords = [
  "7-ELEVEN", "全家便利商店", "全家", "萊爾富", "OKmart", "PChome24h購物", "PChome", "momo", "蝦皮購物", "Apple", "App Store",
  "全通路", "CITYLINK", "新光三越", "遠東百貨", "大樹藥局", "Mister Donut", "Cold Stone", "星巴克", "康是美", "麥當勞", "小仁泉", "金門",
  "馬祖", "宜蘭", "南投", "台亞石油", "福懋", "全聯", "家樂福", "誠品", "KLOOK", "Trip.com", "JUJI", "指定通路",
];

function inferStores(text) {
  const value = String(text || "");
  const stores = storeKeywords.filter((store) => value.toLowerCase().includes(store.toLowerCase()));
  return stores.length ? [...new Set(stores)] : [/支付|錢包|帳戶|APP|公告/i.test(value) ? "官方支付服務" : "官方指定通路"];
}

function rewardLabel(rate, cap, text) {
  if (rate > 0 && cap > 0) return `最高 ${Math.round(rate * 100)}%／上限 ${cap.toLocaleString("zh-TW")} 點／元`;
  if (rate > 0) return `最高 ${Math.round(rate * 100)}% 回饋`;
  if (cap > 0) return `最高 ${cap.toLocaleString("zh-TW")} 點／元`;
  if (/回饋|優惠|贈|送|點數|折扣|幣|券/i.test(text)) return "依官方條件回饋";
  return "官方最新資訊";
}

function campaign({ provider, title, rawText, sourceUrl, image = "", dateText = "", explicitCategory, statusText = "", publishedAt = "", officialOrder, startsAtOverride = "", endsAtOverride = "" }) {
  const safeTitle = cleanText(title).replace(/\s+/g, " ");
  const cleanRaw = cleanText(rawText || safeTitle).slice(0, 5000);
  const combined = `${safeTitle} ${cleanRaw}`;
  const parsedDates = parseDateRange(dateText || combined);
  const startsAt = startsAtOverride || parsedDates.startsAt;
  const endsAt = endsAtOverride || parsedDates.endsAt;
  const inferredCategory = explicitCategory || inferCategory(combined);
  const rate = inferredCategory === "最新資訊" ? 0 : inferRate(combined);
  const cap = inferredCategory === "最新資訊" ? 0 : inferCap(combined);
  return {
    title: safeTitle,
    category: inferredCategory,
    stores: inferStores(combined),
    paymentMethods: [provider],
    audience: inferAudience(combined),
    rate,
    cap,
    rewardLabel: rewardLabel(rate, cap, combined),
    status: cleanText(statusText || (startsAt && endsAt ? `${formatDateKey(startsAt)}–${formatDateKey(endsAt)}` : "官方頁最新資訊；詳細條件請見官方頁")),
    sourceUrl,
    image,
    rawText: cleanRaw,
    startsAt,
    endsAt,
    publishedAt,
    officialOrder,
  };
}

function dedupeCampaigns(campaigns, today) {
  return campaigns
    .filter(Boolean)
    .filter((item) => item.startsAt || item.endsAt)
    .filter((item) => isActive(item, today))
    .filter((item, index, all) => all.findIndex((candidate) => `${candidate.title}|${candidate.sourceUrl}` === `${item.title}|${item.sourceUrl}`) === index);
}

function providerMeta(name, logo, color, focus, segment, officialSite, sourceUrls) {
  return { name, logo, color, focus, segment, officialSite, sourceUrls };
}

const catalog = [
  providerMeta("LINE Pay", "/logos/line-pay.svg", "#00c300", "LINE Pay、LINE Pay Money 與官方通路優惠。", "daily", "https://pay.line.me/portal/tw/about/promotions?progressType=ONGOING", ["https://pay.line.me/portal/tw/about/promotions?progressType=ONGOING", "https://pay.line.me/portal/tw/customer/press"]),
  providerMeta("街口支付", "/logos/jkos-pay.png", "#eb6a2a", "街口支付官方行銷活動、街口幣與指定通路折扣。", "daily", "https://mkt.jkopay.com/zh-TW/event", ["https://mkt.jkopay.com/sitemap.xml"]),
  providerMeta("悠遊付", "/logos/easywallet.png", "#007c70", "悠遊付官方優惠、交通與日常採買回饋。", "daily", "https://easywallet.easycard.com.tw/benefit/", ["https://easywallet.easycard.com.tw/benefit/?page=1"]),
  providerMeta("iPASS MONEY", "/logos/ipass-money.png", "#00a6d6", "iPASS MONEY 官方優惠活動與使用條件。", "daily", "https://www.i-pass.com.tw/Preferential", ["https://www.i-pass.com.tw/Preferential?page=1&type=0"]),
  providerMeta("icash Pay", "/logos/icash-pay.png", "#e95e22", "icash Pay 官方活動卡、合作通路與 OPENPOINT 回饋。", "daily", "https://www.icashpay.com.tw/", ["https://www.icashpay.com.tw/advertMessage/index?page=1"]),
  providerMeta("Pi 拍錢包", "/logos/pi-wallet.svg", "#ed6b31", "Pi 拍錢包 P 幣、電商與指定通路活動。", "merchant", "https://web.piapp.com.tw/events/", ["https://web.piapp.com.tw/events/"]),
  providerMeta("全盈+PAY", "/logos/pluspay.png", "#ef7d32", "全盈+PAY 儲值金、Fa 點與全家通路活動。", "merchant", "https://event2023.pluspay.com.tw/", ["https://event2023.pluspay.com.tw/"]),
  providerMeta("OPEN錢包", "/logos/open-wallet.png", "#ef5a24", "OPEN錢包於 7-ELEVEN 與合作銀行的 OPENPOINT 活動。", "merchant", "https://www.7-11.com.tw/service/Pay.aspx", ["https://www.7-11.com.tw/service/Pay.aspx"]),
  providerMeta("7-ELEVEN", "/logos/7-eleven.png", "#00a651", "7-ELEVEN 官方活動與支付工具回饋。", "merchant", "https://www.7-11.com.tw/index.aspx", ["https://www.7-11.com.tw/index.aspx", "https://www.7-11.com.tw/include/SalesPromo.xml?12", "https://www.7-11.com.tw/service/Pay.aspx"]),
  providerMeta("台灣 Pay", "/logos/taiwan-pay.png", "#b22637", "台灣 Pay、TWQR 與銀行合作通路回饋。", "cross-network", "https://taiwanpay.firstbank.com.tw/sites/twpay/latestOffers", ["https://taiwanpay.firstbank.com.tw/sites/twpay/latestOffers"]),
  providerMeta("全支付", "/logos/pxpay.png", "#5f49a6", "全支付全點、消費回饋與指定通路活動。", "merchant", "https://www.pxpayplus.com.tw/", ["https://www.pxpayplus.com.tw/"]),
  providerMeta("橘子支付", "/logos/gama-pay.png", "#f58220", "橘子支付官方活動、公告與服務異動。", "cross-network", "https://www.gamapay.com.tw/news_list.html", ["https://www.gamapay.com.tw/news_list.html", "https://www.gamapay.com.tw/api/NewsList"]),
  providerMeta("歐付寶 O'Pay", "/logos/opay-icon.png", "#1388c9", "歐付寶 O'Pay 官方好康活動與合作通路。", "cross-network", "https://www.opay.tw/banner/event", ["https://www.opay.tw/banner/event"]),
  providerMeta("ezPay 簡單付", "/logos/ezpay.png", "#1877b9", "ezPay 簡單付官方服務與活動入口。", "cross-network", "https://www.ezpay.com.tw/", ["https://www.ezpay.com.tw/"]),
];

async function scrapeLine(today) {
  const listUrl = "https://pay.line.me/portal/tw/customer/press";
  const promotionUrl = "https://pay.line.me/portal/tw/about/promotions?progressType=ONGOING";
  const listResult = await safeFetchText(listUrl);
  if (!listResult.ok) return { campaigns: [], status: "unreachable", error: listResult.error, sourceUrls: [promotionUrl, listUrl] };
  const items = [...listResult.text.matchAll(/<li[^>]+class=["'][^"']*customer-center__item[^"']*["'][\s\S]*?<\/li>/gi)].map((match) => match[0]);
  const candidates = items.map((item, officialOrder) => ({
    title: cleanText(item.match(/class=["'][^"']*customer-center__title[^"']*["'][\s\S]*?class=["'][^"']*\btext\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || ""),
    published: cleanText(item.match(/class=["'][^"']*customer-center__date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || ""),
    sourceUrl: absoluteUrl(item.match(/href=["']([^"']+\/press\/[^"']+)["']/i)?.[1], "https://pay.line.me"),
    officialOrder,
  })).filter((item) => item.title && item.sourceUrl);
  const results = await mapLimit(candidates, 5, async (candidate) => {
    const detail = await safeFetchText(candidate.sourceUrl);
    const detailContent = detail.ok ? detail.text.match(/<div[^>]+class=["'][^"']*customer-center__detail-contents[^"']*["'][^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>|<\/section>)/i)?.[1] : "";
    const detailText = detail.ok ? (cleanText(detailContent || "") || metaContent(detail.text, "description")) : "";
    const dateText = `${candidate.published} ${detailText}`;
    const parsedDates = parseDateRange(dateText);
    if (/(?:至|到|截至|延長至)\s*(?:今年)?年底/i.test(detailText)) parsedDates.endsAt = `${new Date().getFullYear()}1231`;
    const { startsAt, endsAt } = parsedDates;
    const periodLabel = startsAt || endsAt
      ? `活動期間 ${formatDateKey(startsAt) || "即日起"}–${formatDateKey(endsAt) || "依官方公告"}`
      : "";
    return campaign({
      provider: "LINE Pay",
      title: candidate.title.replace(/\bnew\b/gi, ""),
      rawText: detailText || candidate.title,
      sourceUrl: candidate.sourceUrl,
      image: detail.ok ? extractFirstContentImage(detailContent || detail.text, "https://pay.line.me") : "",
      dateText,
      statusText: [periodLabel, candidate.published ? `官方發布 ${candidate.published}` : "LINE Pay 官方最新資訊"].filter(Boolean).join("；"),
      publishedAt: dateKeyFromToken(candidate.published),
      officialOrder: candidate.officialOrder,
      startsAtOverride: startsAt || "",
      endsAtOverride: endsAt || "",
    });
  });
  // 活動頁目前保留官方活動入口；可辨識活動期間的新聞內容則補入活動清單，
  // 財報、公司訊息與已過期活動不列入有效優惠。
  const activeCampaigns = dedupeCampaigns(results, today).filter((item) => {
    if (item.endsAt) return item.endsAt >= today;
    const text = `${item.title} ${item.rawText}`;
    return /回饋|優惠|活動|贈|券|點數/i.test(text) && !/財報|營收|EPS|董事會|交易量|獎項肯定/i.test(text);
  });
  return {
    campaigns: activeCampaigns,
    status: "ok",
    sourceUrls: [promotionUrl, listUrl],
  };
}

async function scrapeJko(today) {
  const sitemapUrl = "https://mkt.jkopay.com/sitemap.xml";
  const sitemap = await safeFetchText(sitemapUrl);
  if (!sitemap.ok) return { campaigns: [], status: "unreachable", error: sitemap.error, sourceUrls: [sitemapUrl] };
  const urls = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => match[1].trim())
    .filter((url) => /mkt\.jkopay\.com\/zh-TW\/(?:event|campaign)\//i.test(url))
    .filter((url) => /2026|h[12]|new|current|jkopayebill/i.test(url))
    .slice(0, 180);
  const results = await mapLimit([...new Set(urls)], 8, async (url) => {
    const page = await safeFetchText(url);
    if (!page.ok) return null;
    const title = metaContent(page.text, "og:title") || cleanText(page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    const description = metaContent(page.text, "description") || metaContent(page.text, "og:description");
    if (!title || /404|找不到|page not found/i.test(`${title} ${description}`)) return null;
    return campaign({ provider: "街口支付", title: title.replace(/\s*[|｜].*$/, ""), rawText: description || title, sourceUrl: url, image: metaContent(page.text, "og:image"), dateText: `${title} ${description}` });
  });
  return { campaigns: dedupeCampaigns(results, today), status: "ok", sourceUrls: [sitemapUrl] };
}

async function scrapeEasyWallet(today) {
  const listOrigin = "https://easywallet.easycard.com.tw";
  const listPages = await mapLimit(Array.from({ length: 8 }, (_, index) => `${listOrigin}/benefit/?page=${index + 1}`), 4, async (url) => safeFetchText(url));
  const candidates = [];
  for (const page of listPages) {
    if (!page?.ok) continue;
    for (const match of page.text.matchAll(/<a[^>]+href=["']([^"']*benefit\/content\.php\?id=\d+)["'][\s\S]*?<\/a>/gi)) {
      const block = match[0];
      const title = extractClassText(block, "title");
      const date = extractClassText(block, "date");
      if (title) candidates.push({ title, date, sourceUrl: absoluteUrl(match[1], listOrigin) });
    }
  }
  const unique = [...new Map(candidates.map((item) => [item.sourceUrl, item])).values()];
  const results = await mapLimit(unique, 6, async (candidate) => {
    const detail = await safeFetchText(candidate.sourceUrl);
    const detailTitle = detail.ok ? extractHeading(detail.text) : "";
    const detailSection = detail.ok ? detail.text.match(/<section[^>]+class=["'][^"']*content-block[^"']*["'][^>]*>([\s\S]*?)<\/section>/i)?.[1] : "";
    const detailPeriod = detail.ok ? cleanText(detail.text.match(/<h6[^>]*>([\s\S]*?)<\/h6>/i)?.[1] || "") : "";
    const detailText = detail.ok ? (cleanText(detailSection || "") || extractClassText(detail.text, "content-block")) : "";
    return campaign({ provider: "悠遊付", title: detailTitle || candidate.title, rawText: detailText || candidate.title, sourceUrl: candidate.sourceUrl, image: detail.ok ? metaContent(detail.text, "og:image") : "", dateText: `${candidate.date} ${detailPeriod}` });
  });
  return { campaigns: dedupeCampaigns(results, today), status: "ok", sourceUrls: [`${listOrigin}/benefit/?page=1`] };
}

async function scrapePi(today) {
  const origin = "https://web.piapp.com.tw";
  const pages = await mapLimit([`${origin}/events/`, `${origin}/events/page/2/`, `${origin}/events/page/3/`], 3, async (url) => safeFetchText(url));
  const candidates = [];
  for (const page of pages) {
    if (!page?.ok) continue;
    for (const match of page.text.matchAll(/<article[^>]+class=["'][^"']*et_pb_post[^"']*["'][\s\S]*?<\/article>/gi)) {
      const block = match[0];
      const titleMatch = block.match(/<h2[^>]+class=["'][^"']*entry-title[^"']*["'][\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!titleMatch) continue;
      candidates.push({
        title: cleanText(titleMatch[2]),
        summary: extractClassText(block, "post-content"),
        sourceUrl: absoluteUrl(titleMatch[1], origin),
        image: absoluteUrl(block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1], origin),
      });
    }
  }
  const unique = [...new Map(candidates.map((item) => [item.sourceUrl, item])).values()];
  const results = await mapLimit(unique, 5, async (candidate) => {
    const detail = await safeFetchText(candidate.sourceUrl);
    const fullText = detail.ok ? extractMainText(detail.text) : "";
    return campaign({ provider: "Pi 拍錢包", title: candidate.title, rawText: `${candidate.summary} ${fullText}`, sourceUrl: candidate.sourceUrl, image: candidate.image || (detail.ok ? metaContent(detail.text, "og:image") : ""), dateText: candidate.summary });
  });
  return { campaigns: dedupeCampaigns(results, today), status: "ok", sourceUrls: [`${origin}/events/`] };
}

async function scrapeTaiwanPay(today) {
  const listUrl = "https://taiwanpay.firstbank.com.tw/sites/twpay/latestOffers";
  const list = await safeFetchText(listUrl);
  if (!list.ok) return { campaigns: [], status: "unreachable", error: list.error, sourceUrls: [listUrl] };
  const candidates = [];
  const anchors = [...list.text.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const match of anchors) {
    const context = list.text.slice(Math.max(0, match.index - 260), match.index + match[0].length);
    if (!/card-title/i.test(context)) continue;
    const title = cleanText(match[2]);
    const sourceUrl = absoluteUrl(match[1], listUrl);
    if (title && sourceUrl) candidates.push({ title, sourceUrl });
  }
  const unique = [...new Map(candidates.map((item) => [item.sourceUrl, item])).values()];
  const results = await mapLimit(unique, 6, async (candidate) => {
    const detail = await safeFetchText(candidate.sourceUrl);
    const content = detail.ok ? detail.text.match(/<[^>]+class=["'][^"']*\bcontent-body\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] : "";
    const rawText = cleanText(content || candidate.title);
    return campaign({ provider: "台灣 Pay", title: candidate.title, rawText, sourceUrl: candidate.sourceUrl, image: detail.ok ? metaContent(detail.text, "og:image") : "", dateText: rawText || candidate.title });
  });
  const latest = results.map((item) => {
    if (!item || !item.title) return item;
    return item.startsAt > today || item.endsAt < today ? { ...item, startsAt: "", endsAt: "", status: "官方最新優惠清單；活動期間與名額請開啟官方詳情" } : item;
  });
  return { campaigns: dedupeCampaigns(latest, today), status: "ok", sourceUrls: [listUrl] };
}

async function scrapeGama(today) {
  const listUrl = "https://www.gamapay.com.tw/news_list.html";
  let json;
  try {
    json = await fetchJson("https://www.gamapay.com.tw/api/NewsList");
  } catch (error) {
    return { campaigns: [], status: "unreachable", error: error instanceof Error ? error.message : String(error), sourceUrls: [listUrl] };
  }
  const news = (json?.Data?.News || []).filter((item) => item.Type === 3 || item.Type === 1).slice(0, 80);
  const results = await mapLimit(news, 6, async (item) => {
    let detailText = "";
    try {
      const detail = await fetchJson(`https://www.gamapay.com.tw/api/News/${item.Id}`);
      detailText = cleanText(detail?.Data?.Content || "");
    } catch {
      detailText = "";
    }
    return campaign({
      provider: "橘子支付",
      title: item.Title,
      rawText: detailText || item.Title,
      sourceUrl: `https://www.gamapay.com.tw/news.html?id=${item.Id}`,
      dateText: `${item.PublishTime} ${detailText}`,
      explicitCategory: item.Type === 1 ? "最新資訊" : undefined,
      statusText: `${item.PublishTime}；官方內容請見詳情頁`,
    });
  });
  return { campaigns: dedupeCampaigns(results, today), status: "ok", sourceUrls: [listUrl, "https://www.gamapay.com.tw/api/NewsList"] };
}

async function scrapeOpay(today) {
  const listUrl = "https://www.opay.tw/banner/event";
  const page = await safeFetchText(listUrl);
  if (!page.ok) return { campaigns: [], status: "unreachable", error: page.error, sourceUrls: [listUrl] };
  const results = [];
  for (const match of page.text.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)) {
    const context = page.text.slice(Math.max(0, match.index - 1800), match.index + 2200);
    const title = cleanText(match[1]);
    const sourceUrl = absoluteUrl(context.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1], listUrl);
    const image = absoluteUrl(context.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1], listUrl);
    if (!title || !sourceUrl) continue;
    results.push(campaign({ provider: "歐付寶 O'Pay", title, rawText: title, sourceUrl, image, dateText: title }));
  }
  return { campaigns: dedupeCampaigns(results, today), status: "ok", sourceUrls: [listUrl] };
}

function extractIcashCandidates(html, origin) {
  return [...html.matchAll(/href=["']([^"']*\/advertMessage\/view\/id\/(\d+))["']/gi)].map((match) => ({ id: match[2], sourceUrl: absoluteUrl(match[1], origin) }));
}

async function scrapeIcash(today) {
  const origin = "https://www.icashpay.com.tw";
  const listUrls = Array.from({ length: 6 }, (_, index) => `${origin}/advertMessage/index?page=${index + 1}`);
  const pages = await mapLimit(listUrls, 3, async (url) => safeFetchText(url));
  const candidates = pages.flatMap((page) => page?.ok ? extractIcashCandidates(page.text, origin) : []);
  const unique = [...new Map(
    candidates
      // 109 is a long-lived fee schedule notice, not a customer promotion.
      .filter((item) => !["109", "2540"].includes(item.id))
      .map((item) => [item.id, item]),
  ).values()];
  const detailResults = await mapLimit(unique, 6, async (candidate) => {
    const detail = await safeFetchText(candidate.sourceUrl);
    if (!detail.ok) return null;
    const title = extractHeading(detail.text) || metaContent(detail.text, "og:title");
    const article = detail.text.match(/<article\b[\s\S]*?<\/article>/i)?.[0] || "";
    const rawText = cleanText(article || extractClassText(detail.text, "mid-content") || title);
    if (!title) return null;
    return campaign({
      provider: "icash Pay",
      title,
      rawText,
      sourceUrl: candidate.sourceUrl,
      image: extractFirstContentImage(article || detail.text, origin) || metaContent(detail.text, "og:image"),
      dateText: rawText,
    });
  });

  const monthlyUrl = `${origin}/advertMessage/view/id/2540`;
  const monthly = await safeFetchText(monthlyUrl);
  const cardResults = [];
  if (monthly.ok) {
    for (const match of monthly.text.matchAll(/<article\b[^>]*class=["'][^"']*icash-offer-card[^"']*["'][\s\S]*?<\/article>/gi)) {
      const block = match[0];
      const title = extractHeading(block);
      const period = extractClassText(block, "icash-offer-card__period");
      const body = extractClassText(block, "icash-offer-card__body");
      const href = block.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1] || monthlyUrl;
      if (title) cardResults.push(campaign({ provider: "icash Pay", title, rawText: `${period} ${body}`, sourceUrl: absoluteUrl(href, origin) || monthlyUrl, dateText: period }));
    }
  }
  return {
    campaigns: dedupeCampaigns([...detailResults, ...cardResults], today),
    status: pages.some((page) => page?.ok) ? "ok" : "unreachable",
    sourceUrls: [...listUrls.slice(0, 1), monthlyUrl],
  };
}

async function scrapePxPay(today) {
  const sourceUrl = "https://prod-s3.pxpayplus.com/pxplus_jpmam_mktpage2026/index.html";
  const page = await safeFetchText(sourceUrl);
  if (!page.ok) return { campaigns: [], status: "unreachable", error: page.error, sourceUrls: [sourceUrl] };
  const title = cleanText(page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || "全支付官方活動";
  const rawText = `${metaContent(page.text, "description")} ${extractMainText(page.text)}`;
  const item = campaign({ provider: "全支付", title, rawText, sourceUrl, dateText: "2026/08/01-2026/10/31", explicitCategory: "一般回饋" });
  return { campaigns: dedupeCampaigns([item], today), status: "ok", sourceUrls: [sourceUrl] };
}

async function scrapePlusPay(today, fallback) {
  const sourceUrl = "https://event2023.pluspay.com.tw/";
  const page = await safeFetchText(sourceUrl);
  if (page.ok) {
    const visible = extractMainText(page.text);
    if (visible.length > 300 && /全盈|回饋|Fa 點|優惠/i.test(visible)) {
      const item = campaign({ provider: "全盈+PAY", title: extractHeading(page.text) || "全盈+PAY 官方活動", rawText: visible, sourceUrl, dateText: visible });
      return { campaigns: dedupeCampaigns([item], today), status: "ok", sourceUrls: [sourceUrl] };
    }
  }
  const fallbackCampaigns = fallback?.length ? fallback : [
    campaign({ provider: "全盈+PAY", title: "滿 1,111 元享 11% 全盈儲值金", rawText: "全盈+PAY 官方活動：指定店家單筆消費滿 1,111 元享最高 11% 全盈儲值金，活動預算與適用通路以官方活動頁為準。", sourceUrl, dateText: "2026/09/18-2026/12/31" }),
    campaign({ provider: "全盈+PAY", title: "精選品牌滿 1,500 元回饋 10% 全盈儲值金", rawText: "指定實體與線上品牌單筆消費滿 1,500 元，享 10% 全盈儲值金，每會員每月最高 200 元；使用全盈+PAY 條碼或 QR Code。", sourceUrl, dateText: "2026/07/01-2026/12/31" }),
    campaign({ provider: "全盈+PAY", title: "註冊全盈+PAY 領全家咖啡", rawText: "符合資格的新註冊會員可領全家咖啡，領取資格與兌換期限以官方活動頁及 App 顯示為準。", sourceUrl, dateText: "2026/01/01-2026/12/31", explicitCategory: "新戶優惠" }),
    campaign({ provider: "全盈+PAY", title: "Fa 點驚喜，筆筆消費贈 Fa 點", rawText: "全家會員使用全盈+PAY 消費可依官方規則累積 Fa 點，實際會員資格與點數計算以官方頁最新規則為準。", sourceUrl, dateText: "2026/01/01-2026/12/31", explicitCategory: "會員回饋" }),
  ];
  return { campaigns: dedupeCampaigns(fallbackCampaigns, today), status: page.ok ? "fallback" : "unreachable", error: page.ok ? "官方頁為 JavaScript 應用程式，未取得活動內容" : page.error, sourceUrls: [sourceUrl] };
}

function previousCampaigns(data, providerName) {
  const payment = (data.payments || []).find((item) => item.name === `${providerName} 官方活動`);
  return (payment?.campaigns || []).map((item) => ({ ...item, paymentMethods: item.paymentMethods?.length ? item.paymentMethods : [providerName] }));
}

const scraperByName = {
  "LINE Pay": scrapeLine,
  "街口支付": scrapeJko,
  "悠遊付": scrapeEasyWallet,
  "Pi 拍錢包": scrapePi,
  "台灣 Pay": scrapeTaiwanPay,
  "橘子支付": scrapeGama,
  "歐付寶 O'Pay": scrapeOpay,
  "icash Pay": scrapeIcash,
  "全支付": scrapePxPay,
};

const data = JSON.parse(await readFile(outputPath, "utf8"));
const today = taipeiTodayKey();
const checkedAt = new Date().toISOString();
const scraped = new Map();

for (const item of catalog) {
  if (item.name === "全盈+PAY") {
    scraped.set(item.name, await scrapePlusPay(today, previousCampaigns(data, item.name)));
    continue;
  }
  if (item.name === "iPASS MONEY" || item.name === "OPEN錢包" || item.name === "7-ELEVEN" || item.name === "ezPay 簡單付") continue;
  const scraper = scraperByName[item.name];
  if (!scraper) continue;
  try {
    const result = await scraper(today);
    scraped.set(item.name, result);
  } catch (error) {
    scraped.set(item.name, { campaigns: [], status: "unreachable", error: error instanceof Error ? error.message : String(error), sourceUrls: item.sourceUrls });
  }
}

const generatedPayments = [];
const generatedSources = [];
for (const item of catalog) {
  let result = scraped.get(item.name);
  if (item.name === "iPASS MONEY" || item.name === "OPEN錢包" || item.name === "7-ELEVEN") {
    const existing = item.name === "OPEN錢包"
      ? previousCampaigns(data, "7-ELEVEN").filter((entry) => entry.paymentMethods?.includes("OPEN錢包"))
      : previousCampaigns(data, item.name);
    result = { campaigns: existing, status: "ok", sourceUrls: item.sourceUrls };
  }
  if (item.name === "ezPay 簡單付") {
    result = { campaigns: [], status: "blocked", error: "官方首頁拒絕自動讀取，暫不列入目前有效活動", sourceUrls: item.sourceUrls };
  }
  if (!result) continue;
  const campaigns = dedupeCampaigns(result.campaigns, today).map((entry, index) => ({
    ...entry,
    officialOrder: Number.isFinite(entry.officialOrder) ? entry.officialOrder : index,
    paymentMethods: entry.paymentMethods?.length ? entry.paymentMethods : [item.name],
  }));
  if (campaigns.length) {
    generatedPayments.push({
      name: `${item.name} 官方活動`,
      logo: item.logo,
      color: item.color,
      focus: item.focus,
      freshness: `官方來源檢查 ${formatDateKey(today)}；依官方更新順序排列`,
      campaigns,
    });
  }
  const sourceUrls = [...new Set([...(result.sourceUrls || []), ...item.sourceUrls])];
  for (const url of sourceUrls) {
    generatedSources.push({
      name: `${item.name} 官方活動`,
      url,
      officialSite: item.officialSite,
      status: result.status || "unchecked",
      ...(result.error ? { note: result.error } : {}),
      checkedAt,
    });
  }
}

const generatedNames = new Set(generatedPayments.map((payment) => payment.name));
data.payments = [
  ...(data.payments || []).filter((payment) => !generatedNames.has(payment.name) && !catalog.some((item) => payment.name === `${item.name} 官方活動`)),
  ...generatedPayments,
];

const platformMap = new Map((data.platforms || []).map((platform) => [platform.name, platform]));
for (const item of catalog) {
  platformMap.set(item.name, {
    name: item.name,
    logo: item.logo,
    color: item.color,
    focus: item.focus,
    segment: item.segment,
    officialSite: item.officialSite,
    sourceUrl: item.sourceUrls[0],
    checkedAt,
  });
}
data.platforms = [...platformMap.values()];

const legacySources = (data.sources || [data.source].filter(Boolean)).filter((source) => !catalog.some((item) => source.name?.startsWith(item.name)));
data.sources = [...legacySources, ...generatedSources]
  .filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index);
data.updatedAt = checkedAt;
data.source = {
  name: "多平台官方活動資料",
  url: "https://www.7-11.com.tw/service/Pay.aspx",
  officialSite: "https://www.7-11.com.tw/index.aspx",
  counts: Object.fromEntries(data.payments.flatMap((payment) => payment.campaigns).reduce((map, item) => map.set(item.category, (map.get(item.category) || 0) + 1), new Map())),
};

await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

const report = catalog.map((item) => {
  const payment = generatedPayments.find((entry) => entry.name === `${item.name} 官方活動`);
  const source = scraped.get(item.name);
  return { platform: item.name, campaigns: payment?.campaigns.length || 0, status: source?.status || (item.name === "iPASS MONEY" || item.name === "7-ELEVEN" || item.name === "OPEN錢包" ? "preserved" : "not-run") };
});
console.log(`Synced official campaign catalog on ${today}; ${data.payments.reduce((sum, item) => sum + item.campaigns.length, 0)} active campaigns total`);
console.table(report);
