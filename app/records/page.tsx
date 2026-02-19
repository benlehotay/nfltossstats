'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { calculateTeamStats } from '@/lib/calculations';
import { Toss } from '@/lib/types';
import RecordsView from '@/components/records/RecordsView';

export default function RecordsPage() {
  const router = useRouter();
  const { tosses, games, teams, loading, error } = useData();

  const getTeamData = useMemo(() => {
    const map = new Map(teams.map(t => [t.abbreviation, t]));
    return (abbr: string) => map.get(abbr);
  }, [teams]);

  const getGameForToss = useMemo(() => {
    const map = new Map(games.map(g => [String(g.game_id), g]));
    return (toss: Toss) => map.get(String(toss.game_id));
  }, [games]);

  // RecordsView owns its own filter state internally, but teamStats
  // must be computed from all tosses (unfiltered) for the scatter chart.
  // RecordsView filters its own tosses for record cards.
  const teamStats = useMemo(() =>
    calculateTeamStats(tosses, games, getGameForToss),
    [tosses, games, getGameForToss]
  );

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
        <h1 className="text-4xl font-bold text-white mb-8">Records & Streaks</h1>
        <RecordsView
          tosses={tosses}
          games={games}
          teams={teams}
          teamStats={teamStats}
          getTeamData={getTeamData}
          getGameForToss={getGameForToss}
          onTeamClick={(abbr) => router.push(`/team/${abbr}`)}
        />
      </div>
    </div>
  );
}
