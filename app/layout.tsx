import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const paymentraderIcon = "/branding/paymentrader/paymentrader-option-05-final.png";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "paymentrader｜支付優惠情報",
  description: "paymentrader 集中整理各大支付平台官方活動，依回饋與個人偏好快速找到值得先看的優惠。",
  applicationName: "paymentrader",
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: paymentraderIcon, type: "image/png", sizes: "512x512" }],
    shortcut: [{ url: paymentraderIcon, type: "image/png", sizes: "512x512" }],
    apple: [{ url: paymentraderIcon, type: "image/png", sizes: "512x512" }],
  },
  openGraph: {
    title: "paymentrader｜支付優惠情報",
    description: "paymentrader 集中整理各大支付平台官方活動，依回饋與個人偏好快速找到值得先看的優惠。",
    type: "website",
    images: [{ url: paymentraderIcon, width: 512, height: 512, alt: "paymentrader Logo" }],
  },
  twitter: {
    card: "summary",
    title: "paymentrader｜支付優惠情報",
    description: "paymentrader 集中整理各大支付平台官方活動，依回饋與個人偏好快速找到值得先看的優惠。",
    images: [paymentraderIcon],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
