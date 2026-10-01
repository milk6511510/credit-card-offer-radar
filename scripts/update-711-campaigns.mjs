import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const sourceUrl = "https://www.7-11.com.tw/include/SalesPromo.xml?12";
const siteOrigin = "https://www.7-11.com.tw";

const typeMap = {
  Event: { label: "主題活動", color: "#00a651" },
  Food: { label: "精選美味", color: "#f58220" },
  Product: { label: "嚴選商品", color: "#ed1b2f" },
  News: { label: "便利生活", color: "#0072bc" },
};

function textOf(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return cleanText(match?.[1] || "");
}

function cleanText(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(font|span|p|div|strong|b|u|ol|ul|li|a|table|tbody|tr|td|th)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveUrl(value) {
  if (!value || value === "No" || value.includes("[Disable]")) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return new URL(value, siteOrigin).toString();
}

function inferRate(text) {
  const rateMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
    .map((match) => Number(match[1]) / 100)
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 1);
  return rateMatches.length ? Math.max(...rateMatches) : 0;
}

function inferCap(text) {
  const capMatches = [...text.matchAll(/(?:上限|最高|限得|回饋上限|折抵上限|贈|送|折)\D{0,8}(\d{1,5})\s*(?:元|點|P|OPENPOINT)/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  return capMatches.length ? Math.max(...capMatches) : 0;
}

function inferTags(text, category) {
  const tags = new Set(["7-ELEVEN", category]);
  const keywords = [
    "uniopen",
    "OPENPOINT",
    "icash Pay",
    "LINE Pay",
    "街口支付",
    "台灣Pay",
    "iPASS MONEY",
    "Pi 拍錢包",
    "Apple Pay",
    "Google Pay",
    "CITY CAFE",
    "CITY TEA",
    "思樂冰",
    "OPEN錢包",
  ];
  keywords.forEach((keyword) => {
    if (text.toLowerCase().includes(keyword.toLowerCase())) tags.add(keyword);
  });
  return [...tags];
}

const paymentPatterns = [
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

function inferPaymentMethods(text) {
  return paymentPatterns.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function inferAudience(text) {
  const newUser = /新戶|新客|新會員|新申辦|首次|首刷|首筆|新卡友/i.test(text);
  const existingUser = /既有|原卡友|持卡人|續卡|老客|已持有/i.test(text);
  if (newUser && existingUser) return "mixed";
  if (newUser) return "new-user";
  if (existingUser) return "existing-user";
  return "not-stated";
}

function twStatus(sDate, eDate, period) {
  if (period) return period;
  if (sDate && eDate) return `${sDate.slice(0, 4)}/${sDate.slice(4, 6)}/${sDate.slice(6, 8)}-${eDate.slice(0, 4)}/${eDate.slice(4, 6)}/${eDate.slice(6, 8)}`;
  return "活動期間依官方公告";
}

async function main() {
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`7-ELEVEN source failed: ${response.status}`);
  }

  const xml = new TextDecoder("utf-8").decode(Buffer.from(await response.arrayBuffer()));
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const items = [...xml.matchAll(/<Item\b[^>]*>[\s\S]*?<\/Item>/gi)].map((match) => match[0]);

  const campaigns = items
    .map((item) => {
      const type = textOf(item, "IType") || item.match(/IType="([^"]+)"/)?.[1] || "Event";
      const category = typeMap[type]?.label || "其他活動";
      const title = textOf(item, "APP_BannerTitle") || textOf(item, "Mobile_APP_BigBannerTitle");
      const period = textOf(item, "Period");
      const content = [textOf(item, "Content"), textOf(item, "Remark")].filter(Boolean).join(" ");
      const sDate = textOf(item, "SDate");
      const eDate = textOf(item, "EDate");
      const link = resolveUrl(textOf(item, "Link"));
      const image = resolveUrl(textOf(item, "Image"));
      const searchableText = [title, period, content].join(" ");
      const paymentMethods = inferPaymentMethods(searchableText);

      return {
        title,
        category,
        stores: inferTags(searchableText, category),
        paymentMethods,
        audience: inferAudience(searchableText),
        rate: inferRate(searchableText),
        cap: inferCap(searchableText),
        status: twStatus(sDate, eDate, period),
        sourceUrl: link,
        officialId: link.match(/[?&]item=([^&]+)/i)?.[1] || "",
        image,
        rawText: content || period || "詳細活動條件請以 7-ELEVEN 官方頁面為準。",
        startsAt: sDate,
        endsAt: eDate,
      };
    })
    .filter((campaign) => campaign.title && (!campaign.endsAt || campaign.endsAt >= today))
    .sort((a, b) => (a.category === b.category ? a.title.localeCompare(b.title, "zh-Hant") : a.category.localeCompare(b.category, "zh-Hant")));

  const groupedCounts = campaigns.reduce((acc, campaign) => {
    acc[campaign.category] = (acc[campaign.category] || 0) + 1;
    return acc;
  }, {});

  const data = {
    updatedAt: new Date().toISOString(),
    source: {
      name: "7-ELEVEN 官方活動 XML",
      url: sourceUrl,
      officialSite: "https://www.7-11.com.tw/index.aspx",
      counts: groupedCounts,
    },
    payments: [
      {
        name: "7-ELEVEN 官方活動",
        logo: "/logos/7-eleven.png",
        color: "#00a651",
        focus: "同步 7-ELEVEN 官網主題活動、精選美味、嚴選商品與便利生活。",
        freshness: "官方 XML 即時更新",
        campaigns,
      },
    ],
  };

  const outputPath = path.join(process.cwd(), "public", "data", "campaigns.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Imported ${campaigns.length} 7-ELEVEN campaigns`);
  console.table(groupedCounts);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
