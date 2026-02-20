import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team Coin Toss Stats',
  description:
    'Detailed NFL coin toss statistics including opening toss win rate, defer trends, active streaks, season-by-season timeline, and opponent breakdowns.',
};

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
