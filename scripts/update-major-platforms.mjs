import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputPath = path.join(root, "public", "data", "campaigns.json");

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
  return `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`;
}

function isActive(campaign, today) {
  return (!campaign.startsAt || campaign.startsAt <= today) && (!campaign.endsAt || campaign.endsAt >= today);
}

function makeCampaign({
  title,
  category,
  stores,
  rate = 0,
  cap = 0,
  rewardLabel,
  startsAt,
  endsAt,
  status,
  sourceUrl,
  rawText,
  audience = "not-stated",
}) {
  return {
    title,
    category,
    stores,
    paymentMethods: [],
    audience,
    rate,
    cap,
    rewardLabel,
    status,
    sourceUrl,
    rawText,
    startsAt,
    endsAt,
  };
}

function provider({
  name,
  logo = "",
  color,
  focus,
  segment = "cross-network",
  officialSite,
  sourceUrls,
  campaigns = [],
}) {
  return { name, logo, color, focus, segment, officialSite, sourceUrls, campaigns };
}

const providers = [
  provider({
    name: "LINE Pay",
    logo: "/logos/line-pay.svg",
    color: "#00c300",
    segment: "daily",
    focus: "LINE Pay、LINE Pay Money 與官方通路優惠。",
    officialSite: "https://pay.line.me/portal/tw/customer/press",
    sourceUrls: ["https://pay.line.me/portal/tw/customer/press"],
    campaigns: [
      makeCampaign({
        title: "LINE Pay Money 乘車碼月月最高 30% 回饋",
        category: "交通活動",
        stores: ["台北捷運", "新北捷運", "台中捷運", "高雄捷運", "雙北公車"],
        rate: 0.3,
        cap: 200,
        rewardLabel: "前 10 趟最高 30%，每月最高 200 點",
        startsAt: "20261001",
        endsAt: "20261231",
        status: "2026/10/01–2026/12/31；前 10 趟每趟 10%，當月累積滿 30 趟再享 20%（每月最高 200 點）",
        sourceUrl: "https://pay.line.me/portal/tw/customer/press/167446?categoryId=",
        audience: "mixed",
        rawText: "LINE Pay Money 官方公告：前 10 筆乘車交易每筆享 10% LINE POINTS（每筆最高 5 點）；當月完成 30 趟後，再享 20% LINE POINTS，當月回饋上限 200 點。實際適用交通路線與回饋規則以官方活動頁為準。",
      }),
      makeCampaign({
        title: "LINE Pay Money 揪友開通送 50 點／新戶優惠券",
        category: "新戶優惠",
        stores: ["LINE Pay Money", "7-ELEVEN"],
        cap: 50,
        rewardLabel: "推薦者 50 點／被推薦者 50 元券",
        startsAt: "20261001",
        endsAt: "20261231",
        status: "至 2026/12/31；推薦者 50 點，被推薦者 50 元券；未成年開通另有 2 張 50 元券",
        sourceUrl: "https://pay.line.me/portal/tw/customer/press/167446?categoryId=",
        audience: "mixed",
        rawText: "官方活動同時包含推薦開通與未成年帳戶開通禮。推薦者可得 50 LINE POINTS，被推薦者可得 50 元券；符合資格的未成年帳戶開通另贈 2 張 7-ELEVEN 50 元券。名額與領取方式依官方頁公告。",
      }),
    ],
  }),
  provider({
    name: "街口支付",
    logo: "/logos/jkos-pay.png",
    color: "#eb6a2a",
    segment: "daily",
    focus: "街口支付官方行銷活動、街口幣與指定通路折扣。",
    officialSite: "https://mkt.jkopay.com/zh-TW/event",
    sourceUrls: [
      "https://mkt.jkopay.com/zh-TW/event/jkodrink2026010",
      "https://mkt.jkopay.com/zh-TW/event/jkomall202610-plus10",
      "https://mkt.jkopay.com/zh-TW/event/appleservice26010",
    ],
    campaigns: [
      makeCampaign({
        title: "週一飲料日 30% 街口幣回饋",
        category: "飲料店",
        stores: ["指定飲料店", "指定咖啡店"],
        rate: 0.3,
        cap: 15,
        rewardLabel: "30% 街口幣，單週最高 15 元",
        startsAt: "20261001",
        endsAt: "20261231",
        status: "2026/10/01–2026/12/31；每週一單筆滿 50 元，最高回饋 15 元",
        sourceUrl: "https://mkt.jkopay.com/zh-TW/event/jkodrink2026010",
        rawText: "街口支付官方活動：每週一於指定飲料店使用街口支付，單筆消費滿 50 元享 30% 街口幣回饋，每週最高 15 元；需依活動頁於 App 內完成登錄，活動預算有限。",
      }),
      makeCampaign({
        title: "週六百貨日單筆滿 2,000 元享 9 折",
        category: "百貨購物",
        stores: ["指定百貨", "指定店家"],
        rate: 0.1,
        cap: 200,
        rewardLabel: "9 折券最高折 200 元，另有指定支付 10%",
        startsAt: "20261001",
        endsAt: "20261231",
        status: "2026/10/01–2026/12/31；部分 10 月優惠須登錄，單筆滿 2,000 元可領 9 折券",
        sourceUrl: "https://mkt.jkopay.com/zh-TW/event/jkomall202610-plus10",
        rawText: "官方頁同時列有週六百貨日與指定百貨加碼：單筆消費滿 2,000 元可享 9 折券，單次最高折 200 元；部分指定通路另有街口幣加碼，需依頁面指定付款方式、登錄與每週上限。",
      }),
      makeCampaign({
        title: "Apple 服務 9 折券",
        category: "數位服務",
        stores: ["Apple 服務", "App Store"],
        rate: 0.1,
        cap: 150,
        rewardLabel: "9 折，最高折 150 元",
        startsAt: "20261001",
        endsAt: "20261031",
        status: "2026/10/01–2026/10/31；每人限用指定 9 折券一次",
        sourceUrl: "https://mkt.jkopay.com/zh-TW/event/appleservice26010",
        rawText: "街口支付官方頁：Apple 服務指定交易可使用 9 折券，每人最高折抵 150 元；適用服務、領券及付款規則以活動頁為準。",
      }),
    ],
  }),
  provider({
    name: "悠遊付",
    logo: "/logos/easywallet.png",
    color: "#007c70",
    segment: "daily",
    focus: "悠遊付官方優惠、交通與日常採買回饋。",
    officialSite: "https://easywallet.easycard.com.tw/benefit/",
    sourceUrls: [
      "https://easywallet.easycard.com.tw/benefit/?page=4",
      "https://easywallet.easycard.com.tw/benefit/content?id=1787727024",
    ],
    campaigns: [
      makeCampaign({
        title: "悠遊付暢遊金門，筆筆最高 23% 回饋",
        category: "旅遊交通",
        stores: ["金門指定店家", "金門交通與景點"],
        rate: 0.23,
        rewardLabel: "筆筆最高 23% 回饋",
        startsAt: "20260801",
        endsAt: "20261130",
        status: "2026/08/01–2026/11/30；金門指定店家與場域適用",
        sourceUrl: "https://easywallet.easycard.com.tw/benefit/?page=4",
        rawText: "悠遊付官方優惠列表列示「暢遊金門」活動，指定店家消費筆筆最高 23% 回饋。實際適用店家、回饋上限、是否須登錄請以官方活動詳頁為準。",
      }),
      makeCampaign({
        title: "日常採買滿額最高 10% 回饋",
        category: "日常採買",
        stores: ["指定市場", "指定日常採買店家"],
        rate: 0.1,
        cap: 200,
        rewardLabel: "最高 10%，單筆回饋上限 200 元",
        startsAt: "20260917",
        endsAt: "20261031",
        status: "2026/09/17–2026/10/31；單筆滿 200 元最高 7%，搭配月任務最高 10%",
        sourceUrl: "https://easywallet.easycard.com.tw/benefit/content?id=1787727024",
        rawText: "指定市場與品牌單筆消費滿 200 元享 7% 回饋，搭配當月挑戰任務最高再加 3%，合計最高 10%；單筆回饋上限 200 元，適用通路與任務條件以官方詳頁為準。",
      }),
      makeCampaign({
        title: "元大悠遊聯名卡首次自動加值最高 20%",
        category: "金融回饋",
        stores: ["悠遊付", "元大悠遊聯名卡"],
        rate: 0.2,
        rewardLabel: "首次自動加值最高 20% 刷卡金",
        startsAt: "20260901",
        endsAt: "20261231",
        status: "2026/09/01–2026/12/31；首次自動加值活動",
        sourceUrl: "https://easywallet.easycard.com.tw/benefit/?page=4",
        audience: "new-user",
        rawText: "悠遊付官方列表列示元大悠遊聯名卡首次自動加值活動，最高 20% 刷卡金。實際登錄、名額與回饋上限請以官方詳頁為準。",
      }),
      makeCampaign({
        title: "樂天新戶綁定悠遊付好禮 1,000 元",
        category: "新戶優惠",
        stores: ["悠遊付", "樂天銀行"],
        cap: 1000,
        rewardLabel: "新戶好禮最高 1,000 元",
        startsAt: "20260801",
        endsAt: "20261031",
        status: "2026/08/01–2026/10/31；限符合資格的新戶",
        sourceUrl: "https://easywallet.easycard.com.tw/benefit/?page=4",
        audience: "new-user",
        rawText: "悠遊付官方優惠列表列示樂天新戶綁定悠遊付好禮，最高 1,000 元。新戶定義、任務與回饋形式依官方詳頁及合作銀行規則為準。",
      }),
    ],
  }),
  provider({
    name: "Pi 拍錢包",
    logo: "/logos/pi-wallet.svg",
    color: "#ed6b31",
    segment: "merchant",
    focus: "Pi 拍錢包 P 幣、電商與指定通路活動。",
    officialSite: "https://web.piapp.com.tw/events/",
    sourceUrls: [
      "https://web.piapp.com.tw/events/",
      "https://web.piapp.com.tw/260910bonus/",
      "https://web.piapp.com.tw/allme-202605/",
    ],
    campaigns: [
      makeCampaign({
        title: "PChome 24h 購物購新機，最高贈 7,517 P 幣",
        category: "電商購物",
        stores: ["PChome 24h 購物", "指定手機通路"],
        cap: 7517,
        rewardLabel: "最高 7,517 P 幣",
        startsAt: "20260912",
        endsAt: "20261031",
        status: "2026/09/12–2026/10/31；指定新機與通路適用",
        sourceUrl: "https://web.piapp.com.tw/events/",
        rawText: "Pi 拍錢包官方活動列表列示 PChome 24h 購物購新機活動，最高贈 7,517 P 幣。實際商品、付款門檻與回饋名額請開啟官方活動頁確認。",
      }),
      makeCampaign({
        title: "9–10 月指定電商、手機通路最高贈 1,800 P 幣",
        category: "電商購物",
        stores: ["指定電商", "指定手機通路"],
        cap: 1800,
        rewardLabel: "最高 1,800 P 幣",
        startsAt: "20260901",
        endsAt: "20261031",
        status: "2026/09/01–2026/10/31；每月限回饋一次，預算有限",
        sourceUrl: "https://web.piapp.com.tw/260910bonus/",
        rawText: "指定電商單月消費滿 10,000 元最高贈 500 P 幣；指定手機通路單月消費滿 36,000 元最高贈 1,800 P 幣，每月各限回饋一次，活動預算有限。",
      }),
      makeCampaign({
        title: "Pi 拍錢包綁中信 ALL ME，指定店家最高 3%",
        category: "指定通路",
        stores: ["中信 ALL ME 指定店家"],
        rate: 0.03,
        cap: 300,
        rewardLabel: "最高 3%，每月最高 300 P 幣",
        startsAt: "20260501",
        endsAt: "20261231",
        status: "2026/05/01–2026/12/31；每月回饋上限 300 P 幣",
        sourceUrl: "https://web.piapp.com.tw/allme-202605/",
        rawText: "Pi 拍錢包與中信 ALL ME 官方活動：於指定店家使用 Pi 拍錢包付款，最高享 3% P 幣回饋，每月最高 300 P 幣；適用店家與活動資格以官方頁為準。",
      }),
      makeCampaign({
        title: "JUJI 指定服務贈 200 P 幣",
        category: "平台服務",
        stores: ["JUJI"],
        cap: 200,
        rewardLabel: "最高 200 P 幣",
        startsAt: "20260701",
        endsAt: "20261231",
        status: "2026/07/01–2026/12/31；指定服務條件適用",
        sourceUrl: "https://web.piapp.com.tw/events/",
        rawText: "Pi 拍錢包官方活動列表列示 JUJI 指定服務贈 P 幣活動；服務資格、任務與回饋方式請以官方活動詳情為準。",
      }),
    ],
  }),
  provider({
    name: "全盈+PAY",
    logo: "/logos/pluspay.png",
    color: "#ef7d32",
    segment: "merchant",
    focus: "全盈+PAY 儲值金、Fa 點與全家通路會員日。",
    officialSite: "https://event2023.pluspay.com.tw/",
    sourceUrls: [
      "https://event2023.pluspay.com.tw/",
      "https://event2023.pluspay.com.tw/2026Q3?deviceModeForBot=mobile&slideIndex=0",
    ],
    campaigns: [
      makeCampaign({
        title: "滿 1,111 元享 11% 全盈儲值金",
        category: "指定通路",
        stores: ["全盈+PAY 指定店家"],
        rate: 0.11,
        rewardLabel: "最高 11% 全盈儲值金",
        startsAt: "20260918",
        endsAt: "20261231",
        status: "2026/09/18–2026/12/31；單筆滿 1,111 元",
        sourceUrl: "https://event2023.pluspay.com.tw/",
        rawText: "全盈+PAY 官方活動頁列示滿 1,111 元享 11% 全盈儲值金。指定店家、回饋上限、付款方式與預算以官方活動頁最新說明為準。",
      }),
      makeCampaign({
        title: "精選品牌滿 1,500 元回饋 10% 全盈儲值金",
        category: "指定通路",
        stores: ["精選品牌", "全盈+PAY 指定店家"],
        rate: 0.1,
        cap: 200,
        rewardLabel: "10%，每月最高 200 元",
        startsAt: "20260701",
        endsAt: "20261231",
        status: "2026/07/01–2026/12/31；單筆滿 1,500 元，每月最高 200 元",
        sourceUrl: "https://event2023.pluspay.com.tw/2026Q3?deviceModeForBot=mobile&slideIndex=0",
        rawText: "指定實體與線上品牌單筆消費滿 1,500 元，享 10% 全盈儲值金，每會員每月最高 200 元；2026/09/09 起須使用全盈+PAY 條碼或全盈+PAY QR Code，TWQR 不適用。活動預算 50,000 元，用罄提前終止。",
      }),
      makeCampaign({
        title: "Fa 點驚喜，筆筆消費贈 Fa 點",
        category: "會員回饋",
        stores: ["全家便利商店", "全盈+PAY"],
        rewardLabel: "筆筆消費贈 Fa 點",
        startsAt: "20260101",
        endsAt: "20261231",
        status: "2026/01/01–2026/12/31；會員活動條件依官方頁為準",
        sourceUrl: "https://event2023.pluspay.com.tw/",
        rawText: "全盈+PAY 官方活動頁列示 Fa 點驚喜與筆筆消費贈 Fa 點，實際會員資格、點數計算與排除條件請以官方頁最新規則為準。",
      }),
      makeCampaign({
        title: "註冊全盈+PAY 領全家咖啡",
        category: "新戶優惠",
        stores: ["全家便利商店"],
        rewardLabel: "註冊禮：全家咖啡一杯",
        startsAt: "20260101",
        endsAt: "20261231",
        status: "2026/01/01–2026/12/31；限符合資格的新註冊會員",
        sourceUrl: "https://event2023.pluspay.com.tw/",
        audience: "new-user",
        rawText: "全盈+PAY 官方活動頁列示註冊全盈+PAY 可領全家咖啡，領取資格、券種與兌換期限請以官方頁及 App 顯示為準。",
      }),
    ],
  }),
  provider({
    name: "台灣 Pay",
    logo: "/logos/taiwan-pay.png",
    color: "#b22637",
    segment: "cross-network",
    focus: "台灣 Pay、TWQR 與銀行合作通路回饋。",
    officialSite: "https://taiwanpay.firstbank.com.tw/sites/twpay/latestOffers",
    sourceUrls: [
      "https://taiwanpay.firstbank.com.tw/sites/twpay/latestOffers",
      "https://www.tcb-bank.com.tw/personal-banking/digital-finance/event/taiwan-pay",
    ],
    campaigns: [
      makeCampaign({
        title: "CITYLINK 使用台灣 Pay 最高 20% 回饋",
        category: "百貨購物",
        stores: ["CITYLINK"],
        rate: 0.2,
        rewardLabel: "最高 20% 回饋",
        startsAt: "20260901",
        endsAt: "20270228",
        status: "2026/09/01–2027/02/28；指定金融機構與店家適用",
        sourceUrl: "https://taiwanpay.firstbank.com.tw/sites/twpay/latestOffers",
        rawText: "台灣 Pay 官方最新優惠頁列示 CITYLINK 指定店家回饋，最高 20%。回饋發卡行、適用櫃位、付款方式與名額以官方活動頁為準。",
      }),
      makeCampaign({
        title: "漫遊苗栗南庄老街台灣 Pay 最高 20%",
        category: "旅遊活動",
        stores: ["苗栗南庄老街", "指定店家"],
        rate: 0.2,
        rewardLabel: "最高 20% 回饋",
        startsAt: "20260119",
        endsAt: "20261231",
        status: "2026/01/19–2026/12/31；南庄指定店家適用",
        sourceUrl: "https://taiwanpay.firstbank.com.tw/sites/twpay/latestOffers",
        rawText: "台灣 Pay 官方最新優惠頁列示苗栗南庄老街指定店家最高 20% 回饋；實際店家與適用金融機構依官方頁公告。",
      }),
      makeCampaign({
        title: "小仁泉台灣 Pay 消費最高 20%",
        category: "飲料店",
        stores: ["小仁泉"],
        rate: 0.2,
        rewardLabel: "最高 20% 回饋",
        startsAt: "20260615",
        endsAt: "20261031",
        status: "2026/06/15–2026/10/31；指定店家與金融機構適用",
        sourceUrl: "https://taiwanpay.firstbank.com.tw/sites/twpay/latestOffers",
        rawText: "台灣 Pay 官方最新優惠頁列示小仁泉指定交易最高 20% 回饋；活動期間、名額與回饋上限以官方頁最新規則為準。",
      }),
      makeCampaign({
        title: "合作銀行台灣 Pay 消費紅利點數",
        category: "一般消費",
        stores: ["指定合作銀行", "TWQR 通路"],
        rate: 0.015,
        rewardLabel: "最高 1.5% 紅利點數",
        startsAt: "20260101",
        endsAt: "20261231",
        status: "2026/01/01–2026/12/31；依合作銀行卡別與活動條件",
        sourceUrl: "https://www.tcb-bank.com.tw/personal-banking/digital-finance/event/taiwan-pay",
        rawText: "合作金庫台灣 Pay 活動頁列示合作銀行與 TWQR 通路回饋，部分卡別可享 1.5% 紅利點數。實際回饋依發卡銀行、卡別、登錄與指定通路條件為準。",
      }),
    ],
  }),
  provider({
    name: "全支付",
    logo: "/logos/pxpay.png",
    color: "#5f49a6",
    segment: "merchant",
    focus: "全支付全點、消費回饋與指定通路活動。",
    officialSite: "https://www.pxpayplus.com.tw/",
    sourceUrls: [
      "https://www.pxpayplus.com.tw/",
      "https://prod-s3.pxpayplus.com/pxplus_jpmam_mktpage2026/index.html",
      "https://www.pxpayplus.com/news/%E6%96%B0%E8%81%9E%E7%99%BC%E5%B8%83/1",
    ],
    campaigns: [
      makeCampaign({
        title: "收益進帳全支付，消費回饋最高 600 全點",
        category: "一般消費",
        stores: ["全支付指定消費通路"],
        cap: 600,
        rewardLabel: "最高 600 全點",
        startsAt: "20260801",
        endsAt: "20261031",
        status: "消費期間 2026/08/01–2026/10/31；需於 7/14–9/14 完成活動資格",
        sourceUrl: "https://prod-s3.pxpayplus.com/pxplus_jpmam_mktpage2026/index.html",
        rawText: "全支付官方活動：符合資格後，次月消費滿 200 元可獲 200 全點，活動期間最高 600 全點。重要：活動資格登錄期間為 2026/07/14–2026/09/14，已完成資格者才可依規則累積；未完成者請以官方頁確認是否仍有其他入口。",
      }),
    ],
  }),
  provider({
    name: "iPASS MONEY",
    logo: "/logos/ipass-money.png",
    color: "#00a6d6",
    segment: "daily",
    focus: "iPASS MONEY 官方活動，既有活動由專用爬蟲同步。",
    officialSite: "https://www.i-pass.com.tw/Preferential",
    sourceUrls: ["https://www.i-pass.com.tw/Preferential?page=1&type=0"],
  }),
  provider({
    name: "icash Pay",
    logo: "/logos/icash-pay.png",
    color: "#e95e22",
    segment: "daily",
    focus: "icash Pay 在官方合作通路公布的活動。",
    officialSite: "https://www.icashpay.com.tw/",
    sourceUrls: ["https://www.icashpay.com.tw/"],
  }),
  provider({
    name: "OPEN錢包",
    logo: "/logos/open-wallet.png",
    color: "#ef5a24",
    segment: "merchant",
    focus: "OPEN錢包於 7-ELEVEN 與合作通路的活動。",
    officialSite: "https://www.7-11.com.tw/index.aspx",
    sourceUrls: ["https://www.7-11.com.tw/index.aspx"],
  }),
  provider({
    name: "橘子支付",
    logo: "/logos/gama-pay.png",
    color: "#f58220",
    segment: "cross-network",
    focus: "橘子支付官方公告與支付優惠；目前先保留官方活動入口。",
    officialSite: "https://www.gamapay.com.tw/news_list.html",
    sourceUrls: ["https://www.gamapay.com.tw/news_list.html"],
  }),
  provider({
    name: "歐付寶 O'Pay",
    logo: "/logos/opay-icon.png",
    color: "#1388c9",
    segment: "cross-network",
    focus: "歐付寶 O'Pay 官方好康活動與合作通路。",
    officialSite: "https://www.opay.tw/banner/event",
    sourceUrls: ["https://www.opay.tw/banner/event"],
  }),
  provider({
    name: "ezPay 簡單付",
    logo: "/logos/ezpay.png",
    color: "#1877b9",
    segment: "cross-network",
    focus: "ezPay 簡單付官方服務與活動入口。",
    officialSite: "https://www.ezpay.com.tw/",
    sourceUrls: ["https://www.ezpay.com.tw/"],
  }),
];

