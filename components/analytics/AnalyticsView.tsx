'use client';

import React, { useState, memo } from 'react';
import { useRouter } from 'next/navigation';
import { calculateOpponentStatsForTeam, formatGameDate } from '@/lib/calculations';
import { Toss, Game, Team, TeamStat } from '@/lib/types';
import GameDetailModal from '@/components/team/GameDetailModal';

interface AnalyticsViewProps {
  teamStats: TeamStat[];
  filteredTosses: Toss[];
  games: Game[];
  teams: Team[];
  selectedTeams: string[];
  setSelectedTeams: (teams: string[]) => void;
  getTeamData: (abbr: string) => Team | undefined;
  getGameForToss: (toss: Toss) => Game | undefined;
  sortBy: string;
  sortDirection: string;
  onSort: (column: string) => void;
  onTeamClick: (abbr: string) => void;
}

const AnalyticsView = memo(function AnalyticsView({
  teamStats, filteredTosses, games, teams, selectedTeams, setSelectedTeams,
  getTeamData, getGameForToss, sortBy, sortDirection, onSort, onTeamClick
}: AnalyticsViewProps) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [expandedOpponent, setExpandedOpponent] = useState<string | null>(null);
  const [clickedGame, setClickedGame] = useState<any>(null);
  const [tableView, setTableView] = useState<'table' | 'streaks'>('table');

  // Opponent sorting state - separate for each expanded team
  const [opponentSortBy, setOpponentSortBy] = useState<Record<string, string>>({});
  const [opponentSortDirection, setOpponentSortDirection] = useState<Record<string, string>>({});

  // Calculate key metrics
  const tossesWithGames = filteredTosses.filter(t => {
    const game = getGameForToss(t);
    return game && game.home_score !== null && game.away_score !== null && t.toss_type === 'Regular';
  });

  const tossWinnerWonGame = tossesWithGames.filter(t => {
    const game = getGameForToss(t);
    if (!game) return false;
    const gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
    return t.winner === gameWinner;
  }).length;

  const winCorrelation = tossesWithGames.length > 0
    ? Math.round((tossWinnerWonGame / tossesWithGames.length) * 100)
    : 0;

  const openingTossWins = filteredTosses.filter(t => t.toss_type === 'Regular');
  const deferCount = openingTossWins.filter(t => t.winner_choice === 'Defer').length;
  const deferRate = openingTossWins.length > 0 ? Math.round((deferCount / openingTossWins.length) * 100) : 0;

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <span className="text-gray-600">⇅</span>;
    return sortDirection === 'asc' ? <span className="text-blue-400">↑</span> : <span className="text-blue-400">↓</span>;
  };

  // Show all teams
  const displayedTeamStats = teamStats;

  // Get individual games between team and opponent
  const getGamesVsOpponent = (teamAbbr: string, opponentAbbr: string) => {
    return filteredTosses
      .filter(t =>
        (t.winner === teamAbbr && t.loser === opponentAbbr) ||
        (t.winner === opponentAbbr && t.loser === teamAbbr)
      )
      .sort((a, b) => {
        if (a.game_date && b.game_date) {
          const dateCompare = new Date(b.game_date).getTime() - new Date(a.game_date).getTime();
          if (dateCompare !== 0) return dateCompare;
        } else if (b.season !== a.season) {
          return b.season - a.season;
        } else if (b.week !== a.week) {
          return b.week - a.week;
        }

        const sameGame = (
          a.game_date === b.game_date &&
          ((a.winner === b.winner && a.loser === b.loser) ||
           (a.winner === b.loser && a.loser === b.winner))
        );

        if (sameGame) {
          if (a.toss_type === 'Overtime' && b.toss_type === 'Regular') return -1;
          if (a.toss_type === 'Regular' && b.toss_type === 'Overtime') return 1;
        }

        return 0;
      });
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-[#1a1f3a] p-4 md:p-6 rounded-xl border border-gray-800">
          <div className="text-xs md:text-sm text-gray-400 mb-1">Games Analyzed</div>
          <div className="text-3xl md:text-4xl font-bold text-white">{tossesWithGames.length}</div>
        </div>
        <div className="bg-[#1a1f3a] p-4 md:p-6 rounded-xl border border-gray-800">
          <div className="text-xs md:text-sm text-gray-400 mb-1">Won Game After Toss Win</div>
          <div className="text-3xl md:text-4xl font-bold text-blue-400">{winCorrelation}%</div>
        </div>
        <div className="bg-[#1a1f3a] p-4 md:p-6 rounded-xl border border-gray-800">
          <div className="text-xs md:text-sm text-gray-400 mb-1">Defer Rate (Opening Toss)</div>
          <div className="text-3xl md:text-4xl font-bold text-purple-400">{deferRate}%</div>
        </div>
        <div className="bg-[#1a1f3a] p-4 md:p-6 rounded-xl border border-gray-800">
          <div className="text-xs md:text-sm text-gray-400 mb-1">Total Tosses</div>
          <div className="text-3xl md:text-4xl font-bold text-green-400">{filteredTosses.length}</div>
        </div>
      </div>

      {/* Main Team Stats Table */}
      <div className="bg-[#1a1f3a] rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-3 md:p-4 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white">Team Performance</h2>
            <p className="text-xs md:text-sm text-gray-400 hidden sm:block">
              {tableView === 'table'
                ? 'Click any column header to sort • Click team row to expand opponent breakdown'
                : 'Longest win streaks vs longest loss streaks • Click a team to view their team page'}
            </p>
          </div>
          {/* Toggle */}
          <div className="flex items-center bg-[#0f172a] rounded-lg p-1 flex-shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setTableView('table')}
              aria-pressed={tableView === 'table'}
              className={`px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition ${
                tableView === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📋 Team Table
            </button>
            <button
              onClick={() => setTableView('streaks')}
              aria-pressed={tableView === 'streaks'}
              className={`px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition ${
                tableView === 'streaks'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🔥 Streak Showdown
            </button>
          </div>
        </div>
        {tableView === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full" aria-label="NFL team coin toss statistics">
            <thead className="bg-[#0f172a] border-b border-gray-800">
              <tr>
                <th className="px-3 md:px-4 py-3 text-left">
                  <button onClick={() => onSort('abbr')} className="flex items-center gap-1 md:gap-2 text-xs font-bold text-gray-400 uppercase hover:text-white transition">
                    Team <SortIcon column="abbr" />
                  </button>
                </th>
                <th className="px-2 md:px-4 py-3 text-center hidden sm:table-cell">
                  <button onClick={() => onSort('totalTosses')} className="flex items-center justify-center gap-1 md:gap-2 text-xs font-bold text-gray-400 uppercase hover:text-white transition w-full">
                    Games <SortIcon column="totalTosses" />
                  </button>
                </th>
                <th className="px-2 md:px-4 py-3 text-center hidden sm:table-cell">
                  <button onClick={() => onSort('tossWins')} className="flex items-center justify-center gap-1 md:gap-2 text-xs font-bold text-gray-400 uppercase hover:text-white transition w-full">
                    Toss Wins <SortIcon column="tossWins" />
                  </button>
                </th>
                <th className="px-2 md:px-4 py-3 text-center">
                  <button onClick={() => onSort('tossWinPct')} className="flex items-center justify-center gap-1 md:gap-2 text-xs font-bold text-gray-400 uppercase hover:text-white transition w-full">
                    <span className="hidden md:inline">Toss Win %</span>
                    <span className="md:hidden">Toss%</span>
                    <SortIcon column="tossWinPct" />
                  </button>
                </th>
                <th className="px-2 md:px-4 py-3 text-center hidden md:table-cell">
                  <button onClick={() => onSort('gameWinPct')} className="flex items-center justify-center gap-1 md:gap-2 text-xs font-bold text-gray-400 uppercase hover:text-white transition w-full">
                    Won Game After Toss Win % <SortIcon column="gameWinPct" />
                  </button>
                </th>
                <th className="px-2 md:px-4 py-3 text-center hidden lg:table-cell">
                  <button onClick={() => onSort('deferPct')} className="flex items-center justify-center gap-1 md:gap-2 text-xs font-bold text-gray-400 uppercase hover:text-white transition w-full">
                    Defer % <SortIcon column="deferPct" />
                  </button>
                </th>
                <th className="px-2 md:px-4 py-3 text-center">
                  <button onClick={() => onSort('currentStreak')} className="flex items-center justify-center gap-1 md:gap-2 text-xs font-bold text-gray-400 uppercase hover:text-white transition w-full">
                    Toss Streak <SortIcon column="currentStreak" />
                  </button>
                </th>
                <th className="px-2 md:px-4 py-3 text-center w-10 md:w-16">
                  <span className="text-xs font-bold text-gray-400 uppercase hidden sm:inline">Page</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {displayedTeamStats.map((team, idx) => {
                const teamData = getTeamData(team.abbr);
                const isExpanded = expandedTeam === team.abbr;

                // Calculate opponent stats for this team
                let opponentStats = calculateOpponentStatsForTeam(filteredTosses, team.abbr, getGameForToss);

                // Get sort settings for this team's opponents (default: matchups descending)
                const currentSortBy = opponentSortBy[team.abbr] || 'matchups';
                const currentSortDirection = opponentSortDirection[team.abbr] || 'desc';

                // Sort opponent stats
                opponentStats = [...opponentStats].sort((a: any, b: any) => {
                  let aVal, bVal;

                  switch (currentSortBy) {
                    case 'opponent':
                      aVal = a.abbr; bVal = b.abbr; break;
                    case 'matchups':
                      aVal = a.totalMatchups; bVal = b.totalMatchups; break;
                    case 'tossWins':
                      aVal = a.tossWins; bVal = b.tossWins; break;
                    case 'gameWins':
                      aVal = a.gameWins; bVal = b.gameWins; break;
                    case 'tossWinPct':
                      aVal = a.tossWinPct; bVal = b.tossWinPct; break;
                    case 'gameWinPct':
                      aVal = a.gameWinPct; bVal = b.gameWinPct; break;
                    case 'streak':
                      aVal = a.currentStreak; bVal = b.currentStreak; break;
                    default:
                      aVal = a.tossWinPct; bVal = b.tossWinPct;
                  }

                  if (typeof aVal === 'string') {
                    return currentSortDirection === 'asc'
                      ? aVal.localeCompare(bVal)
                      : bVal.localeCompare(aVal);
                  }

                  return currentSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                });

                // Handler for opponent column clicks
                const handleOpponentSort = (column: string) => {
                  const currentSort = opponentSortBy[team.abbr];
                  const currentDir = opponentSortDirection[team.abbr] || 'desc';

                  if (currentSort === column) {
                    setOpponentSortDirection({
                      ...opponentSortDirection,
                      [team.abbr]: currentDir === 'asc' ? 'desc' : 'asc'
                    });
                  } else {
                    setOpponentSortBy({ ...opponentSortBy, [team.abbr]: column });
                    setOpponentSortDirection({ ...opponentSortDirection, [team.abbr]: 'desc' });
                  }
                };

                return (
                  <React.Fragment key={team.abbr}>
                    <tr
                      className="hover:bg-[#0f172a] transition cursor-pointer"
                      onClick={() => setExpandedTeam(isExpanded ? null : team.abbr)}
                    >
                      <td className="px-3 md:px-4 py-3">
                        <div className="flex items-center gap-2 md:gap-3">
                          {teamData && (
                            <img
                              src={teamData.logo_url}
                              alt={teamData.name}
                              className="w-7 h-7 md:w-8 md:h-8 object-contain flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 md:gap-2">
                              <span className="font-bold text-white text-sm md:text-base">{team.abbr}</span>
                              <span className="text-gray-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                            </div>
                            <div className="text-xs text-gray-400 truncate hidden sm:block">{teamData?.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 md:px-4 py-3 text-center text-gray-300 text-sm hidden sm:table-cell">{team.totalTosses}</td>
                      <td className="px-2 md:px-4 py-3 text-center text-gray-300 text-sm hidden sm:table-cell">{team.tossWins}</td>
                      <td className="px-2 md:px-4 py-3 text-center">
                        <span className="text-blue-400 font-semibold text-sm">{team.tossWinPct}%</span>
                      </td>
                      <td className="px-2 md:px-4 py-3 text-center hidden md:table-cell">
                        <span className="text-green-400 font-semibold text-sm">{team.gameWinPct}%</span>
                      </td>
                      <td className="px-2 md:px-4 py-3 text-center text-gray-300 text-sm hidden lg:table-cell">{team.deferPct}%</td>
                      <td className="px-2 md:px-4 py-3 text-center">
                        <span className={`px-2 md:px-3 py-1 text-xs font-bold rounded-full ${
                          team.currentStreak > 0
                            ? 'bg-green-900 text-green-300'
                            : 'bg-red-900 text-red-300'
                        }`}>
                          {team.currentStreak > 0 ? `W${team.currentStreak}` : `L${Math.abs(team.currentStreak)}`}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-3 text-center relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTeamClick(team.abbr);
                          }}
                          aria-label={`View ${team.abbr} team page`}
                          className="text-gray-500 hover:text-blue-400 transition-colors px-2 py-1 rounded hover:bg-blue-900/20"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Opponent Breakdown */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="bg-[#0a0e1a] p-0">
                          <div className="p-6">
                            <h3 className="text-lg font-bold text-white mb-4">
                              Opponents Faced by {team.abbr}
                            </h3>
                            {opponentStats.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead className="bg-[#0f172a] border-b border-gray-700">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => { e.stopPropagation(); handleOpponentSort('opponent'); }}>
                                        <div className="flex items-center gap-1">
                                          Opponent
                                          {currentSortBy === 'opponent' && <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>}
                                        </div>
                                      </th>
                                      <th className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => { e.stopPropagation(); handleOpponentSort('matchups'); }}>
                                        <div className="flex items-center justify-center gap-1">
                                          Games
                                          {currentSortBy === 'matchups' && <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>}
                                        </div>
                                      </th>
                                      <th className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => { e.stopPropagation(); handleOpponentSort('tossWins'); }}>
                                        <div className="flex items-center justify-center gap-1">
                                          Toss Wins vs {team.abbr}
                                          {currentSortBy === 'tossWins' && <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>}
                                        </div>
                                      </th>
                                      <th className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => { e.stopPropagation(); handleOpponentSort('gameWins'); }}>
                                        <div className="flex items-center justify-center gap-1">
                                          Game Wins vs {team.abbr}
                                          {currentSortBy === 'gameWins' && <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>}
                                        </div>
                                      </th>
                                      <th className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => { e.stopPropagation(); handleOpponentSort('tossWinPct'); }}>
                                        <div className="flex items-center justify-center gap-1">
                                          Toss Win %
                                          {currentSortBy === 'tossWinPct' && <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>}
                                        </div>
                                      </th>
                                      <th className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => { e.stopPropagation(); handleOpponentSort('gameWinPct'); }}>
                                        <div className="flex items-center justify-center gap-1">
                                          Won Game After Toss Win %
                                          {currentSortBy === 'gameWinPct' && <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>}
                                        </div>
                                      </th>
                                      <th className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => { e.stopPropagation(); handleOpponentSort('streak'); }}>
                                        <div className="flex items-center justify-center gap-1">
                                          Streak vs {team.abbr}
                                          {currentSortBy === 'streak' && <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>}
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-800">
                                    {opponentStats.map((opp: any) => {
                                      const oppData = getTeamData(opp.abbr);
                                      const opponentKey = `${team.abbr}-${opp.abbr}`;
                                      const isOppExpanded = expandedOpponent === opponentKey;
                                      const oppGames = isOppExpanded ? getGamesVsOpponent(team.abbr, opp.abbr) : [];

                                      return (
                                        <React.Fragment key={opp.abbr}>
                                          <tr
                                            className="hover:bg-[#0f172a] transition cursor-pointer"
                                            onClick={() => setExpandedOpponent(isOppExpanded ? null : opponentKey)}
                                          >
                                            <td className="px-4 py-3">
                                              <div className="flex items-center gap-3">
                                                <span className="text-gray-400 text-sm">{isOppExpanded ? '▼' : '▶'}</span>
                                                {oppData && (
                                                  <img src={oppData.logo_url} alt={oppData.name} className="w-6 h-6 object-contain" />
                                                )}
                                                <div>
                                                  <div className="font-bold text-white text-sm">{opp.abbr}</div>
                                                  <div className="text-xs text-gray-400">{oppData?.name}</div>
                                                </div>
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-center text-gray-300 text-sm">{opp.totalMatchups}</td>
                                            <td className="px-4 py-3 text-center text-gray-300 text-sm">{opp.tossWins}</td>
                                            <td className="px-4 py-3 text-center text-gray-300 text-sm">{opp.gameWins}</td>
                                            <td className="px-4 py-3 text-center">
                                              <span className="text-blue-400 font-semibold text-sm">{opp.tossWinPct}%</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              <span className="text-green-400 font-semibold text-sm">{opp.gameWinPct}%</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                                opp.currentStreak > 0 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                                              }`}>
                                                {opp.currentStreak > 0 ? `W${opp.currentStreak}` : `L${Math.abs(opp.currentStreak)}`}
                                              </span>
                                            </td>
                                          </tr>

                                          {/* Nested Accordion: Individual Games */}
                                          {isOppExpanded && (
                                            <tr>
                                              <td colSpan={7} className="bg-[#050810] p-0">
                                                <div className="p-4">
                                                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">
                                                    Individual Games: {team.abbr} vs {opp.abbr} ({oppGames.length} games)
                                                  </h4>
                                                  <div className="flex items-center gap-3 px-4 pb-2 mb-1 border-b border-gray-800/50">
                                                    <div className="text-[9px] font-bold tracking-widest text-gray-600 uppercase w-24 flex-shrink-0">Date</div>
                                                    <div className="hidden sm:block text-[9px] font-bold tracking-widest text-gray-600 uppercase flex-shrink-0">Type</div>
                                                    <div className="text-[9px] font-bold tracking-widest text-gray-600 uppercase flex-1">Toss</div>
                                                    <div className="text-[9px] font-bold tracking-widest text-gray-600 uppercase flex-shrink-0 w-16 text-right">Result</div>
                                                  </div>
                                                  <div className="space-y-1.5">
                                                    {oppGames.map((toss, idx) => {
                                                      const game = getGameForToss(toss);
                                                      const teamWonToss = toss.winner === team.abbr;
                                                      const isOT = toss.toss_type === 'Overtime';

                                                      let gameResult: 'won' | 'lost' | 'tie' | null = null;
                                                      if (game && game.home_score != null && game.away_score != null) {
                                                        if (game.home_score === game.away_score) {
                                                          gameResult = 'tie';
                                                        } else {
                                                          const gw = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
                                                          gameResult = gw === team.abbr ? 'won' : 'lost';
                                                        }
                                                      }

                                                      return (
                                                        <div
                                                          key={idx}
                                                          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#1a1f3a] transition cursor-pointer"
                                                          style={{ borderLeft: `3px solid ${teamWonToss ? '#22c55e' : '#ef4444'}`, backgroundColor: '#0f172a' }}
                                                          onClick={() => {
                                                            setClickedGame({
                                                              ...toss,
                                                              game,
                                                              opponent: toss.winner === team.abbr ? toss.loser : toss.winner,
                                                              gameResult,
                                                              regularTossWon: toss.toss_type === 'Regular' ? teamWonToss : null,
                                                              otTossWon: toss.toss_type === 'Overtime' ? teamWonToss : null,
                                                              hasOT: isOT,
                                                              title: toss.game_type === 'Postseason' ? (toss.round_name || `Playoff Week ${toss.week}`) :
                                                                     toss.game_type === 'Preseason' ? `Pre Week ${toss.week}` :
                                                                     `Week ${toss.week}`,
                                                              season: toss.season,
                                                              week: toss.week
                                                            });
                                                          }}
                                                        >
                                                          <div className="w-24 flex-shrink-0">
                                                            <div className="text-[11px] font-semibold text-gray-300 tabular-nums leading-tight">
                                                              {toss.game_date && formatGameDate(toss.game_date)}
                                                            </div>
                                                            <div className="text-[10px] text-gray-600 mt-0.5 leading-tight">
                                                              {toss.season} · Wk {toss.week}
                                                              {isOT && <span className="text-yellow-400 ml-1">OT</span>}
                                                            </div>
                                                          </div>
                                                          <div className="hidden sm:block flex-shrink-0">
                                                            <span className="text-[9px] font-bold tracking-widest text-gray-600 uppercase bg-gray-800/40 px-1.5 py-0.5 rounded-sm">
                                                              {toss.game_type === 'Postseason' ? 'PLY' : toss.game_type === 'Preseason' ? 'PRE' : 'REG'}
                                                            </span>
                                                          </div>
                                                          <div className="flex-1 min-w-0">
                                                            <span className={`font-bold text-xs ${teamWonToss ? 'text-green-400' : 'text-red-400'}`}>
                                                              {toss.winner}
                                                            </span>
                                                            <span className="text-gray-600 mx-1.5 text-[10px]">won toss</span>
                                                            <span className="text-gray-500 text-xs">{toss.loser}</span>
                                                            {toss.winner_choice && (
                                                              <span className="text-[10px] text-gray-600 ml-1">· chose {toss.winner_choice}</span>
                                                            )}
                                                          </div>
                                                          {game ? (
                                                            <div className="text-right flex-shrink-0 w-16">
                                                              <div className={`text-sm font-bold leading-none ${
                                                                gameResult === 'won' ? 'text-green-400' :
                                                                gameResult === 'lost' ? 'text-red-400' :
                                                                gameResult === 'tie' ? 'text-yellow-400' :
                                                                'text-gray-600'
                                                              }`}>
                                                                {gameResult === 'won' ? 'W' : gameResult === 'lost' ? 'L' : gameResult === 'tie' ? 'T' : '—'}
                                                              </div>
                                                              <div className="text-[10px] text-gray-600 tabular-nums mt-0.5">
                                                                {game.home_score}–{game.away_score}
                                                              </div>
                                                            </div>
                                                          ) : (
                                                            <div className="text-[10px] text-gray-700 flex-shrink-0 w-16 text-right">—</div>
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-gray-400 text-sm">No opponent data available</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* Game Detail Modal — only relevant in table view */}
        {tableView === 'table' && clickedGame && (
          <GameDetailModal
            clickedCell={clickedGame}
            teamAbbr={expandedTeam}
            getTeamData={getTeamData}
            onClose={() => setClickedGame(null)}
          />
        )}

        {/* Team Streak Showdown — shown when streak tab is active */}
        {tableView === 'streaks' && (
          <div className="p-6">
            {/* Legend */}
            <div className="flex flex-col items-center gap-2 mb-5">
              <p className="text-xs text-gray-600">Longest coin toss win &amp; loss streaks · click a team to view their page</p>
              <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-3 rounded bg-gradient-to-l from-red-600 to-red-700"></div>
                  <span>Longest Toss Loss Streak</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-3 rounded bg-gradient-to-r from-green-600 to-green-700"></div>
                  <span>Longest Toss Win Streak</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              {(() => {
                // Calculate streaks for each team from filteredTosses
                const teamStreaks: Record<string, any> = {};

                teams.forEach(team => {
                  const teamTosses = filteredTosses.filter(t =>
                    t.winner === team.abbreviation || t.loser === team.abbreviation
                  );

                  if (teamTosses.length === 0) return;

                  const sorted = [...teamTosses].sort((a, b) => {
                    if (a.game_date && b.game_date) {
                      const dateCompare = new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
                      if (dateCompare !== 0) return dateCompare;
                    }
                    if (a.season !== b.season) return a.season - b.season;
                    if (a.week !== b.week) return a.week - b.week;
                    if (a.toss_type === 'Regular' && b.toss_type === 'Overtime') return -1;
                    if (a.toss_type === 'Overtime' && b.toss_type === 'Regular') return 1;
                    return 0;
                  });

                  let currentWinStreak = 0;
                  let maxWinStreak = 0;
                  let currentLossStreak = 0;
                  let maxLossStreak = 0;

                  sorted.forEach(toss => {
                    if (toss.winner === team.abbreviation) {
                      currentWinStreak++;
                      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
                      currentLossStreak = 0;
                    } else {
                      currentLossStreak++;
                      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
                      currentWinStreak = 0;
                    }
                  });

                  if (maxWinStreak > 0 || maxLossStreak > 0) {
                    teamStreaks[team.abbreviation] = {
                      abbr: team.abbreviation,
                      maxWin: maxWinStreak,
                      maxLoss: maxLossStreak,
                      logo: team.logo_url
                    };
                  }
                });

                const sortedTeams = Object.values(teamStreaks).sort((a: any, b: any) => b.maxWin - a.maxWin);

                if (sortedTeams.length === 0) {
                  return <div className="text-gray-400 text-center py-4">No streak data available for selected filters</div>;
                }

                const globalMaxWin = Math.max(...sortedTeams.map((t: any) => t.maxWin), 1);
                const globalMaxLoss = Math.max(...sortedTeams.map((t: any) => t.maxLoss), 1);
                const globalMax = Math.max(globalMaxWin, globalMaxLoss);

                return sortedTeams.map((team: any) => (
                  <div key={team.abbr} className="flex items-center gap-2 py-1.5 px-3 bg-[#0f172a] rounded-lg hover:bg-[#151b30] transition">
                    {/* Clickable Team Logo + Name */}
                    <button
                      onClick={() => onTeamClick(team.abbr)}
                      className="flex items-center gap-2 w-24 flex-shrink-0 group"
                      title={`View ${team.abbr} team page`}
                    >
                      {team.logo && (
                        <img
                          src={team.logo}
                          alt={team.abbr}
                          className="w-6 h-6 object-contain group-hover:scale-110 transition-transform"
                        />
                      )}
                      <span className="text-white font-semibold text-xs group-hover:text-blue-400 transition-colors underline-offset-2 group-hover:underline">
                        {team.abbr}
                      </span>
                    </button>

                    {/* Mirrored Bar Chart */}
                    <div className="flex-1 flex items-center gap-1">
                      {/* Loss Streak (Left) */}
                      <div className="flex-1 flex justify-end items-center gap-1.5">
                        {team.maxLoss > 0 && (
                          <span className="text-xs text-red-400 font-medium w-6 text-right">L{team.maxLoss}</span>
                        )}
                        {team.maxLoss > 0 && (
                          <div
                            className="bg-gradient-to-l from-red-600 to-red-700 rounded-l h-6"
                            style={{ width: `${(team.maxLoss / globalMax) * 100}%` }}
                          />
                        )}
                      </div>

                      {/* Center Divider */}
                      <div className="w-0.5 h-8 bg-gray-600 flex-shrink-0"></div>

                      {/* Win Streak (Right) */}
                      <div className="flex-1 flex items-center gap-1.5">
                        {team.maxWin > 0 && (
                          <div
                            className="bg-gradient-to-r from-green-600 to-green-700 rounded-r h-6"
                            style={{ width: `${(team.maxWin / globalMax) * 100}%` }}
                          />
                        )}
                        {team.maxWin > 0 && (
                          <span className="text-xs text-green-400 font-medium w-7">W{team.maxWin}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Footnotes */}
      <div className="pt-4 border-t border-gray-800/40">
        <p className="text-[10px] text-gray-700 leading-relaxed">
          * Defer Rate is calculated as defers ÷ opening coin toss wins. Overtime tosses are excluded — the opening toss winner makes the strategic choice; OT toss outcomes are independent.
        </p>
      </div>
    </div>
  );
});

AnalyticsView.displayName = 'AnalyticsView';

export default AnalyticsView;
