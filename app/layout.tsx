import type { Metadata, Viewport } from "next";

import "./globals.css";

import { Nunito, Noto_Sans_Bengali, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";
import OfflineBanner from "@/components/OfflineBanner";


const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
  preload: true,
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "700"],
  variable: "--font-noto-bengali",
  display: "swap",
  preload: false,
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "700"],
  variable: "--font-noto-devanagari",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Chaalak — চালক",
  description: "Guwahati's own rickshaw hailing app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Chaalak",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1A1E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${nunito.variable} ${notoBengali.variable} ${notoDevanagari.variable} antialiased font-sans`}
        style={{ fontFamily: "var(--font-nunito), sans-serif" }}
      >
        {children}
        <OfflineBanner />
      </body>
    </html>
  );
}
