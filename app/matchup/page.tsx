'use client';

import { Suspense, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Toss } from '@/lib/types';
import MatchupExplorer from '@/components/matchup/MatchupExplorer';

function MatchupContent() {
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

  return (
    <div className="min-h-screen bg-[#0a0e27]">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <MatchupExplorer
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

export default function MatchupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-xl text-white">Loading...</div>
      </div>
    }>
      <MatchupContent />
    </Suspense>
  );
}
