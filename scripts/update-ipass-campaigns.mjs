import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputPath = path.join(root, "public", "data", "campaigns.json");
const listOrigin = "https://www.i-pass.com.tw";
const listUrl = `${listOrigin}/Preferential?page=1&type=0`;
const federatedStatusUrl = "https://activity.ubot.com.tw/aws_act/2026/2026ipassmoney/index.htm";

function cleanText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function dateKey(value) {
  const match = String(value || "").match(/(20\d{2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!match) return "";
  return `${match[1]}${match[2].padStart(2, "0")}${match[3].padStart(2, "0")}`;
}

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

function inferRate(text) {
  const rates = [...String(text || "").matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
    .map((match) => Number(match[1]))
    .filter((value) => value > 0 && value <= 100);
  return rates.length ? Math.max(...rates) / 100 : 0;
}

function inferCap(text) {
  const values = [...String(text || "").matchAll(/(?:上限|最高|回饋|贈|送|優惠券)\D{0,12}([\d,]{1,7})\s*(?:元|點|券)/g)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => value > 0 && value < 10000 && !(value >= 1900 && value <= 2100));
  return values.length ? Math.max(...values) : 0;
}

function inferCategory(text) {
  if (/乘車|交通|捷運|高鐵|台鐵|TPASS|yoxi|WeMo/i.test(text)) return "交通活動";
  if (/繳費|數位券|生活|轉帳/i.test(text)) return "生活服務";
  if (/銀行|貸款|信用卡|帳戶|綠點|自動加值/i.test(text)) return "金融回饋";
  if (/百貨|購物|誠品|微風|漢神|SKM|momo|PayPay/i.test(text)) return "指定通路";
  return "iPASS MONEY 活動";
}

function inferStores(text) {
  const storeKeywords = [
    "誠品生活",
    "誠品書店",
    "漢神百貨",
    "漢神巨蛋",
    "SKM Park",
    "WeMo",
    "高雄巨蛋",
    "高雄流行音樂中心",
    "微風集團",
    "樂天銀行",
    "PayPay",
    "momo",
    "四大超商",
    "指定店家",
    "TWQR",
    "TPASS",
  ];
  const stores = storeKeywords.filter((store) => text.toLowerCase().includes(store.toLowerCase()));
  return stores.length ? stores : ["iPASS MONEY 官方活動"];
}

function inferAudience(text) {
  const newUser = /新戶|新客|新會員|首次|新開通|未曾使用/i.test(text);
  const existingUser = /既有|原卡友|持卡人|續卡|已持有/i.test(text);
  if (newUser && existingUser) return "mixed";
  if (newUser) return "new-user";
  if (existingUser) return "existing-user";
  return "not-stated";
}

function extractCards(html) {
  const pattern = /<div class="portfolio-title">[\s\S]*?<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span class="labeldate">([\s\S]*?)<\/span>\s*~\s*<span class="labeldate">([\s\S]*?)<\/span>[\s\S]*?<span class="label3[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>/gi;
  const cards = [];
  let match;
  while ((match = pattern.exec(html))) {
    const title = cleanText(match[2]);
    const label = cleanText(match[5]);
    if (!title || !/iPASS MONEY|一卡通/i.test(`${title} ${label}`)) continue;
    cards.push({
      title,
      startLabel: cleanText(match[3]),
      endLabel: cleanText(match[4]),
      startsAt: dateKey(match[3]),
      endsAt: dateKey(match[4]),
      sourceUrl: new URL(match[1], listOrigin).toString(),
    });
  }
  return cards;
}

function detailText(html, fallback) {
  const marker = html.search(/<p[^>]*>[\s\S]{0,300}?活動(?:期間|日期|內容)/i);
  if (marker < 0) return fallback;
  const footer = html.search(/<footer\b/i);
  const end = footer > marker ? footer : Math.min(html.length, marker + 18000);
  const text = cleanText(html.slice(marker, end));
  return text.slice(0, 1800) || fallback;
}

function detailImage(html) {
  return html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
}

async function fetchText(url, redirectDepth = 0) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0 reward-radar/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const html = await response.text();
  // Some official iPASS detail pages hand off to a CDN with a JavaScript
  // redirect instead of an HTTP redirect. Follow it so the detail content
  // and any exhaustion notice remain available to the history parser.
  const redirect = html.match(/redirectUrl\s*=\s*["']([^"']+)["']/i)?.[1];
  if (redirect && redirectDepth < 2) {
    const target = decodeURIComponent(redirect);
    if (target && target !== url) return fetchText(new URL(target, url).toString(), redirectDepth + 1);
  }
  return html;
}

async function discoverListPages(firstHtml) {
  const pages = new Set([1]);
  for (const match of firstHtml.matchAll(/href=["']([^"']*\/Preferential\?[^"']*)["']/gi)) {
    try {
      const url = new URL(match[1].replace(/&amp;/gi, "&"), listOrigin);
      if (url.pathname !== "/Preferential" || url.searchParams.get("type") !== "0") continue;
      const page = Number(url.searchParams.get("page") || "1");
      if (Number.isInteger(page) && page > 0 && page <= 8) pages.add(page);
    } catch {
      // Ignore malformed pagination links and continue with known pages.
    }
  }
  return [...pages].sort((a, b) => a - b);
}

async function loadFederatedStatus() {
  try {
    const html = await fetchText(federatedStatusUrl);
    const text = cleanText(html);
    const statuses = [...text.matchAll(/(\d{1,2})月活動已(?:於[^。；]{0,48})?(?:額滿|滿額|用罄|送完)/gi)]
      .map((match) => `${Number(match[1])}月活動已額滿`)
      .filter((status, index, all) => all.indexOf(status) === index);
    return { statuses, sourceUrl: federatedStatusUrl };
  } catch (error) {
    console.warn(`聯邦 iPASS MONEY 額滿頁 skipped: ${error.message}`);
    return { statuses: [], sourceUrl: federatedStatusUrl };
  }
}

async function loadActiveCampaigns() {
  const today = taipeiTodayKey();
  const firstHtml = await fetchText(listUrl);
  const pages = await discoverListPages(firstHtml);
  const htmlByPage = new Map([[1, firstHtml]]);

  for (const page of pages.slice(1)) {
    htmlByPage.set(page, await fetchText(`${listOrigin}/Preferential?page=${page}&type=0`));
  }

  const candidates = [...htmlByPage.values()]
    .flatMap((html) => extractCards(html))
    .filter((campaign) => campaign.endsAt && campaign.endsAt >= today && (!campaign.startsAt || campaign.startsAt <= today))
    .filter((campaign, index, all) => all.findIndex((item) => item.sourceUrl === campaign.sourceUrl) === index);

  const campaigns = [];
  for (let index = 0; index < candidates.length; index += 4) {
    const batch = await Promise.all(candidates.slice(index, index + 4).map(async (candidate) => {
      const fallback = `活動期間：${candidate.startLabel} - ${candidate.endLabel}。詳細活動條件請以 iPASS MONEY 官方活動頁為準。`;
      try {
        const html = await fetchText(candidate.sourceUrl);
        const rawText = detailText(html, fallback);
        return {
          title: candidate.title,
          category: inferCategory(`${candidate.title} ${rawText}`),
          stores: inferStores(`${candidate.title} ${rawText}`),
          paymentMethods: ["iPASS MONEY"],
          audience: inferAudience(`${candidate.title} ${rawText}`),
          rate: inferRate(`${candidate.title} ${rawText}`),
          cap: inferCap(`${candidate.title} ${rawText}`),
          status: `${candidate.startLabel} - ${candidate.endLabel}`,
          sourceUrl: candidate.sourceUrl,
          officialId: candidate.sourceUrl.split("/").pop() || "",
          image: detailImage(html),
          rawText,
          startsAt: candidate.startsAt,
          endsAt: candidate.endsAt,
        };
      } catch (error) {
        console.warn(`iPASS MONEY detail skipped: ${candidate.sourceUrl} (${error.message})`);
        return {
          title: candidate.title,
          category: inferCategory(candidate.title),
          stores: inferStores(candidate.title),
          paymentMethods: ["iPASS MONEY"],
          audience: inferAudience(candidate.title),
          rate: inferRate(candidate.title),
          cap: inferCap(candidate.title),
          status: `${candidate.startLabel} - ${candidate.endLabel}`,
          sourceUrl: candidate.sourceUrl,
          officialId: candidate.sourceUrl.split("/").pop() || "",
          image: "",
          rawText: fallback,
          startsAt: candidate.startsAt,
          endsAt: candidate.endsAt,
        };
      }
    }));
    campaigns.push(...batch);
  }

  return { campaigns, today };
}

const data = JSON.parse(await readFile(outputPath, "utf8"));
const { campaigns: activeCampaigns, today } = await loadActiveCampaigns();
const federatedStatus = await loadFederatedStatus();
const campaigns = activeCampaigns.map((campaign) => {
  if (!/用 iPASS MONEY 消費[，,、 ]*最高享[ ]*10%[ ]*回饋/.test(campaign.title) || !federatedStatus.statuses.length) return campaign;
  return {
    ...campaign,
    exhaustionSourceUrl: federatedStatus.sourceUrl,
    rawText: `${campaign.rawText} 官方聯邦活動頁額滿狀態：${federatedStatus.statuses.join("；")}`,
  };
});
const payments = (data.payments || []).filter((payment) => payment.name !== "iPASS MONEY 官方活動");
payments.push({
  name: "iPASS MONEY 官方活動",
  logo: "/logos/ipass-money.png",
  color: "#00a6d6",
  focus: "同步 iPASS MONEY 官方優惠活動，保留目前仍有效的活動與原始細節。",
  freshness: `官方優惠活動列表（截至 ${today.slice(0, 4)}/${today.slice(4, 6)}/${today.slice(6)}）`,
  campaigns,
});

const sourceEntries = data.sources?.length ? data.sources : [data.source].filter(Boolean);
data.sources = [
  ...sourceEntries.filter((source) => source.name !== "iPASS MONEY 官方優惠活動"),
  {
    name: "iPASS MONEY 官方優惠活動",
    url: listUrl,
    officialSite: `${listOrigin}/Preferential`,
  },
  {
    name: "聯邦銀行 iPASS MONEY 額滿公告",
    url: federatedStatusUrl,
    officialSite: federatedStatusUrl,
  },
];
data.payments = payments;
data.updatedAt = new Date().toISOString();
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`Imported ${campaigns.length} active iPASS MONEY campaigns as of ${today}`);
