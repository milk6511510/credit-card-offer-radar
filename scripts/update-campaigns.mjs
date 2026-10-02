import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(root, "public", "data", "campaigns.json");

await loadDotEnv();

const googleApiKey = process.env.GOOGLE_API_KEY || "";
const googleCx = process.env.GOOGLE_CX || "";

const providers = [
  {
    name: "LINE Pay",
    logo: "/logos/line-pay.svg",
    color: "#06c755",
    focus: "飲料、餐飲、便利商店",
    fixedUrls: ["https://web-tw-pay.line.me/cms/event/template1.3/357dd951-e5b0-4ae5-b17c-2ece870821de"],
    searchQueries: ["LINE Pay 台灣 最新 優惠 活動 指定通路", "LINE Pay 飲料店 回饋 活動"],
  },
  {
    name: "icash Pay",
    logo: "/logos/icash-pay.png",
    color: "#ff8a1f",
    focus: "超商、咖啡、OPENPOINT 通路",
    fixedUrls: ["https://www.icashpay.com.tw/news"],
    searchQueries: ["icash Pay 最新 優惠 活動", "icash Pay 指定通路 回饋"],
  },
  {
    name: "街口支付",
    logo: "/logos/jkos-pay.png",
    color: "#ffca28",
    focus: "百貨、量販、外送平台",
    fixedUrls: ["https://mkt.jkopay.com/zh-TW/campaign/taobao"],
    searchQueries: ["街口支付 最新 優惠 活動", "街口支付 指定通路 回饋"],
  },
  {
    name: "台灣 Pay",
    logo: "/logos/taiwan-pay.png",
    color: "#2f73ff",
    focus: "在地商圈、繳費、交通",
    fixedUrls: ["https://www.tbb.com.tw/zh-tw/digital/hokii/promotion/latest/20260101"],
    searchQueries: ["台灣 Pay 最新 優惠 活動", "台灣 Pay 指定通路 回饋"],
  },
  {
    name: "Pi 拍錢包",
    logo: "/logos/pi-wallet.svg",
    color: "#8d5bff",
    focus: "交通、停車、生活通路",
    fixedUrls: ["https://web.piapp.com.tw/events-/"],
    searchQueries: ["Pi 拍錢包 最新 優惠 活動", "Pi 拍錢包 指定通路 回饋"],
  },
  {
    name: "iPASS MONEY",
    logo: "/logos/ipass-money.png",
    color: "#00a6d6",
    focus: "交通、商圈、生活繳費",
    fixedUrls: ["https://www.i-pass.com.tw/ips/event/linepay-ipass/page005.html"],
    searchQueries: ["iPASS MONEY 最新 優惠 活動", "一卡通 MONEY 指定通路 回饋"],
  },
];

const knownStores = [
  "明德正",
  "迷客夏",
  "可不可",
  "清心福全",
  "龜記",
  "50嵐",
  "茶湯會",
  "7-ELEVEN",
  "全家",
  "萊爾富",
  "OK mart",
  "星巴克",
  "CITY CAFE",
  "康是美",
  "全聯",
  "家樂福",
  "foodpanda",
  "Uber Eats",
  "YouBike",
  "台鐵",
  "高鐵",
  "捷運",
  "公車",
  "PChome",
  "淘寶",
  "SOGO",
  "新光三越",
];

