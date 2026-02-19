'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { Toss } from '@/lib/types';
import TeamDetailView from '@/components/team/TeamDetailView';

export default function TeamPage() {
  const params = useParams();
  const router = useRouter();
  const abbreviation = typeof params.abbreviation === 'string' ? params.abbreviation.toUpperCase() : '';

  const { tosses, games, teams, loading, error } = useData();

  const getTeamData = useMemo(() => {
    const map = new Map(teams.map(t => [t.abbreviation, t]));
    return (abbr: string) => map.get(abbr);
  }, [teams]);

  const getGameForToss = useMemo(() => {
    const map = new Map(games.map(g => [String(g.game_id), g]));
    return (toss: Toss) => map.get(String(toss.game_id));
  }, [games]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-xl text-white">Loading data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="max-w-md p-6 bg-[#1a1f3a] rounded-lg border-2 border-red-500">
          <h2 className="text-xl font-bold text-red-500 mb-2">Connection Error</h2>
          <p className="text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  const teamExists = teams.some(t => t.abbreviation === abbreviation);
  if (!teamExists && teams.length > 0) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-500 mb-4">Team Not Found</div>
          <p className="text-gray-400 mb-6">"{abbreviation}" is not a valid team abbreviation.</p>
          <button
            onClick={() => router.push('/analytics')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Back to Analytics
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e27]">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <TeamDetailView
          teamAbbr={abbreviation}
          tosses={tosses}
          games={games}
          teams={teams}
          getTeamData={getTeamData}
          getGameForToss={getGameForToss}
        />
      </div>
    </div>
  );
}
