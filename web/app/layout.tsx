import type { Metadata, Viewport } from "next";
import { Azeret_Mono, DM_Sans, Syne } from "next/font/google";

import "./globals.css";
import { AppFrame } from "@/components/app-frame";
import { Providers } from "@/components/providers";
import { SITE_LINE, SITE_NAME, SITE_TAGLINE } from "@/lib/config";

// DM Sans for everything read; Syne for headings and buttons; Azeret Mono for amounts, masks, hashes and
// fingerprints.
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne", display: "swap" });
const azeret = Azeret_Mono({ subsets: ["latin"], variable: "--font-azeret", display: "swap" });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: SITE_LINE,
  applicationName: SITE_NAME,
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${syne.variable} ${azeret.variable} antialiased`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
          Skip to the page
        </a>
        <Providers>
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
