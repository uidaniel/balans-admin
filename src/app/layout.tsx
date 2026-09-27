import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

/**
 * Geist for everything, Geist Mono for references and phone numbers.
 *
 * The marketing site pairs Geist with Instrument Sans because it is a shop
 * window. This is a back office of tables and figures, where one crisp face
 * with tabular numbers reads faster than two.
 */
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Balans admin",
  description: "The waitlist, and the numbers that say whether the campaigns are working.",
  // Never indexed. The public document pages are noindex under section 12; the
  // back office all the more so.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh bg-canvas text-ink">{children}</body>
    </html>
  );
}
