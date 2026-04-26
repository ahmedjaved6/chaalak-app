import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Chaalak",
  description: "Guwahati's own rickshaw hailing app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${nunito.variable} antialiased font-sans`}
        style={{ fontFamily: "var(--font-nunito), sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
