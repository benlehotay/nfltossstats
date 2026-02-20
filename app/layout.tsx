import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DataProvider } from "@/contexts/DataContext";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.nfltossstats.com"),
  title: {
    default: "NFLTossStats.com – The Ultimate NFL Coin Toss Database",
    template: "%s | NFLTossStats.com",
  },
  description:
    "Track every NFL coin toss across all 32 teams. Win rates, streaks, defer trends, matchup breakdowns, and records dating back through every season.",
  keywords: [
    "NFL coin toss",
    "coin toss stats",
    "NFL statistics",
    "coin toss database",
    "NFL toss win rate",
    "coin toss streak",
    "defer rate NFL",
    "NFL coin toss history",
  ],
  openGraph: {
    type: "website",
    siteName: "NFLTossStats.com",
    title: "NFLTossStats.com – The Ultimate NFL Coin Toss Database",
    description:
      "Track every NFL coin toss across all 32 teams. Win rates, streaks, defer trends, matchup breakdowns, and records dating back through every season.",
    url: "https://www.nfltossstats.com",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NFLTossStats.com – NFL Coin Toss Statistics Database",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NFLTossStats.com – The Ultimate NFL Coin Toss Database",
    description:
      "Track every NFL coin toss across all 32 teams. Win rates, streaks, defer trends, and more.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "NFLTossStats.com",
  url: "https://www.nfltossstats.com",
  description:
    "The ultimate NFL coin toss statistics database. Track win rates, streaks, defer trends, and matchup breakdowns for all 32 teams.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://www.nfltossstats.com/matchup",
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Skip to main content — visible only on keyboard focus */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
        >
          Skip to main content
        </a>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <DataProvider>
          <Navbar />
          <main id="main-content">
            {children}
          </main>
        </DataProvider>
      </body>
    </html>
  );
}
