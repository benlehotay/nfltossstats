import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team Analytics',
  description:
    'Compare NFL coin toss win rates, defer trends, active streaks, and head-to-head breakdowns for all 32 teams. Filter by season range and game type.',
  alternates: { canonical: '/analytics' },
  openGraph: {
    title: 'NFL Team Coin Toss Analytics | NFLTossStats.com',
    description:
      'Compare coin toss win rates, defer trends, and streaks across all 32 NFL teams.',
    url: '/analytics',
  },
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
