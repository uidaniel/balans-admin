import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Instrument_Sans } from "next/font/google";

import "./globals.css";

/**
 * Two faces, not four.
 *
 * The marketing site loads Geist, Geist Mono, Instrument Sans and Instrument
 * Serif because it is a shop window. This is a back office read by a handful
 * of people who work here, and every font is a request before the numbers
 * appear.
 */
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Balans admin",
  description: "The waitlist, and the numbers that say whether the campaigns are working.",
  // Never indexed. The public document pages are noindex under section 12; the
  // back office all the more so.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${instrument.variable} antialiased`}>
      <body className="min-h-dvh bg-sand/40">{children}</body>
    </html>
  );
}
