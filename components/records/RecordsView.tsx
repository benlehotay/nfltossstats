'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import {
  LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Toss, Game, Team, TeamStat } from '@/lib/types';
import { formatGameDate, calculateAllRecords } from '@/lib/calculations';
import LazyChart from '@/components/shared/LazyChart';
import GameDetailModal from '@/components/team/GameDetailModal';

interface RecordsViewProps {
  tosses: Toss[];
  games: Game[];
  teams: Team[];
  teamStats: TeamStat[];
  getTeamData: (abbr: string) => Team | undefined;
  getGameForToss: (toss: Toss) => Game | undefined;
  onTeamClick: (abbr: string) => void;
}

const RecordsView = memo(function RecordsView({
  tosses, games, teams, teamStats, getTeamData, getGameForToss, onTeamClick
}: RecordsViewProps) {
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  // Filter state
  const [seasonFilter, setSeasonFilter] = useState('last5');
  const [customSeasonStart, setCustomSeasonStart] = useState(0);
  const [customSeasonEnd, setCustomSeasonEnd] = useState(0);
  const [selectedGameTypes, setSelectedGameTypes] = useState(['Regular Season', 'Postseason']);

  // Get available options
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

  // Filter tosses
  const filteredTosses = useMemo(() => {
    return tosses.filter(t => {
      // Season filter
      let includeBasedOnSeason = true;
      if (seasonFilter === 'last5') {
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

  // Calculate all records from filtered data
  const records = useMemo(() =>
    calculateAllRecords(filteredTosses, games, getGameForToss, teams),
    [filteredTosses, games, getGameForToss, teams]
  );

  // Calculate NFL-wide statistics for visualizations
  const nflStats = useMemo(() => {
    // Defer vs Receive trend
    const deferReceiveTrend: Record<number, { defer: number; receive: number }> = {};
    filteredTosses.forEach(toss => {
      if (toss.winner_choice) {
        if (!deferReceiveTrend[toss.season]) {
          deferReceiveTrend[toss.season] = { defer: 0, receive: 0 };
        }
        if (toss.winner_choice === 'Defer') {
          deferReceiveTrend[toss.season].defer++;
        } else if (toss.winner_choice === 'Receive') {
          deferReceiveTrend[toss.season].receive++;
        }
      }
    });

    const deferTrendData = Object.keys(deferReceiveTrend)
      .sort()
      .map(season => ({
        season: parseInt(season),
        deferPct: Math.round((deferReceiveTrend[parseInt(season)].defer / (deferReceiveTrend[parseInt(season)].defer + deferReceiveTrend[parseInt(season)].receive)) * 100),
        defer: deferReceiveTrend[parseInt(season)].defer,
        receive: deferReceiveTrend[parseInt(season)].receive
      }));

    // Toss Win → Game Win Correlation by Season
    const tossGameCorrelation: Record<number, { tossWinnerAlsoWonGame: number; total: number }> = {};
    filteredTosses.forEach(toss => {
      if (toss.toss_type !== 'Regular') return; // Only regular season opening tosses

      const game = getGameForToss(toss);
      if (!game || game.home_score == null || game.away_score == null) return;

      if (!tossGameCorrelation[toss.season]) {
        tossGameCorrelation[toss.season] = { tossWinnerAlsoWonGame: 0, total: 0 };
      }

      tossGameCorrelation[toss.season].total++;
      const gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
      if (toss.winner === gameWinner) {
        tossGameCorrelation[toss.season].tossWinnerAlsoWonGame++;
      }
    });

    const correlationData = Object.keys(tossGameCorrelation)
      .sort()
      .map(season => ({
        season: parseInt(season),
        correlation: Math.round((tossGameCorrelation[parseInt(season)].tossWinnerAlsoWonGame / tossGameCorrelation[parseInt(season)].total) * 100)
      }));

    // Team comparison data (Win vs Loss streaks)
    const teamTosses: Record<string, Toss[]> = {};
    filteredTosses.forEach(toss => {
      [toss.winner, toss.loser].forEach(team => {
        if (!teamTosses[team]) teamTosses[team] = [];
        teamTosses[team].push(toss);
      });
    });

    const teamComparisonData = Object.keys(teamTosses).map(team => {
      const teamData = getTeamData(team);

      // Find longest win and loss streaks with dates
      let longestWin = 0;
      let longestLoss = 0;
      let longestWinDates = { start: '', end: '' };
      let longestLossDates = { start: '', end: '' };
      let currentStreak = 0;
      let currentStreakStart: string | null = null;
      let currentStreakEnd: string | null = null;
      let currentIsWin: boolean | null = null;

      // Sort by date/season/week AND ensure Regular comes before OT
      const sorted = [...teamTosses[team]].sort((a, b) => {
        if (a.game_date && b.game_date) {
          const dateCompare = new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
          if (dateCompare !== 0) return dateCompare;
        } else if (a.season !== b.season) {
          return a.season - b.season;
        } else if (a.week !== b.week) {
          return a.week - b.week;
        }

        // Same game - Regular before OT
        const sameGame = (
          a.game_date === b.game_date &&
          ((a.winner === b.winner && a.loser === b.loser) ||
           (a.winner === b.loser && a.loser === b.winner))
        );

        if (sameGame) {
          if (a.toss_type === 'Regular' && b.toss_type === 'Overtime') return -1;
          if (a.toss_type === 'Overtime' && b.toss_type === 'Regular') return 1;
        }

        return 0;
      });

      sorted.forEach(toss => {
        const isWin = toss.winner === team;

        if (isWin) {
          // Winning
          if (currentIsWin !== true) {
            // Starting a NEW win streak (was losing or first toss)
            currentStreak = 1;
            currentStreakStart = toss.game_date ? formatGameDate(toss.game_date) : `${toss.season} Wk ${toss.week}`;
            currentStreakEnd = toss.game_date ? formatGameDate(toss.game_date) : `${toss.season} Wk ${toss.week}`;
          } else {
            // Continuing win streak
            currentStreak++;
            currentStreakEnd = toss.game_date ? formatGameDate(toss.game_date) : `${toss.season} Wk ${toss.week}`;
          }

          if (currentStreak > longestWin) {
            longestWin = currentStreak;
            longestWinDates = { start: currentStreakStart || '', end: currentStreakEnd || '' };
          }

          currentIsWin = true;
        } else {
          // Loss
          if (currentIsWin !== false) {
            // Starting a NEW loss streak (was winning or first toss)
            currentStreak = 1;
            currentStreakStart = toss.game_date ? formatGameDate(toss.game_date) : `${toss.season} Wk ${toss.week}`;
            currentStreakEnd = toss.game_date ? formatGameDate(toss.game_date) : `${toss.season} Wk ${toss.week}`;
          } else {
            // Continuing loss streak
            currentStreak++;
            currentStreakEnd = toss.game_date ? formatGameDate(toss.game_date) : `${toss.season} Wk ${toss.week}`;
          }

          if (currentStreak > longestLoss) {
            longestLoss = currentStreak;
            longestLossDates = { start: currentStreakStart || '', end: currentStreakEnd || '' };
          }

          currentIsWin = false;
        }
      });

      // Check final streak one more time
      if (currentIsWin === true && currentStreak > longestWin) {
        longestWin = currentStreak;
        longestWinDates = { start: currentStreakStart || '', end: currentStreakEnd || '' };
      } else if (currentIsWin === false && currentStreak > longestLoss) {
        longestLoss = currentStreak;
        longestLossDates = { start: currentStreakStart || '', end: currentStreakEnd || '' };
      }

      return {
        team,
        longestWin,
        longestLoss,
        longestWinDates,
        longestLossDates,
        color: teamData?.primary_color || '#3b82f6',
        logo: teamData?.logo_url || ''
      };
    });

    return {
      deferTrendData,
      correlationData,
      teamComparisonData,
      totalGames: filteredTosses.length,
      avgDeferRate: deferTrendData.length > 0
        ? Math.round(deferTrendData.reduce((sum, d) => sum + d.deferPct, 0) / deferTrendData.length)
        : 0,
      avgCorrelation: correlationData.length > 0
        ? Math.round(correlationData.reduce((sum, d) => sum + d.correlation, 0) / correlationData.length)
        : 0
    };
  }, [filteredTosses, games, getGameForToss, getTeamData]);

  // Memoize RecordCard to prevent recreating on every render
  const RecordCard = useMemo(() => memo(({ title, value, team, teams: teamList_, subtext, games: cardGames, gamesByTeam, recordKey, breakdown, getGameForToss: gGFT, getTeamData: gTD }: {
    title: string;
    value: string | number;
    team?: string;
    teams?: string[];
    subtext?: string;
    games?: Toss[];
    gamesByTeam?: Record<string, Toss[]>;
    recordKey: string;
    breakdown?: { label: string; value: string | number }[];
    getGameForToss: (toss: Toss) => Game | undefined;
    getTeamData: (abbr: string) => Team | undefined;
  }) => {
    const teamList = teamList_ || (team ? [team] : []);
    const teamData = teamList.map(t => gTD(t));
    const isExpanded = expandedRecord === recordKey;
    const [clickedGame, setClickedGame] = useState<any>(null);

    return (
      <div className="bg-[#1a1f3a] rounded-xl border border-gray-800 overflow-hidden">
        <button
          onClick={() => setExpandedRecord(isExpanded ? null : recordKey)}
          className="w-full p-6 hover:bg-[#0f172a] transition text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase">{title}</h3>
            <span className="text-gray-400 text-sm">{isExpanded ? '▼' : '▶'}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-4">
              {teamData.map((td, idx) => td && (
                <img
                  key={idx}
                  src={td.logo_url}
                  alt={teamList[idx]}
                  className="w-16 h-16 object-contain ring-4 ring-[#1a1f3a]"
                />
              ))}
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-400 mb-1">{value}</div>
              <div className="text-lg font-bold text-white">
                {teamList.join(' / ')}
                {teamList.length > 1 && <span className="text-sm text-gray-400 ml-2">(tied)</span>}
              </div>
              {/* Only show subtext if there's NOT a tie, to avoid confusion about which team's dates they are */}
              {subtext && teamList.length === 1 && <div className="text-sm text-gray-400 mt-1">{subtext}</div>}
            </div>
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-gray-800 p-6 bg-[#0a0e1a]">
            {/* Show breakdown if available */}
            {breakdown && breakdown.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-400 uppercase mb-4">Breakdown</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {breakdown.map((item, idx) => (
                    <div key={idx} className="bg-[#1a1f3a] p-3 rounded-lg flex items-center justify-between">
                      <span className="text-white">{item.label}</span>
                      <span className="text-blue-400 font-bold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show games if available */}
            {cardGames && cardGames.length > 0 && (
              <>
                {teamList.length > 1 && gamesByTeam ? (
                  /* Multiple teams - show comparison table */
                  <>
                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-4">
                      Streak Games Comparison
                    </h4>
                    <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${teamList.length}, 1fr)` }}>
                      {teamList.map(t => (
                        <div key={t}>
                          <div className="text-center mb-3">
                            {gTD(t)?.logo_url && (
                              <img
                                src={gTD(t)!.logo_url}
                                alt={t}
                                className="w-12 h-12 object-contain mx-auto mb-2"
                              />
                            )}
                            <div className="font-bold text-white">{t}</div>
                            <div className="text-xs text-gray-400">{gamesByTeam[t]?.length || 0} games</div>
                          </div>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {(gamesByTeam[t] || []).sort((a, b) => {
                              if (a.game_date && b.game_date) {
                                return new Date(b.game_date).getTime() - new Date(a.game_date).getTime();
                              }
                              return b.season - a.season || b.week - a.week;
                            }).map((toss, idx) => {
                              const game = gGFT(toss);
                              const teamWonToss = toss.winner === t;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    const opponent = teamWonToss ? toss.loser : toss.winner;
                                    let gameResult = null;
                                    if (game && game.home_score !== null) {
                                      if (game.home_score === game.away_score) {
                                        gameResult = 'tie';
                                      } else {
                                        const gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
                                        gameResult = t === gameWinner ? 'won' : 'lost';
                                      }
                                    }
                                    setClickedGame({
                                      ...toss,
                                      game,
                                      opponent,
                                      gameResult,
                                      regularTossWon: toss.toss_type === 'Regular' ? teamWonToss : null,
                                      otTossWon: toss.toss_type === 'Overtime' ? teamWonToss : null,
                                      hasOT: false,
                                      title: toss.game_type === 'Postseason' ? (toss.round_name || `Playoff Week ${toss.week}`) :
                                             toss.game_type === 'Preseason' ? `Pre Week ${toss.week}` :
                                             `Week ${toss.week}`,
                                      season: toss.season,
                                      week: toss.week
                                    });
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#0f172a] transition text-sm"
                                  style={{ borderLeft: `2px solid ${teamWonToss ? '#22c55e' : '#ef4444'}`, backgroundColor: '#1a1f3a' }}
                                >
                                  <div className="text-xs text-gray-500 w-20 flex-shrink-0">
                                    <div className="text-gray-400 font-medium tabular-nums">{toss.game_date ? formatGameDate(toss.game_date) : '—'}</div>
                                    <div className="text-[11px]">{toss.season} · Wk {toss.week}</div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-xs font-semibold ${teamWonToss ? 'text-green-400' : 'text-red-400'}`}>{toss.winner}</span>
                                    <span className="text-gray-600 text-xs mx-1">won vs</span>
                                    <span className="text-gray-400 text-xs">{toss.loser}</span>
                                  </div>
                                  {game && (
                                    <div className="text-xs text-gray-500 tabular-nums flex-shrink-0">
                                      {game.home_team} {game.home_score}–{game.away_score} {game.away_team}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  /* Single team - show list */
                  <>
                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-4">
                      Games ({cardGames.length})
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {[...cardGames].sort((a, b) => {
                        // Most recent first
                        if (a.game_date && b.game_date) {
                          const dateCompare = new Date(b.game_date).getTime() - new Date(a.game_date).getTime();
                          if (dateCompare !== 0) return dateCompare;
                        } else if (a.season !== b.season) {
                          return b.season - a.season;
                        } else if (a.week !== b.week) {
                          return b.week - a.week;
                        }

                        // Same date - check if same game
                        const sameGame = (
                          a.game_date === b.game_date &&
                          ((a.winner === b.winner && a.loser === b.loser) ||
                           (a.winner === b.loser && a.loser === b.winner))
                        );

                        if (sameGame) {
                          // OT happened after Regular, so OT appears first (above) in descending order
                          if (a.toss_type === 'Overtime' && b.toss_type === 'Regular') return -1;
                          if (a.toss_type === 'Regular' && b.toss_type === 'Overtime') return 1;
                        }

                        return 0;
                      }).map((toss, idx) => {
                        const game = gGFT(toss);
                        const isOT = toss.toss_type === 'Overtime';
                        const teamWonToss = toss.winner === team;

                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              const opponent = teamWonToss ? toss.loser : toss.winner;
                              let gameResult = null;
                              if (game && game.home_score !== null) {
                                if (game.home_score === game.away_score) {
                                  gameResult = 'tie';
                                } else {
                                  const gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
                                  gameResult = team === gameWinner ? 'won' : 'lost';
                                }
                              }
                              setClickedGame({
                                ...toss,
                                game,
                                opponent,
                                gameResult,
                                regularTossWon: toss.toss_type === 'Regular' ? teamWonToss : null,
                                otTossWon: toss.toss_type === 'Overtime' ? teamWonToss : null,
                                hasOT: false,
                                title: toss.game_type === 'Postseason' ? (toss.round_name || `Playoff Week ${toss.week}`) :
                                       toss.game_type === 'Preseason' ? `Pre Week ${toss.week}` :
                                       `Week ${toss.week}`,
                                season: toss.season,
                                week: toss.week
                              });
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#0f172a] transition text-sm"
                            style={{ borderLeft: `2px solid ${teamWonToss ? '#22c55e' : '#ef4444'}`, backgroundColor: '#1a1f3a' }}
                          >
                            <div className="text-xs text-gray-500 w-20 flex-shrink-0">
                              <div className="text-gray-400 font-medium tabular-nums">{toss.game_date ? formatGameDate(toss.game_date) : '—'}</div>
                              <div className="text-[11px]">{toss.season} · Wk {toss.week}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs font-semibold ${teamWonToss ? 'text-green-400' : 'text-red-400'}`}>{toss.winner}</span>
                              <span className="text-gray-600 text-xs mx-1">won vs</span>
                              <span className="text-gray-400 text-xs">{toss.loser}</span>
                              {isOT && <span className="text-yellow-400 text-[10px] ml-1">OT</span>}
                            </div>
                            {game && (
                              <div className="text-xs text-gray-500 tabular-nums flex-shrink-0">
                                {game.home_team} {game.home_score}–{game.away_score} {game.away_team}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Game Detail Modal */}
        {clickedGame && (
          <GameDetailModal
            clickedCell={clickedGame}
            teamAbbr={team || null}
            getTeamData={gTD}
            onClose={() => setClickedGame(null)}
          />
        )}
      </div>
    );
  }), [expandedRecord]);

  RecordCard.displayName = 'RecordCard';

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="bg-[#1a1f3a] p-4 md:p-6 rounded-xl border border-gray-800">
        <h3 className="text-base md:text-lg font-bold text-white mb-3 md:mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* Current Active Streaks */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-6">Current Active Streaks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RecordCard
            title="Longest Active Winning Streak"
            value={records.activeWinStreak.streak}
            team={records.activeWinStreak.team}
            teams={records.activeWinStreak.teams}
            subtext="Current streak"
            games={records.activeWinStreak.games}
            gamesByTeam={records.activeWinStreak.gamesByTeam}
            recordKey="active-win"
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
          <RecordCard
            title="Longest Active Losing Streak"
            value={records.activeLoseStreak.streak}
            team={records.activeLoseStreak.team}
            teams={records.activeLoseStreak.teams}
            subtext="Current streak"
            games={records.activeLoseStreak.games}
            gamesByTeam={records.activeLoseStreak.gamesByTeam}
            recordKey="active-lose"
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
        </div>
      </div>

      {/* Team Streaks */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-6">Team Streaks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RecordCard
            title="Longest Toss Winning Streak"
            value={records.longestTossWinStreak.streak}
            team={records.longestTossWinStreak.team}
            teams={records.longestTossWinStreak.teams}
            subtext={`${records.longestTossWinStreak.startDate} - ${records.longestTossWinStreak.endDate}`}
            games={records.longestTossWinStreak.games}
            gamesByTeam={records.longestTossWinStreak.gamesByTeam}
            recordKey="longest-win"
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
          <RecordCard
            title="Longest Toss Losing Streak"
            value={records.longestTossLoseStreak.streak}
            team={records.longestTossLoseStreak.team}
            teams={records.longestTossLoseStreak.teams}
            subtext={`${records.longestTossLoseStreak.startDate} - ${records.longestTossLoseStreak.endDate}`}
            games={records.longestTossLoseStreak.games}
            gamesByTeam={records.longestTossLoseStreak.gamesByTeam}
            recordKey="longest-lose"
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
        </div>
      </div>

      {/* Dominance Records */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-6">Dominance Records</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RecordCard
            title="Best Toss Win % (Min 50 Tosses)"
            value={`${records.bestTossWinPct.percentage}%`}
            team={records.bestTossWinPct.team}
            subtext={`${records.bestTossWinPct.wins} wins in ${records.bestTossWinPct.total} tosses`}
            recordKey="best-pct"
            breakdown={records.bestTossWinPct.byYear}
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
          <RecordCard
            title="Worst Toss Win % (Min 50 Tosses)"
            value={`${records.worstTossWinPct.percentage}%`}
            team={records.worstTossWinPct.team}
            subtext={`${records.worstTossWinPct.wins} wins in ${records.worstTossWinPct.total} tosses`}
            recordKey="worst-pct"
            breakdown={records.worstTossWinPct.byYear}
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
          <RecordCard
            title="Best Toss→Game Conversion"
            value={`${records.bestConversion.percentage}%`}
            team={records.bestConversion.team}
            subtext={`Won game ${records.bestConversion.gameWins} of ${records.bestConversion.tossWins} times after toss win`}
            recordKey="best-conversion"
            breakdown={records.bestConversion.byOpponent}
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
          <RecordCard
            title="Most Consecutive Defers"
            value={records.mostConsecutiveDefers.streak}
            team={records.mostConsecutiveDefers.team}
            subtext={`${records.mostConsecutiveDefers.startDate} - ${records.mostConsecutiveDefers.endDate}`}
            games={records.mostConsecutiveDefers.games}
            recordKey="most-defers"
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
        </div>
      </div>

      {/* Head-to-Head Domination */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-6">Head-to-Head Domination</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RecordCard
            title="Most Lopsided Rivalry"
            value={`${records.mostLopsidedRivalry.wins}-${records.mostLopsidedRivalry.losses}`}
            team={records.mostLopsidedRivalry.team}
            subtext={`vs ${records.mostLopsidedRivalry.opponent} (${records.mostLopsidedRivalry.percentage}%)`}
            games={records.mostLopsidedRivalry.games}
            recordKey="lopsided"
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
          <RecordCard
            title="Longest H2H Win Streak"
            value={records.longestH2HStreak.streak}
            team={records.longestH2HStreak.team}
            subtext={`vs ${records.longestH2HStreak.opponent}`}
            games={records.longestH2HStreak.games}
            recordKey="h2h-streak"
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
        </div>
      </div>

      {/* Season Records */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-6">Season Records</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RecordCard
            title="Best Single Season Record"
            value={`${records.bestSeasonRecord.wins}-${records.bestSeasonRecord.losses}`}
            team={records.bestSeasonRecord.team}
            subtext={`${records.bestSeasonRecord.season} season (${records.bestSeasonRecord.percentage}%)`}
            games={records.bestSeasonRecord.games}
            recordKey="best-season"
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
          <RecordCard
            title="Worst Single Season Record"
            value={`${records.worstSeasonRecord.wins}-${records.worstSeasonRecord.losses}`}
            team={records.worstSeasonRecord.team}
            subtext={`${records.worstSeasonRecord.season} season (${records.worstSeasonRecord.percentage}%)`}
            games={records.worstSeasonRecord.games}
            recordKey="worst-season"
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
        </div>
      </div>

      {/* NFL-Wide Trends - Visualizations */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-6">NFL-Wide Trends</h2>

        {/* Row 1: Defer % and Toss→Game Correlation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Defer vs Receive Trend */}
          <LazyChart fallbackHeight="350px">
            <div className="bg-[#1a1f3a] p-6 rounded-xl border border-gray-800">
              <h3 className="text-lg font-bold text-white mb-4">Defer % by Season</h3>
              <p className="text-sm text-gray-400 mb-4">
                Average: {nflStats.avgDeferRate}% of teams choose to defer when winning the toss
              </p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={nflStats.deferTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="season" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1f3a', border: '1px solid #374151' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="deferPct" stroke="#3b82f6" strokeWidth={2} name="Defer %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </LazyChart>

          {/* Toss Win → Game Win Correlation */}
          <LazyChart fallbackHeight="350px">
            <div className="bg-[#1a1f3a] p-6 rounded-xl border border-gray-800">
              <h3 className="text-lg font-bold text-white mb-4">Does Winning the Toss Help?</h3>
              <p className="text-sm text-gray-400 mb-4">
                Average: {nflStats.avgCorrelation}% of toss winners also won the game
              </p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={nflStats.correlationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="season" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" domain={[40, 60]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1f3a', border: '1px solid #374151' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="correlation" stroke="#10b981" strokeWidth={2} name="Toss→Game Win %" />
                  <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="3 3" label="50% (Random)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </LazyChart>
        </div>

        {/* Team Performance Quadrant Visualization */}
        <LazyChart fallbackHeight="660px">
          <div className="bg-[#1a1f3a] p-6 rounded-xl border border-gray-800">
            <h3 className="text-xl font-bold text-white mb-2">Team Performance Matrix</h3>
            <p className="text-sm text-gray-400 mb-6">Toss Success vs Game Success - See which teams are blessed, cursed, lucky, or doomed</p>

            {/* Calculate dynamic axis ranges based on data */}
            {(() => {
              const tossWinPcts = teamStats.map(t => t.tossWinPct);
              const gameWinPcts = teamStats.map(t => t.gameWinPct);

              const minToss = Math.min(...tossWinPcts);
              const maxToss = Math.max(...tossWinPcts);
              const minGame = Math.min(...gameWinPcts);
              const maxGame = Math.max(...gameWinPcts);

              // Add 5% padding on each side for breathing room
              const tossPadding = (maxToss - minToss) * 0.15;
              const gamePadding = (maxGame - minGame) * 0.15;

              const xMin = Math.max(0, Math.floor(minToss - tossPadding));
              const xMax = Math.min(100, Math.ceil(maxToss + tossPadding));
              const yMin = Math.max(0, Math.floor(minGame - gamePadding));
              const yMax = Math.min(100, Math.ceil(maxGame + gamePadding));

              return (
                <div className="w-full" style={{ height: '600px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 40, right: 40, bottom: 40, left: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        type="number"
                        dataKey="tossWinPct"
                        name="Toss Win %"
                        domain={[xMin, xMax]}
                        label={{ value: 'Toss Win %', position: 'bottom', fill: '#9ca3af', offset: 0 }}
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af' }}
                      />
                      <YAxis
                        type="number"
                        dataKey="gameWinPct"
                        name="Game Win %"
                        domain={[yMin, yMax]}
                        label={{ value: 'Game Win % (After Toss Win)', angle: -90, position: 'left', fill: '#9ca3af', offset: 10 }}
                        stroke="#9ca3af"
                        tick={{ fill: '#9ca3af' }}
                      />

                      {/* Reference lines at 50% */}
                      <ReferenceLine x={50} stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" />
                      <ReferenceLine y={50} stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" />

                      {/* Quadrant Labels */}
                      <text x="15%" y="15%" textAnchor="middle" fill="#f97316" fontSize="16" fontWeight="bold">
                        Cursed
                      </text>
                      <text x="15%" y="18%" textAnchor="middle" fill="#f97316" fontSize="11">
                        Good Tosses, Bad Results
                      </text>

                      <text x="85%" y="15%" textAnchor="middle" fill="#22c55e" fontSize="16" fontWeight="bold">
                        Blessed
                      </text>
                      <text x="85%" y="18%" textAnchor="middle" fill="#22c55e" fontSize="11">
                        Good Tosses, Good Results
                      </text>

                      <text x="15%" y="85%" textAnchor="middle" fill="#ef4444" fontSize="16" fontWeight="bold">
                        Doomed
                      </text>
                      <text x="15%" y="88%" textAnchor="middle" fill="#ef4444" fontSize="11">
                        Bad Tosses, Bad Results
                      </text>

                      <text x="85%" y="85%" textAnchor="middle" fill="#eab308" fontSize="16" fontWeight="bold">
                        Lucky
                      </text>
                      <text x="85%" y="88%" textAnchor="middle" fill="#eab308" fontSize="11">
                        Bad Tosses, Good Results
                      </text>

                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const teamData = getTeamData(data.abbr);
                            return (
                              <div className="bg-[#0a0e1a] border-2 border-gray-700 rounded-lg p-3 shadow-xl">
                                <div className="flex items-center gap-2 mb-2">
                                  {teamData?.logo_url && (
                                    <img src={teamData.logo_url} alt={data.abbr} className="w-8 h-8" />
                                  )}
                                  <div className="font-bold text-white">{data.abbr}</div>
                                </div>
                                <div className="text-sm space-y-1">
                                  <div className="text-blue-400">Toss Win %: {Number(data.tossWinPct).toFixed(2)}%</div>
                                  <div className="text-green-400">Game Win % (After Toss Win): {Number(data.gameWinPct).toFixed(2)}%</div>
                                  <div className="text-gray-400">Total Tosses: {data.totalTosses}</div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />

                      <Scatter
                        data={teamStats.map(team => ({
                          ...team,
                          // Add jitter to prevent overlap
                          tossWinPct: team.tossWinPct + (Math.random() - 0.5) * 2,
                          gameWinPct: team.gameWinPct + (Math.random() - 0.5) * 3
                        }))}
                        shape={(props: any) => {
                          const { cx, cy, payload } = props;
                          const teamData = getTeamData(payload.abbr);
                          if (!teamData?.logo_url) return <g />;

                          return (
                            <image
                              x={cx - 15}
                              y={cy - 15}
                              width={30}
                              height={30}
                              href={teamData.logo_url}
                              style={{ cursor: 'pointer' }}
                              onClick={() => onTeamClick(payload.abbr)}
                            />
                          );
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </div>
        </LazyChart>
      </div>
    </div>
  );
});

RecordsView.displayName = 'RecordsView';

export default RecordsView;
