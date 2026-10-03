import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputPath = path.join(root, "public", "data", "campaigns.json");

function canonicalPlatform(name) {
  return String(name || "").replace(/\s*官方活動$/, "").trim();
}

function cleanText(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function currentTaipeiYear() {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", year: "numeric" }).format(new Date());
}

function dateFromCampaign(campaign) {
  const value = String(campaign.startsAt || "");
  return /^\d{8}$/.test(value) ? value.slice(0, 4) : currentTaipeiYear();
}

function normalizeHour(hour, meridiem) {
  const value = Number(hour);
  if (!meridiem || value > 12) return value;
  const normalized = meridiem.toLowerCase().replace(/\./g, "");
  if (normalized === "pm" && value < 12) return value + 12;
  if (normalized === "am" && value === 12) return 0;
  return value;
}

function rateFromText(value) {
  const matches = [...String(value || "").matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
    .map((match) => Number(match[1]) / 100)
    .filter((rate) => rate > 0 && rate <= 1);
  return matches.at(-1) || 0;
}

function formatRate(rate) {
  const percent = rate * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1).replace(/\.0$/, "")}%`;
}

const bankAliases = [
  ["合作金庫", "合作金庫"],
  ["合庫", "合作金庫"],
  ["聯邦", "聯邦銀行"],
  ["中信", "中信銀行"],
  ["國泰世華", "國泰世華銀行"],
  ["國泰", "國泰銀行"],
  ["玉山", "玉山銀行"],
  ["兆豐", "兆豐銀行"],
  ["富邦", "富邦銀行"],
  ["華南", "華南銀行"],
  ["第一", "第一銀行"],
  ["一銀", "第一銀行"],
  ["陽信", "陽信銀行"],
  ["滙豐", "滙豐銀行"],
  ["台中", "台中銀行"],
  ["王道", "王道銀行"],
];

function inferBank(text, index) {
  const value = String(text || "");
  const lineStart = value.lastIndexOf("\n", Math.max(0, index - 1));
  const lineEnd = value.indexOf("\n", index);
  const line = value.slice(lineStart + 1, lineEnd < 0 ? value.length : lineEnd);
  for (const [alias, label] of bankAliases) {
    if (line.includes(alias)) return label;
  }
  return "";
}

function inferMerchant(platform, title, context) {
  const titleValue = String(title || "");
  const contextValue = String(context || "");
  if (platform === "OPEN錢包" || /7[-\s]?ELEVEN|統一超商/i.test(titleValue)) return "7-ELEVEN";
  if (/星巴克|STARBUCKS/i.test(titleValue)) return "星巴克";
  if (/萊爾富/i.test(titleValue)) return "萊爾富";
  if (/全通路/i.test(contextValue)) return "全通路";
  if (/7[-\s]?ELEVEN|統一超商/i.test(contextValue)) return "7-ELEVEN";
  if (/星巴克|STARBUCKS/i.test(contextValue)) return "星巴克";
  if (/萊爾富/i.test(contextValue)) return "萊爾富";
  return "";
}

function buildDateParts(match) {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const hour = match[4] ? normalizeHour(match[4], match[7]) : null;
  const time = hour === null ? "" : `${String(hour).padStart(2, "0")}:${match[5]}${match[6] ? `:${match[6]}` : ""}`;
  return {
    month: `${year}-${String(month).padStart(2, "0")}`,
    date,
    time,
    exhaustedAt: time ? `${date}T${time}${match[6] ? "" : ":00"}+08:00` : "",
  };
}

function addRecord(records, record) {
  const baseKey = [record.platform, record.sourceUrl, record.month, record.bank || "", record.exhaustedDate || ""].join("|");
  const nextTime = String(record.exhaustedTime || "");
  const existingIndex = records.findIndex((item) => {
    const sameBase = [item.platform, item.sourceUrl, item.month, item.bank || "", item.exhaustedDate || ""].join("|") === baseKey;
    if (!sameBase) return false;
    const existingTime = String(item.exhaustedTime || "");
    return !existingTime || !nextTime || existingTime === nextTime || existingTime.startsWith(nextTime) || nextTime.startsWith(existingTime);
  });
  if (existingIndex < 0) {
    records.push({ ...record, id: `${baseKey}|${record.exhaustedTime || ""}` });
    return;
  }

  const existing = records[existingIndex];
  const existingTime = String(existing.exhaustedTime || "");
  if (!existingTime || !nextTime || existingTime === nextTime) return;
  if (nextTime.startsWith(existingTime)) {
    records[existingIndex] = { ...existing, ...record, id: `${baseKey}|${nextTime}` };
  }
}

function dedupeHistoryRecords(records) {
  const unique = [];
  for (const record of records) {
    const baseKey = [record.platform, record.sourceUrl, record.month, record.bank || "", record.exhaustedDate || ""].join("|");
    const nextTime = String(record.exhaustedTime || "");
    const existingIndex = unique.findIndex((item) => {
      const sameBase = [item.platform, item.sourceUrl, item.month, item.bank || "", item.exhaustedDate || ""].join("|") === baseKey;
      if (!sameBase) return false;
      const existingTime = String(item.exhaustedTime || "");
      return !existingTime || !nextTime || existingTime === nextTime || existingTime.startsWith(nextTime) || nextTime.startsWith(existingTime);
    });
    if (existingIndex < 0) {
      unique.push(record);
      continue;
    }

    const existing = unique[existingIndex];
    const existingTime = String(existing.exhaustedTime || "");
    if (existingTime === nextTime) continue;
    if (!existingTime || (nextTime && nextTime.startsWith(existingTime))) unique[existingIndex] = record;
    else if (existingTime && nextTime && existingTime.startsWith(nextTime)) continue;
    else unique.push(record);
  }
  return unique;
}

function extractDateRecords(platform, campaign, records) {
  const text = `${campaign.title || ""}\n${campaign.rawText || ""}`;
  if (platform === "OPEN錢包" && !String(campaign.title || "").startsWith("OPEN錢包綁")) return;
  if (platform === "iPASS MONEY" && !/額滿/.test(campaign.title || "")) return;
  const pattern = /(20\d{2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm)?)?[\s\S]{0,28}?(額滿|用罄|售完|送完)/gi;
  for (const match of text.matchAll(pattern)) {
    const index = Number(match.index || 0);
    const before = text.slice(Math.max(0, index - 72), index);
    const contextBeforeMatch = `${before} ${match[0]}`;
    if (!/(已於|已額滿|提前額滿|回饋上限|贈點|名額|額滿)/.test(contextBeforeMatch) || /例如|範例|舉例/.test(before)) continue;
    const parts = buildDateParts(match);
    const context = cleanText(text.slice(Math.max(0, index - 115), index + match[0].length + 80));
    const lineStart = text.lastIndexOf("\n", Math.max(0, index - 1));
    const lineContext = text.slice(lineStart + 1, index);
    const nearbyContext = text.slice(Math.max(0, index - 360), index);
    const rate = rateFromText(nearbyContext) || rateFromText(lineContext) || rateFromText(campaign.title);
    const bank = inferBank(text, index);
    const merchant = inferMerchant(platform, campaign.title, lineContext);
    addRecord(records, {
      platform,
      month: parts.month,
      campaignTitle: campaign.title,
      merchant: merchant || undefined,
      bank: bank || undefined,
      rewardLabel: rate ? `${formatRate(rate)} 回饋` : "活動回饋",
      rate: rate || undefined,
      cap: campaign.cap || undefined,
      exhaustedAt: parts.exhaustedAt || undefined,
      exhaustedDate: parts.date,
      exhaustedTime: parts.time || undefined,
      exhaustionType: "quota-full",
      confidence: parts.time ? "exact" : "date-only",
      evidence: context,
      sourceUrl: campaign.sourceUrl || "",
      source: "official",
    });
  }
}

function extractOpenMonthRecords(platform, campaign, records) {
  if (platform !== "OPEN錢包") return;
  if (!String(campaign.title || "").startsWith("OPEN錢包綁")) return;
  const text = `${campaign.title || ""}\n${campaign.rawText || ""}`;
  const pattern = /(\d{1,2})月(?:份)?[^。\n]{0,64}?已(?:於[^。\n]{0,40})?(?:額滿|滿額|兌換完畢|用罄|送完)/gi;
  for (const match of text.matchAll(pattern)) {
    const monthNumber = String(Number(match[1])).padStart(2, "0");
    const year = dateFromCampaign(campaign);
    const bank = campaign.title.match(/OPEN錢包綁\s*([^｜|：:]+)/)?.[1]?.trim() || "";
    addRecord(records, {
      platform,
      month: `${year}-${monthNumber}`,
      campaignTitle: campaign.title,
      merchant: "7-ELEVEN",
      bank: bank || undefined,
      rewardLabel: campaign.rate ? `${formatRate(campaign.rate)} 回饋` : "活動回饋",
      rate: campaign.rate || undefined,
      cap: campaign.cap || undefined,
      exhaustedDate: `${year}-${monthNumber}`,
      exhaustionType: "quota-full",
      confidence: "month-only",
      evidence: cleanText(match[0]),
      sourceUrl: campaign.sourceUrl || "",
      source: "official",
    });
  }
}

function keepHistoryRecord(record) {
  if (record.platform !== "OPEN錢包") return true;
  const title = String(record.campaignTitle || "");
  const evidence = String(record.evidence || "");
  if (!title.startsWith("OPEN錢包綁")) return false;
  return !/(家居分期|1010購物節|店內活動|一般權益)/i.test(evidence);
}

const data = JSON.parse(await readFile(outputPath, "utf8"));
const records = process.env.REBUILD_HISTORY === "1" ? [] : [...(data.history || [])].filter(keepHistoryRecord);
for (const payment of data.payments || []) {
  const platform = canonicalPlatform(payment.name);
  for (const campaign of payment.campaigns || []) {
    extractDateRecords(platform, campaign, records);
    extractOpenMonthRecords(platform, campaign, records);
  }
}

data.history = dedupeHistoryRecords(records).sort((a, b) => {
  const monthOrder = String(b.month || "").localeCompare(String(a.month || ""));
  if (monthOrder) return monthOrder;
  return String(a.exhaustedAt || a.exhaustedDate || "").localeCompare(String(b.exhaustedAt || b.exhaustedDate || ""));
});
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`Updated exhaustion history with ${data.history.length} official records`);
