import type { Metadata, Viewport } from "next";

import "./globals.css";

import { Nunito } from "next/font/google";
import "@fontsource/noto-sans-bengali/400.css";
import "@fontsource/noto-sans-bengali/700.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/700.css";
import "./globals.css";
import OfflineBanner from "@/components/OfflineBanner";


const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-nunito",
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
        className={`${nunito.variable} antialiased font-sans`}
        style={{ fontFamily: "var(--font-nunito), sans-serif" }}
      >
        {children}
        <OfflineBanner />
      </body>
    </html>
  );
}
