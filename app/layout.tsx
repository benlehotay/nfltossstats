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
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.ico",
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
        <DataProvider>
          <Navbar />
          {children}
        </DataProvider>
      </body>
    </html>
  );
}