function campaignSort(a, b) {
  return (b.rate || 0) - (a.rate || 0) || (b.cap || 0) - (a.cap || 0) || a.title.localeCompare(b.title, "zh-Hant");
}

async function checkSource(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        "user-agent": "Mozilla/5.0 reward-radar/0.2",
        accept: "text/html,application/xhtml+xml",
      },
    });
    return { status: response.ok ? "ok" : `http-${response.status}` };
  } catch (error) {
    return { status: "unreachable", error: error.message };
  }
}

const data = JSON.parse(await readFile(outputPath, "utf8"));
const today = taipeiTodayKey();
const checkedAt = new Date().toISOString();
const existingPayments = data.payments || [];
const generatedPayments = [];
const generatedSources = [];
const sourceChecks = await Promise.all(providers.flatMap((item) => item.sourceUrls.map(async (url) => ({
  name: item.name,
  url,
  ...(await checkSource(url)),
}))));

for (const item of providers) {
  const activeCampaigns = item.campaigns
    .filter((campaign) => isActive(campaign, today))
    .map((campaign) => ({ ...campaign, paymentMethods: [item.name] }))
    .sort(campaignSort);

  if (item.campaigns.length) {
    generatedPayments.push({
      name: `${item.name} 官方活動`,
      logo: item.logo,
      color: item.color,
      focus: item.focus,
      freshness: `官方來源檢查 ${formatDateKey(today)}`,
      campaigns: activeCampaigns,
    });
  }

  for (const url of item.sourceUrls) {
    const check = sourceChecks.find((result) => result.name === item.name && result.url === url);
    generatedSources.push({
      name: `${item.name} 官方活動`,
      url,
      officialSite: item.officialSite,
      status: check?.status || "unchecked",
      checkedAt,
    });
  }
}

const generatedNames = new Set(generatedPayments.map((payment) => payment.name));
data.payments = [
  ...existingPayments.filter((payment) => !generatedNames.has(payment.name)),
  ...generatedPayments,
];

const platformMap = new Map((data.platforms || []).map((platform) => [platform.name, platform]));
for (const item of providers) {
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

const legacySources = (data.sources || [data.source].filter(Boolean)).filter((source) => !providers.some((item) => source.name?.startsWith(`${item.name} 官方活動`)));
data.sources = [
  ...legacySources,
  ...generatedSources,
].filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index);
data.updatedAt = checkedAt;
data.source = data.source || {
  name: "多平台官方活動來源",
  url: data.sources[0]?.url || "",
  officialSite: data.sources[0]?.officialSite || "",
  counts: {},
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

const activeCount = generatedPayments.reduce((sum, payment) => sum + payment.campaigns.length, 0);
const reachable = sourceChecks.filter((source) => source.status === "ok").length;
console.log(`Synced ${providers.length} platforms, ${activeCount} seeded active campaigns, ${reachable}/${sourceChecks.length} official sources reachable as of ${today}`);