async function loadDotEnv() {
  try {
    const env = await readFile(join(root, ".env"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env is optional for the basic scraper.
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCategory(text) {
  if (/飲料|手搖|咖啡|星巴克|明德正|迷客夏|可不可|清心|龜記/.test(text)) return "飲料店";
  if (/餐|美食|漢堡|外送|foodpanda|Uber Eats/.test(text)) return "餐飲";
  if (/超商|7-ELEVEN|全家|萊爾富|OK mart/.test(text)) return "超商";
  if (/交通|捷運|公車|高鐵|台鐵|YouBike|停車/.test(text)) return "交通";
  if (/百貨|量販|全聯|家樂福|SOGO|新光三越/.test(text)) return "百貨量販";
  if (/繳費|帳單|生活/.test(text)) return "生活繳費";
  if (/網購|淘寶|PChome|電商/.test(text)) return "網購";
  return "綜合優惠";
}

function inferRate(text) {
  const rates = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
    .map((match) => Number(match[1]))
    .filter((value) => value > 0 && value <= 100);
  return rates.length ? Math.max(...rates) / 100 : 0;
}

function inferCap(text) {
  const match = text.match(/(?:上限|最高|回饋上限|贈|送|折)\s*(?:NT\$|新台幣|臺幣|\$)?\s*(\d{2,5})\s*(?:元|點|P幣|券)?/);
  return match ? Number(match[1]) : 0;
}

function findStores(text) {
  // Do not treat a merchant/product name inside an exclusion note as a venue.
  const primaryText = String(text || "").split(/(?:注意事項|不適用店別|不適用商品|排除項目|排除商品)/i)[0];
  const stores = knownStores.filter((store) => primaryText.includes(store));
  return stores.length ? stores : ["指定通路"];
}

function titleFromText(text, providerName) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const sentences = cleaned.split(/[。！？\n]/).map((item) => item.trim()).filter(Boolean);
  const useful = sentences.find((item) => /優惠|活動|回饋|加碼|折抵|%|指定/.test(item)) || cleaned;
  return useful.slice(0, 64) || `${providerName} 最新優惠`;
}

function splitOfferCandidates(text) {
  const matches = text.match(/.{0,80}(?:優惠|活動|回饋|加碼|折抵|指定|滿額|%|LINE POINTS|OPENPOINT).{0,220}/g);
  const candidates = (matches || [text.slice(0, 520)])
    .map((item) => item.trim())
    .filter((item) => item.length >= 18);
  return [...new Set(candidates)].slice(0, 12);
}

async function googleSearch(query) {
  if (!googleApiKey || !googleCx) return [];
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", googleApiKey);
  url.searchParams.set("cx", googleCx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", "5");
  url.searchParams.set("lr", "lang_zh-TW");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Search failed: ${response.status}`);
  const result = await response.json();
  return (result.items || []).map((item) => item.link).filter(Boolean);
}

async function discoverUrls(provider) {
  const urls = new Set(provider.fixedUrls);
  for (const query of provider.searchQueries) {
    try {
      const links = await googleSearch(query);
      links.forEach((link) => urls.add(link));
    } catch (error) {
      console.warn(`${provider.name} Google search skipped: ${error.message}`);
    }
  }
  return [...urls].slice(0, googleApiKey && googleCx ? 10 : provider.fixedUrls.length);
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 offer-radar/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return stripHtml(await response.text());
}

async function campaignsFromUrl(provider, url) {
  const text = await fetchPage(url);
  return splitOfferCandidates(text).map((chunk) => ({
    title: titleFromText(chunk, provider.name),
    category: inferCategory(chunk),
    stores: findStores(chunk),
    rate: inferRate(chunk),
    cap: inferCap(chunk),
    status: /額滿|已滿|結束|終止/.test(chunk) ? "疑似額滿或結束" : "待確認",
    sourceUrl: url,
    rawText: chunk.slice(0, 360),
  }));
}

function fallbackCampaigns(providerName) {
  const fallback = {
    "LINE Pay": [
      ["指定飲料店 8% LINE POINTS", "飲料店", ["明德正", "迷客夏", "可不可"], 0.08, 100],
      ["週末餐飲滿百加碼", "餐飲", ["麥當勞", "肯德基", "摩斯漢堡"], 0.06, 120],
    ],
    "icash Pay": [["OPENPOINT 指定通路 10%", "超商", ["7-ELEVEN", "星巴克", "康是美"], 0.1, 150]],
    "街口支付": [
      ["量販百貨最高 6%", "百貨量販", ["全聯", "家樂福"], 0.06, 220],
      ["外送平台週三加碼", "餐飲", ["foodpanda", "Uber Eats"], 0.07, 80],
    ],
    "台灣 Pay": [["台灣 Pay 指定消費回饋", "商圈", ["傳統市場", "合作店家"], 0.12, 200]],
    "Pi 拍錢包": [["交通通勤最高 12%", "交通", ["台鐵", "高鐵", "YouBike"], 0.12, 80]],
    "iPASS MONEY": [["一卡通 MONEY 指定生活通路 6%", "生活繳費", ["全家", "萊爾富", "指定商圈"], 0.06, 100]],
  }[providerName] || [];

  return fallback.map(([title, category, stores, rate, cap]) => ({
    title,
    category,
    stores,
    rate,
    cap,
    status: "示範備援",
    sourceUrl: "",
  }));
}

function dedupeCampaigns(campaigns) {
  const seen = new Set();
  return campaigns.filter((campaign) => {
    const key = `${campaign.title}-${campaign.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const payments = [];
const sourceResults = [];

for (const provider of providers) {
  const urls = await discoverUrls(provider);
  const campaigns = [];

  for (const url of urls) {
    try {
      const parsed = await campaignsFromUrl(provider, url);
      campaigns.push(...parsed);
      sourceResults.push({ provider: provider.name, url, ok: true });
    } catch (error) {
      sourceResults.push({ provider: provider.name, url, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const cleanCampaigns = dedupeCampaigns(campaigns).slice(0, 18);
  payments.push({
    name: provider.name,
    logo: provider.logo,
    color: provider.color,
    focus: provider.focus,
    freshness: googleApiKey && googleCx ? "Google 搜尋同步" : "固定來源同步",
    campaigns: cleanCampaigns.length ? cleanCampaigns : fallbackCampaigns(provider.name),
  });
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ updatedAt: new Date().toISOString(), sources: sourceResults, payments }, null, 2)}\n`, "utf8");
console.log(`Updated ${outputPath}`);
console.log(googleApiKey && googleCx ? "Google Custom Search enabled." : "Google Custom Search not configured. Using fixed URLs only.");
