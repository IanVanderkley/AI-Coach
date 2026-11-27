import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import "./globals.css";

import "../styles/theme.css";
import "../styles/base.css";
import "../styles/navigation.css";
import "../styles/layout.css";
import "../styles/game.css";
import "../styles/coaching.css";
import "../styles/account.css";
import "../styles/profile.css";
import "../styles/responsive.css";
import "../styles/ui-consistency.css";
import "../styles/practice-layout.css";
import "../styles/batch24-gameplay.css";
import "../styles/ranked-board-review.css";
import "../styles/play-surface-polish.css";
import "../styles/game-station-polish.css";
import "../styles/profile-dashboard-polish.css";
import "../styles/result-ceremony.css";
import "../styles/practice-result-minimal.css";
import "../styles/ranked-result-minimal.css";
import "../styles/ranked-result-reveal.css";
import "../styles/leaderboard-podium.css";
import "../styles/site-help.css";
import { SiteFooter } from "@/components/ui/site-footer";
import { SiteTooltip } from "@/components/ui/site-tooltip";

// These paths are relative to this file, not the browser URL.
// Both fonts are included in public/fonts so groupmates can build without
// downloading fonts from Google. Keep their licence files with them.
const roboto = localFont({
  src: "../public/fonts/roboto-latin-wght-normal.woff2",
  variable: "--font-roboto",
  weight: "100 900",
  display: "swap",
});

const robotoCondensed = localFont({
  src: "../public/fonts/roboto-condensed-latin-wght-normal.woff2",
  variable: "--font-roboto-condensed",
  weight: "100 900",
  display: "swap",
});

// Next.js uses this for the browser tab, page description and favicon.
export const metadata: Metadata = {
  title: "MindSweeper | Play. Learn. Improve.",
  description: "Practise Minesweeper with post-game feedback on patterns and decisions.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${roboto.variable} ${robotoCondensed.variable}`}>
      <body>
        {children}
        <SiteFooter />
        <SiteTooltip />
      </body>
    </html>
  );
}
