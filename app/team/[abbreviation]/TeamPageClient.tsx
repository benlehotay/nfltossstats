'use client';

import { useMemo } from 'react';
import { Toss, Game, Team } from '@/lib/types';
import TeamDetailView from '@/components/team/TeamDetailView';

interface Props {
  abbr: string;
  tosses: Toss[];
  games: Game[];
  teams: Team[];
}

export default function TeamPageClient({ abbr, tosses, games, teams }: Props) {
  const getTeamData = useMemo(() => {
    const map = new Map(teams.map(t => [t.abbreviation, t]));
    return (a: string) => map.get(a);
  }, [teams]);

  const getGameForToss = useMemo(() => {
    const map = new Map(games.map(g => [String(g.game_id), g]));
    return (toss: Toss) => map.get(String(toss.game_id));
  }, [games]);

  return (
    <div className="min-h-screen bg-[#0a0e27]">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <TeamDetailView
          teamAbbr={abbr}
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
