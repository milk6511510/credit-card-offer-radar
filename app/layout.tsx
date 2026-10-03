import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const paymentraderIcon = "/branding/paymentrader/logo-10-editorial-light-mark.svg";

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
    icon: [{ url: paymentraderIcon, type: "image/svg+xml" }],
    shortcut: [{ url: paymentraderIcon, type: "image/svg+xml" }],
    apple: [{ url: paymentraderIcon, type: "image/svg+xml" }],
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
