import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Matchup Explorer',
  description:
    'Explore NFL coin toss head-to-head records between any two teams. See every toss result, game outcome, and historical trend for any matchup in NFL history.',
  alternates: { canonical: '/matchup' },
  openGraph: {
    title: 'NFL Coin Toss Matchup Explorer | NFLTossStats.com',
    description:
      'Head-to-head NFL coin toss records between any two teams — every toss, every result.',
    url: '/matchup',
  },
};

export default function MatchupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
