'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { calculateTeamStats } from '@/lib/calculations';
import { Toss } from '@/lib/types';
import AnalyticsView from '@/components/analytics/AnalyticsView';

export default function AnalyticsPage() {
  const router = useRouter();
  const { tosses, games, teams, loading, error } = useData();

  // Filter state
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [seasonFilter, setSeasonFilter] = useState('last5');
  const [customSeasonStart, setCustomSeasonStart] = useState(0);
  const [customSeasonEnd, setCustomSeasonEnd] = useState(0);
  const [selectedGameTypes, setSelectedGameTypes] = useState(['Regular Season', 'Postseason']);

  // Sort state
  const [sortBy, setSortBy] = useState('abbr');
  const [sortDirection, setSortDirection] = useState('asc');

  // Derived helpers
  const availableSeasons = useMemo(() =>
    [...new Set(tosses.map(t => t.season))].sort((a, b) => b - a),
    [tosses]
  );

  // Initialize custom range once data loads
  useEffect(() => {
    if (availableSeasons.length > 0 && customSeasonStart === 0) {
      setCustomSeasonStart(availableSeasons[availableSeasons.length - 1]);
      setCustomSeasonEnd(availableSeasons[0]);
    }
  }, [availableSeasons, customSeasonStart]);

  const getTeamData = useMemo(() => {
    const map = new Map(teams.map(t => [t.abbreviation, t]));
    return (abbr: string) => map.get(abbr);
  }, [teams]);

  const getGameForToss = useMemo(() => {
    const map = new Map(games.map(g => [String(g.game_id), g]));
    return (toss: Toss) => map.get(String(toss.game_id));
  }, [games]);

  const filteredTosses = useMemo(() => {
    return tosses.filter(t => {
      // Team filter
      if (selectedTeams.length > 0) {
        if (!selectedTeams.includes(t.winner) && !selectedTeams.includes(t.loser)) {
          return false;
        }
      }

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
  }, [tosses, selectedTeams, seasonFilter, customSeasonStart, customSeasonEnd, selectedGameTypes, availableSeasons]);

  const teamStats = useMemo(() =>
    calculateTeamStats(filteredTosses, games, getGameForToss),
    [filteredTosses, games, getGameForToss]
  );

  const sortedTeamStats = useMemo(() => {
    return [...teamStats].sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
  }, [teamStats, sortBy, sortDirection]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

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
      {/* Filter bar */}
      <div className="bg-[#0f172a] border-b border-gray-800 sticky top-[60px] z-40">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Season Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">SEASON RANGE</label>
              <select
                value={seasonFilter}
                onChange={(e) => setSeasonFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#1a1f3a] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="last1">Last Season</option>
                <option value="last5">Last 5 Seasons</option>
                <option value="last10">Last 10 Seasons</option>
                <option value="all">
                  {availableSeasons.length > 0
                    ? `All Seasons (Since ${availableSeasons[availableSeasons.length - 1]})`
                    : 'All Seasons'}
                </option>
                <option value="custom">Custom Range</option>
              </select>

              {seasonFilter === 'custom' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    value={customSeasonStart}
                    onChange={(e) => setCustomSeasonStart(parseInt(e.target.value))}
                    className="px-2 py-1.5 bg-[#0a0e27] border border-gray-700 rounded text-white text-sm"
                  >
                    {availableSeasons.slice().reverse().map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    value={customSeasonEnd}
                    onChange={(e) => setCustomSeasonEnd(parseInt(e.target.value))}
                    className="px-2 py-1.5 bg-[#0a0e27] border border-gray-700 rounded text-white text-sm"
                  >
                    {availableSeasons.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Game Type Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">GAME TYPE</label>
              <div className="flex gap-2">
                {['Preseason', 'Regular Season', 'Postseason'].map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      if (selectedGameTypes.includes(type)) {
                        setSelectedGameTypes(selectedGameTypes.filter(t => t !== type));
                      } else {
                        setSelectedGameTypes([...selectedGameTypes, type]);
                      }
                    }}
                    aria-pressed={selectedGameTypes.includes(type)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      selectedGameTypes.includes(type)
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#1a1f3a] text-gray-400 hover:bg-[#252d4a]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Team Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">FILTER BY TEAM</label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && !selectedTeams.includes(e.target.value)) {
                    setSelectedTeams([...selectedTeams, e.target.value]);
                  }
                }}
                className="w-full px-3 py-2 bg-[#1a1f3a] border border-gray-700 rounded-lg text-white text-sm"
              >
                <option value="">Add team filter...</option>
                {teams.map(t => (
                  <option key={t.abbreviation} value={t.abbreviation}>
                    {t.abbreviation} - {t.name}
                  </option>
                ))}
              </select>
              {selectedTeams.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedTeams.map(abbr => (
                    <button
                      key={abbr}
                      onClick={() => setSelectedTeams(selectedTeams.filter(t => t !== abbr))}
                      aria-label={`Remove ${abbr} filter`}
                      className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 min-h-[28px]"
                    >
                      {abbr} ×
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-8">
        <AnalyticsView
          teamStats={sortedTeamStats}
          filteredTosses={filteredTosses}
          games={games}
          teams={teams}
          selectedTeams={selectedTeams}
          setSelectedTeams={setSelectedTeams}
          getTeamData={getTeamData}
          getGameForToss={getGameForToss}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={handleSort}
          onTeamClick={(abbr) => router.push(`/team/${abbr}`)}
        />
      </div>
    </div>
  );
}
