import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Onest } from "next/font/google";

import "./globals.css";

/**
 * Onest for everything, as on balans.ng (brand guidelines 1.0): headings in
 * Light and Regular, small titles in Medium, figures with tabular numbers.
 * Geist Mono only for literal machine strings — references, phone numbers,
 * IDs.
 */
const onest = Onest({ variable: "--font-onest", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Balans admin",
  description: "The waitlist, and the numbers that say whether the campaigns are working.",
  // Never indexed. The public document pages are noindex under section 12; the
  // back office all the more so.
  robots: { index: false, follow: false },
  // iOS turns anything number-shaped into a phone link, amounts included.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // The nav's night green, so the phone's status bar runs into the top bar.
  themeColor: "#0b1913",
  // Lets the bottom tab bar sit above the home indicator (safe-area insets).
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${onest.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh bg-canvas text-ink">{children}</body>
    </html>
  );
}
