'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Toss, Game, Team } from '@/lib/types';
import MatchupDetails from './MatchupDetails';

interface MatchupExplorerProps {
  tosses: Toss[];
  games: Game[];
  teams: Team[];
  getTeamData: (abbr: string) => Team | undefined;
  getGameForToss: (toss: Toss) => Game | undefined;
}

const MatchupExplorer = memo(function MatchupExplorer({
  tosses, games, teams, getTeamData, getGameForToss
}: MatchupExplorerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize from URL query params
  const [team1, setTeam1] = useState(searchParams.get('team1') || '');
  const [team2, setTeam2] = useState(searchParams.get('team2') || '');

  // Local filter state for matchup explorer
  const [seasonFilter, setSeasonFilter] = useState('last5');
  const [customSeasonStart, setCustomSeasonStart] = useState(0);
  const [customSeasonEnd, setCustomSeasonEnd] = useState(0);
  const [selectedGameTypes, setSelectedGameTypes] = useState(['Regular Season', 'Postseason']);

  // Get available seasons from tosses
  const availableSeasons = useMemo(() =>
    [...new Set(tosses.map(t => t.season))].sort((a, b) => b - a),
    [tosses]
  );

  const availableGameTypes = useMemo(() => {
    const types = [...new Set(tosses.map(t => t.game_type))].filter(Boolean) as string[];
    const order: Record<string, number> = { 'Preseason': 1, 'Regular Season': 2, 'Postseason': 3 };
    return types.sort((a, b) => (order[a] || 99) - (order[b] || 99));
  }, [tosses]);

  // Initialize custom range
  useEffect(() => {
    if (availableSeasons.length > 0 && customSeasonStart === 0) {
      setCustomSeasonStart(availableSeasons[availableSeasons.length - 1]);
      setCustomSeasonEnd(availableSeasons[0]);
    }
  }, [availableSeasons, customSeasonStart]);

  // Update URL query params when teams change
  const handleTeam1Change = (value: string) => {
    setTeam1(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('team1', value);
    } else {
      params.delete('team1');
    }
    router.replace(`/matchup?${params.toString()}`, { scroll: false });
  };

  const handleTeam2Change = (value: string) => {
    setTeam2(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('team2', value);
    } else {
      params.delete('team2');
    }
    router.replace(`/matchup?${params.toString()}`, { scroll: false });
  };

  // Filter tosses based on matchup explorer filters
  const filteredMatchupTosses = useMemo(() => {
    return tosses.filter(t => {
      // Season filter
      let includeBasedOnSeason = true;
      if (seasonFilter === 'last1') {
        const recentSeasons = availableSeasons.slice(0, 1);
        includeBasedOnSeason = recentSeasons.includes(t.season);
      } else if (seasonFilter === 'last5') {
        const recentSeasons = availableSeasons.slice(0, 5);
        includeBasedOnSeason = recentSeasons.includes(t.season);
      } else if (seasonFilter === 'last10') {
        const recentSeasons = availableSeasons.slice(0, 10);
        includeBasedOnSeason = recentSeasons.includes(t.season);
      } else if (seasonFilter === 'custom') {
        includeBasedOnSeason = t.season >= customSeasonStart && t.season <= customSeasonEnd;
      }

      if (!includeBasedOnSeason) return false;

      // Game type filter
      if (selectedGameTypes.length > 0 && !selectedGameTypes.includes(t.game_type)) {
        return false;
      }

      return true;
    });
  }, [tosses, seasonFilter, customSeasonStart, customSeasonEnd, selectedGameTypes, availableSeasons]);

  const onTeamClick = (abbr: string) => {
    router.push(`/team/${abbr}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1a1f3a] p-6 rounded-xl border border-gray-800">
        <h2 className="text-2xl font-bold text-white mb-4">Matchup Explorer</h2>
        <p className="text-gray-400 mb-6">Select two teams to compare their head-to-head coin toss history</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Team 1</label>
            <select
              value={team1}
              onChange={(e) => handleTeam1Change(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Team</option>
              {teams.map(team => (
                <option key={team.abbreviation} value={team.abbreviation}>
                  {team.abbreviation} - {team.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Team 2</label>
            <select
              value={team2}
              onChange={(e) => handleTeam2Change(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f172a] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Team</option>
              {teams.map(team => (
                <option key={team.abbreviation} value={team.abbreviation}>
                  {team.abbreviation} - {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-700">
          {/* Season Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">SEASON RANGE</label>
            <select
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#0f172a] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="last1">Last Season</option>
              <option value="last5">Last 5 Seasons</option>
              <option value="last10">Last 10 Seasons</option>
              <option value="all">{availableSeasons.length > 0 ? `All Seasons (Since ${availableSeasons[availableSeasons.length - 1]})` : 'All Seasons'}</option>
              <option value="custom">Custom Range</option>
            </select>

            {seasonFilter === 'custom' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">From</label>
                  <select
                    value={customSeasonStart}
                    onChange={(e) => setCustomSeasonStart(parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 bg-[#0a0e27] border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableSeasons.slice().reverse().map(season => (
                      <option key={season} value={season}>{season}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">To</label>
                  <select
                    value={customSeasonEnd}
                    onChange={(e) => setCustomSeasonEnd(parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 bg-[#0a0e27] border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableSeasons.map(season => (
                      <option key={season} value={season}>{season}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Game Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">GAME TYPE</label>
            <div className="flex gap-2">
              {availableGameTypes.map(type => (
                <button
                  key={type}
                  onClick={() => {
                    if (selectedGameTypes.includes(type)) {
                      setSelectedGameTypes(selectedGameTypes.filter(t => t !== type));
                    } else {
                      setSelectedGameTypes([...selectedGameTypes, type]);
                    }
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    selectedGameTypes.includes(type)
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#0f172a] text-gray-400 hover:bg-[#0a0e27]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {team1 && team2 && (
        <MatchupDetails
          team1={team1}
          team2={team2}
          tosses={filteredMatchupTosses}
          games={games}
          getTeamData={getTeamData}
          getGameForToss={getGameForToss}
          onTeamClick={onTeamClick}
        />
      )}
    </div>
  );
});

MatchupExplorer.displayName = 'MatchupExplorer';

export default MatchupExplorer;
