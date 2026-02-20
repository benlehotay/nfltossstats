import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchTeamTosses, fetchTeamGames, fetchTeams } from '@/lib/supabase-server';
import TeamPageClient from './TeamPageClient';

// Revalidate cached pages once per day
export const revalidate = 86400;

// Pre-build static pages for all teams at deploy time.
// Next.js will also handle any abbreviation not in this list dynamically.
export async function generateStaticParams() {
  const teams = await fetchTeams();
  return teams.map(t => ({ abbreviation: t.abbreviation }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ abbreviation: string }> }
): Promise<Metadata> {
  const { abbreviation } = await params;
  const abbr = abbreviation.toUpperCase();
  const teams = await fetchTeams(); // deduplicated by Next.js fetch cache
  const team = teams.find(t => t.abbreviation === abbr);

  if (!team) return { title: 'Team Not Found — NFLTossStats.com' };

  const title = `${team.name} Coin Toss Stats — NFLTossStats.com`;
  const description = `Complete NFL coin toss history for the ${team.name}. Win rates, defer trends, active streaks, and season-by-season breakdowns.`;

  return {
    title,
    description,
    alternates: { canonical: `/team/${abbr}` },
    openGraph: {
      title,
      description,
      url: `/team/${abbr}`,
    },
  };
}

export default async function TeamPage(
  { params }: { params: Promise<{ abbreviation: string }> }
) {
  const { abbreviation } = await params;
  const abbr = abbreviation.toUpperCase();

  // Team-scoped queries — fetch only this team's data, not the full tables
  const [tosses, games, teams] = await Promise.all([
    fetchTeamTosses(abbr),
    fetchTeamGames(abbr),
    fetchTeams(),
  ]);

  const team = teams.find(t => t.abbreviation === abbr);

  if (!team) {
    // Render an inline not-found state (avoids needing useRouter in a server component)
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-500 mb-4">Team Not Found</div>
          <p className="text-gray-400 mb-6">
            &ldquo;{abbr}&rdquo; is not a valid team abbreviation.
          </p>
          <Link
            href="/analytics"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Back to Analytics
          </Link>
        </div>
      </div>
    );
  }

  return (
    <TeamPageClient
      abbr={abbr}
      tosses={tosses}
      games={games}
      teams={teams}
    />
  );
}
