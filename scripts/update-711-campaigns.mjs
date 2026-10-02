import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const sourceUrl = "https://www.7-11.com.tw/include/SalesPromo.xml?12";
const paymentSourceUrl = "https://www.7-11.com.tw/service/Pay.aspx";
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

function stripComments(value) {
  return String(value || "").replace(/<!--[\s\S]*?-->/g, " ");
}

function resolveUrl(value) {
  if (!value || value === "No" || value.includes("[Disable]")) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return new URL(value, siteOrigin).toString();
}

function parseDateToken(value, fallbackYear = new Date().getFullYear()) {
  const match = String(value || "").match(/(20\d{2}|1\d{2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  if (!match) {
    const shortMatch = String(value || "").match(/(\d{1,2})\s*[./-]\s*(\d{1,2})/);
    if (!shortMatch) return "";
    return `${fallbackYear}${shortMatch[1].padStart(2, "0")}${shortMatch[2].padStart(2, "0")}`;
  }
  const year = Number(match[1]) < 1911 ? Number(match[1]) + 1911 : Number(match[1]);
  return `${year}${match[2].padStart(2, "0")}${match[3].padStart(2, "0")}`;
}

function parsePayPeriod(value) {
  const text = cleanText(value).replace(/即日起/gi, "");
  const fullDates = [...text.matchAll(/(?:20\d{2}|1\d{2})\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2}/g)].map((match) => match[0]);
  if (fullDates.length >= 2) {
    return { startsAt: parseDateToken(fullDates[0]), endsAt: parseDateToken(fullDates[1]) };
  }
  const shortened = text.match(/((?:20\d{2}|1\d{2})\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2})\s*(?:~|～|-|–|—|至|到)\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  if (shortened) {
    const startsAt = parseDateToken(shortened[1]);
    const year = startsAt.slice(0, 4);
    return { startsAt, endsAt: `${year}${shortened[2].padStart(2, "0")}${shortened[3].padStart(2, "0")}` };
  }
  const shortRange = text.match(/(\d{1,2})\s*[./-]\s*(\d{1,2})\s*(?:~|～|-|–|—|至|到)\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/);
  if (shortRange) {
    const year = String(new Date().getFullYear());
    return {
      startsAt: `${year}${shortRange[1].padStart(2, "0")}${shortRange[2].padStart(2, "0")}`,
      endsAt: `${year}${shortRange[3].padStart(2, "0")}${shortRange[4].padStart(2, "0")}`,
    };
  }
  return { startsAt: parseDateToken(fullDates[0] || text), endsAt: "" };
}

function inferRate(text) {
  const rates = [...String(text || "").matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
    .map((match) => Number(match[1]))
    .filter((value) => value > 0 && value <= 100);
  const discountRates = [...String(text || "").matchAll(/([2-9])\s*折/g)]
    .map((match) => (10 - Number(match[1])))
    .filter((value) => value > 0 && value < 10);
  return Math.max(...rates, ...discountRates, 0) / 100;
}

function inferCap(text) {
  const values = [...String(text || "").matchAll(/(?:上限|最高|限得|回饋上限|每月最高|每筆最高|折抵上限|贈|送|折)\D{0,14}([\d,]{1,8})\s*(?:元|點|P幣|OPENPOINT|OP點)/gi)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.max(...values) : 0;
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

function rowCell(row, title) {
  const match = row.match(new RegExp(`<td[^>]*data-title=["']${title}["'][^>]*>([\\s\\S]*?)<\\/td>`, "i"));
  return cleanText(match?.[1] || "");
}

function rowLink(row) {
  const match = row.match(/<td[^>]*data-title=["']活動網址["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["']/i);
  return resolveUrl((match?.[1] || "").trim());
}

function parsePaymentRows(html, today) {
  const activeHtml = stripComments(html);
  const rows = [...activeHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  return rows.map((row) => {
    const paymentTool = rowCell(row, "支付工具");
    const bank = rowCell(row, "銀行卡別");
    const period = rowCell(row, "活動期間");
    const detail = rowCell(row, "於7-ELEVEN消費");
    const sourceUrl = rowLink(row) || paymentSourceUrl;
    const text = [paymentTool, bank, period, detail].filter(Boolean).join(" ");
    const { startsAt, endsAt } = parsePayPeriod(period);
    if (!paymentTool || !detail || (endsAt && endsAt < today) || (startsAt && startsAt > today)) return null;
    const methods = inferPaymentMethods(text);
    const category = /OPEN錢包/i.test(text)
      ? "OPEN錢包回饋"
      : /icash/i.test(text)
        ? "icash Pay／icash 回饋"
        : /Pi\s*拍錢包/i.test(text)
          ? "Pi 拍錢包回饋"
          : /悠遊付/i.test(text)
            ? "悠遊付回饋"
            : /LINE\s*Pay/i.test(text)
              ? "LINE Pay 回饋"
              : /街口支付/i.test(text)
                ? "街口支付回饋"
                : "7-ELEVEN 支付回饋";
    return {
      title: `${paymentTool.replace(/\s+/g, " ")}｜7-ELEVEN 回饋`,
      category,
      stores: ["7-ELEVEN", bank].filter(Boolean),
      paymentMethods: ["7-ELEVEN", ...methods.filter((method) => method !== "7-ELEVEN")],
      audience: inferAudience(text),
      rate: inferRate(text),
      cap: inferCap(text),
      rewardLabel: inferRate(text) ? `最高 ${Math.round(inferRate(text) * 100)}% 回饋` : inferCap(text) ? `最高 ${inferCap(text).toLocaleString("zh-TW")} 點／元` : "依官方條件回饋",
      status: period || "活動期間依官方公告",
      sourceUrl,
      officialId: sourceUrl.match(/[?&]item=([^&]+)/i)?.[1] || "",
      rawText: `支付工具：${paymentTool}${bank ? `；銀行／卡別：${bank}` : ""}；活動期間：${period || "依官方公告"}；7-ELEVEN 消費：${detail}`,
      startsAt,
      endsAt,
    };
  }).filter(Boolean);
}

async function main() {
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`7-ELEVEN source failed: ${response.status}`);
  }

  const xml = new TextDecoder("utf-8").decode(Buffer.from(await response.arrayBuffer()));
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const items = [...xml.matchAll(/<Item\b[^>]*>[\s\S]*?<\/Item>/gi)].map((match) => match[0]);

  const xmlCampaigns = items
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
      const paymentMethods = ["7-ELEVEN", ...inferPaymentMethods(searchableText).filter((method) => method !== "7-ELEVEN")];

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
    .filter((campaign) => campaign.title && (!campaign.startsAt || campaign.startsAt <= today) && (!campaign.endsAt || campaign.endsAt >= today))
    .sort((a, b) => (a.category === b.category ? a.title.localeCompare(b.title, "zh-Hant") : a.category.localeCompare(b.category, "zh-Hant")));

  const paymentResponse = await fetch(paymentSourceUrl, { cache: "no-store" });
  const paymentHtml = paymentResponse.ok ? await paymentResponse.text() : "";
  const paymentCampaigns = paymentHtml ? parsePaymentRows(paymentHtml, today) : [];
  const campaigns = [...xmlCampaigns, ...paymentCampaigns]
    .filter((campaign, index, all) => all.findIndex((item) => `${item.title}|${item.sourceUrl}|${item.rawText}` === `${campaign.title}|${campaign.sourceUrl}|${campaign.rawText}`) === index)
    .sort((a, b) => (b.rate || 0) - (a.rate || 0) || (b.cap || 0) - (a.cap || 0) || a.title.localeCompare(b.title, "zh-Hant"));

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
    sources: [
      {
        name: "7-ELEVEN 官方活動 XML",
        url: sourceUrl,
        officialSite: "https://www.7-11.com.tw/index.aspx",
        status: "ok",
        checkedAt: new Date().toISOString(),
      },
      {
        name: "7-ELEVEN 支付工具優惠活動",
        url: paymentSourceUrl,
        officialSite: "https://www.7-11.com.tw/index.aspx",
        status: paymentResponse.ok ? "ok" : `http-${paymentResponse.status}`,
        checkedAt: new Date().toISOString(),
      },
    ],
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
