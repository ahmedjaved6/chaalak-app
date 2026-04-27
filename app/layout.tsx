import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Noto_Sans_Bengali, Inter } from "next/font/google";
import "./globals.css";
import OfflineBanner from "@/components/OfflineBanner";

// Noto Sans Bengali for local language support
const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "700"],
  variable: "--font-noto-bengali",
  display: "swap",
  preload: false,
});

// Barlow Condensed for high-impact display text
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

// Inter for clean body text
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chaalak — চালক",
  description: "Guwahati's own rickshaw hailing app",
  manifest: "/manifest.json",
  appleWebApp: {
    statusBarStyle: "black-translucent",
    title: "Chaalak",
  },
};

export const viewport: Viewport = {
  themeColor: "#1D4ED8", // Updated to new brand blue
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="as">
      <head>
        <meta charSet="utf-8" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${barlowCondensed.variable} ${notoBengali.variable} ${inter.variable} antialiased font-sans`}
      >
        {children}
        <OfflineBanner />
      </body>
    </html>
  );
}
