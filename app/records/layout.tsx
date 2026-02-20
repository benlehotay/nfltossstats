import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Records & Streaks',
  description:
    'NFL coin toss all-time records — longest win and loss streaks, highest defer rates, most consecutive defers, and best game conversion rates.',
  alternates: { canonical: '/records' },
  openGraph: {
    title: 'NFL Coin Toss Records & Streaks | NFLTossStats.com',
    description:
      'All-time NFL coin toss records — longest streaks, highest defer rates, and more.',
    url: '/records',
  },
};

export default function RecordsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
