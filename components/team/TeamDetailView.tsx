'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatGameDate } from '@/lib/calculations';
import { Toss, Game, Team } from '@/lib/types';
import GameDetailModal from './GameDetailModal';

interface TeamDetailViewProps {
  teamAbbr: string;
  tosses: Toss[];
  games: Game[];
  teams: Team[];
  getTeamData: (abbr: string) => Team | undefined;
  getGameForToss: (toss: Toss) => Game | undefined;
}

const TeamDetailView = memo(function TeamDetailView({
  teamAbbr, tosses, games, teams, getTeamData, getGameForToss
}: TeamDetailViewProps) {
  const router = useRouter();
  const [seasonFilter, setSeasonFilter] = useState('last5');
  const [customSeasonStart, setCustomSeasonStart] = useState(0);
  const [customSeasonEnd, setCustomSeasonEnd] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGameTypes, setSelectedGameTypes] = useState(['Regular Season', 'Postseason']);
  const [clickedCell, setClickedCell] = useState<any>(null);
  const [ganttMode, setGanttMode] = useState<'toss' | 'game'>('toss');
  const [logMode, setLogMode] = useState<'toss' | 'game'>('toss');
  const GAMES_PER_PAGE = 25;

  const teamData = getTeamData(teamAbbr);
  const teamTosses = tosses.filter(t => t.winner === teamAbbr || t.loser === teamAbbr);

  // Get available seasons and game types
  const availableSeasons = useMemo(() =>
    [...new Set(teamTosses.map(t => t.season))].sort((a, b) => b - a),
    [teamTosses]
  );

  const availableGameTypes = useMemo(() => {
    const types = [...new Set(teamTosses.map(t => t.game_type))].filter(Boolean) as string[];
    const order: Record<string, number> = { 'Preseason': 1, 'Regular Season': 2, 'Postseason': 3 };
    return types.sort((a, b) => (order[a] || 99) - (order[b] || 99));
  }, [teamTosses]);

  // Initialize custom season range
  useEffect(() => {
    if (availableSeasons.length > 0 && customSeasonStart === 0) {
      setCustomSeasonStart(availableSeasons[availableSeasons.length - 1]);
      setCustomSeasonEnd(availableSeasons[0]);
    }
  }, [availableSeasons, customSeasonStart]);

  // Filter tosses by season range AND game type
  const filteredTeamTosses = teamTosses.filter(toss => {
    let includeBasedOnSeason = true;
    if (seasonFilter === 'last1') {
      const recentSeasons = availableSeasons.slice(0, 1);
      includeBasedOnSeason = recentSeasons.includes(toss.season);
    } else if (seasonFilter === 'last5') {
      const recentSeasons = availableSeasons.slice(0, 5);
      includeBasedOnSeason = recentSeasons.includes(toss.season);
    } else if (seasonFilter === 'last10') {
      const recentSeasons = availableSeasons.slice(0, 10);
      includeBasedOnSeason = recentSeasons.includes(toss.season);
    } else if (seasonFilter === 'custom') {
      includeBasedOnSeason = toss.season >= customSeasonStart && toss.season <= customSeasonEnd;
    }

    if (!includeBasedOnSeason) return false;

    if (selectedGameTypes.length > 0 && !selectedGameTypes.includes(toss.game_type)) {
      return false;
    }

    return true;
  });

  const tossWins = filteredTeamTosses.filter(t => t.winner === teamAbbr).length;
  const tossWinPct = filteredTeamTosses.length > 0 ? Math.round((tossWins / filteredTeamTosses.length) * 100) : 0;

  const winningTosses = filteredTeamTosses.filter(t => t.winner === teamAbbr);
  const regularTossWins = winningTosses.filter(t => t.toss_type === 'Regular');
  const defers = regularTossWins.filter(t => t.winner_choice === 'Defer').length;
  const deferPct = regularTossWins.length > 0 ? Math.round((defers / regularTossWins.length) * 100) : 0;

  // Game win rate when winning toss
  const tossWinsWithGames = winningTosses.filter(t => {
    const game = getGameForToss(t);
    return game && game.home_score !== null && game.away_score !== null;
  });

  const gameWins = tossWinsWithGames.filter(t => {
    const game = getGameForToss(t);
    if (!game) return false;
    const gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
    return teamAbbr === gameWinner;
  }).length;

  const gameWinPct = tossWinsWithGames.length > 0
    ? Math.round((gameWins / tossWinsWithGames.length) * 100)
    : 0;

  // Calculate actual game records (W-L-T) for filtered tosses
  const teamGames = useMemo(() => {
    const gameIds = new Set<string>();
    const uniqueGames: Game[] = [];

    filteredTeamTosses.forEach(toss => {
      const game = getGameForToss(toss);
      if (game && game.home_score !== null && game.away_score !== null) {
        const gameKey = `${game.season}-${game.week}-${game.home_team}-${game.away_team}`;
        if (!gameIds.has(gameKey)) {
          gameIds.add(gameKey);
          uniqueGames.push(game);
        }
      }
    });

    return uniqueGames;
  }, [filteredTeamTosses, getGameForToss]);

  const gameRecords = useMemo(() => {
    let wins = 0, losses = 0, ties = 0;
    let homeWins = 0, homeLosses = 0, homeTies = 0;
    let awayWins = 0, awayLosses = 0, awayTies = 0;

    teamGames.forEach(game => {
      const isHome = game.home_team === teamAbbr;
      const isAway = game.away_team === teamAbbr;

      if (!isHome && !isAway) return;

      if (game.home_score === game.away_score) {
        ties++;
        if (isHome) homeTies++;
        if (isAway) awayTies++;
      } else if ((game.home_score ?? 0) > (game.away_score ?? 0)) {
        if (isHome) { wins++; homeWins++; }
        else { losses++; awayLosses++; }
      } else {
        if (isAway) { wins++; awayWins++; }
        else { losses++; homeLosses++; }
      }
    });

    const totalGames = wins + losses + ties;
    const winPct = totalGames > 0 ? (wins / totalGames) : 0;
    const homeTotal = homeWins + homeLosses + homeTies;
    const homeWinPct = homeTotal > 0 ? (homeWins / homeTotal) : 0;
    const awayTotal = awayWins + awayLosses + awayTies;
    const awayWinPct = awayTotal > 0 ? (awayWins / awayTotal) : 0;

    return {
      overall: { wins, losses, ties, winPct },
      home: { wins: homeWins, losses: homeLosses, ties: homeTies, winPct: homeWinPct },
      away: { wins: awayWins, losses: awayLosses, ties: awayTies, winPct: awayWinPct }
    };
  }, [teamGames, teamAbbr]);

  // Sort ALL tosses chronologically, Regular before OT for same game
  const sortedGames = [...filteredTeamTosses]
    .sort((a, b) => {
      if (a.game_date && b.game_date) {
        const dateCompare = new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
        if (dateCompare !== 0) return dateCompare;
      } else if (a.season !== b.season) {
        return a.season - b.season;
      } else if (a.week !== b.week) {
        return a.week - b.week;
      }

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

  // Create deduplicated game list (one entry per game for Game Log view)
  const uniqueGames: any[] = [];
  const seenGames = new Set<string>();

  sortedGames.forEach(toss => {
    const gameKey = `${toss.game_date}-${toss.season}-${toss.week}-${[toss.winner, toss.loser].sort().join('-')}`;
    if (!seenGames.has(gameKey)) {
      seenGames.add(gameKey);

      const otToss = sortedGames.find(t =>
        t.game_date === toss.game_date &&
        t.season === toss.season &&
        t.week === toss.week &&
        ((t.winner === toss.winner && t.loser === toss.loser) ||
         (t.winner === toss.loser && t.loser === toss.winner)) &&
        t.toss_type === 'Overtime'
      );

      uniqueGames.push({
        ...toss,
        regularToss: toss,
        otToss: otToss || null
      });
    }
  });

  // Calculate current streak
  let currentStreak = 0;
  if (sortedGames.length > 0) {
    const recentFirst = [...sortedGames].reverse();
    const mostRecentIsWin = recentFirst[0].winner === teamAbbr;
    for (const toss of recentFirst) {
      const currentIsWin = toss.winner === teamAbbr;
      if (currentIsWin !== mostRecentIsWin) break;
      currentStreak += mostRecentIsWin ? 1 : -1;
    }
  }

  // Pagination logic
  const totalGamesCount = sortedGames.length;
  const totalPages = Math.ceil(totalGamesCount / GAMES_PER_PAGE);
  const showPagination = totalGamesCount > GAMES_PER_PAGE;

  const displayList = logMode === 'toss' ? sortedGames : uniqueGames;
  const displayGames = displayList.slice().reverse();
  const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
  const endIndex = startIndex + GAMES_PER_PAGE;
  const paginatedGames = displayGames.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [seasonFilter, customSeasonStart, customSeasonEnd, selectedGameTypes]);

  // Prepare Gantt timeline data
  const ganttData = useMemo(() => {
    const seasonData: Record<string, any> = {};

    const hasPre2021Seasons = filteredTeamTosses.some(t => t.season < 2021);

    filteredTeamTosses.forEach(toss => {
      if (!seasonData[toss.season]) {
        const preseasonCells = hasPre2021Seasons ? 5 : 4;

        seasonData[toss.season] = {
          preseason: Array(preseasonCells).fill(null),
          preseasonActualWeeks: toss.season >= 2021 ? 4 : 5,
          regular: Array(18).fill(null),
          postseason: Array(4).fill(null)
        };
      }

      let category: string, weekIndex: number;
      const gameType = (toss.game_type || '').trim().toLowerCase();
      const weekNum = parseInt(String(toss.week));
      const isOT = toss.toss_type === 'Overtime';

      if (gameType === 'preseason' || gameType.includes('pre')) {
        category = 'preseason';
        weekIndex = weekNum - 1;
      } else if (gameType === 'postseason' || gameType.includes('post')) {
        category = 'postseason';
        weekIndex = weekNum - 1;
      } else {
        category = 'regular';
        weekIndex = weekNum - 1;
      }

      const weekArray = seasonData[toss.season][category];

      if (weekIndex >= 0 && weekIndex < weekArray.length) {
        const game = getGameForToss(toss);
        let gameResult = null;

        if (game && game.home_score !== null && game.away_score !== null) {
          if (game.home_score === game.away_score) {
            gameResult = 'tie';
          } else {
            const teamScore = game.home_team === teamAbbr ? game.home_score : game.away_score;
            const oppScore = game.home_team === teamAbbr ? game.away_score : game.home_score;
            gameResult = (teamScore ?? 0) > (oppScore ?? 0) ? 'won' : 'lost';
          }
        }

        if (!weekArray[weekIndex]) {
          weekArray[weekIndex] = {
            tosses: [toss],
            regularTossWon: !isOT ? (toss.winner === teamAbbr) : null,
            otTossWon: isOT ? (toss.winner === teamAbbr) : null,
            opponent: toss.winner === teamAbbr ? toss.loser : toss.winner,
            game: game,
            gameResult: gameResult,
            week: weekNum,
            roundName: toss.round_name || null,
            hasOT: isOT
          };
        } else {
          weekArray[weekIndex].tosses.push(toss);
          weekArray[weekIndex].hasOT = weekArray[weekIndex].hasOT || isOT;

          if (isOT) {
            weekArray[weekIndex].otTossWon = toss.winner === teamAbbr;
          } else if (weekArray[weekIndex].regularTossWon === null) {
            weekArray[weekIndex].regularTossWon = toss.winner === teamAbbr;
          }
        }
      }
    });

    return seasonData;
  }, [filteredTeamTosses, teamAbbr, getGameForToss]);

  if (!teamData) return <div className="text-white">Team not found</div>;

  const onTeamClick = (abbr: string) => {
    router.push(`/team/${abbr}`);
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        aria-label="Go back to previous page"
        className="px-3 md:px-4 py-2 bg-[#1a1f3a] text-white text-sm md:text-base rounded-lg hover:bg-[#0f172a] transition"
      >
        ← Back
      </button>

      {/* Team Header */}
      <div
        className="rounded-xl md:rounded-2xl p-4 md:p-8 lg:p-12 border"
        style={{
          background: `linear-gradient(135deg, ${teamData.primary_color}22 0%, ${teamData.secondary_color}22 100%)`,
          borderColor: `${teamData.primary_color}44`
        }}
      >
        <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 lg:gap-8">
          <Image
            src={teamData.logo_url}
            alt={teamData.name}
            width={160}
            height={160}
            className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-40 lg:h-40 object-contain flex-shrink-0"
            priority
          />
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-1 md:mb-2">{teamData.name}</h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 mb-3 md:mb-4">{teamData.city}, {teamData.state}</p>
            <div className="flex flex-wrap gap-2 md:gap-4 justify-center sm:justify-start">
              <div className="px-3 md:px-4 py-1.5 md:py-2 bg-black/30 rounded-lg">
                <div className="text-xs md:text-sm text-gray-400">Conference</div>
                <div className="text-sm md:text-base lg:text-lg font-bold text-white">{teamData.conference}</div>
              </div>
              <div className="px-3 md:px-4 py-1.5 md:py-2 bg-black/30 rounded-lg">
                <div className="text-xs md:text-sm text-gray-400">Division</div>
                <div className="text-sm md:text-base lg:text-lg font-bold text-white">{teamData.division}</div>
              </div>
              <div className="px-3 md:px-4 py-1.5 md:py-2 bg-black/30 rounded-lg">
                <div className="text-xs md:text-sm text-gray-400">Coin Toss Streak</div>
                <div className={`text-sm md:text-base lg:text-lg font-bold ${
                  currentStreak > 0 ? 'text-green-400' :
                  currentStreak < 0 ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {currentStreak > 0 ? `W${currentStreak}` :
                   currentStreak < 0 ? `L${Math.abs(currentStreak)}` :
                   '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-[#1a1f3a] p-4 md:p-6 rounded-xl border border-gray-800">
          <div className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">Total Tosses</div>
          <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">{filteredTeamTosses.length}</div>
        </div>
        <div className="bg-[#1a1f3a] p-4 md:p-6 rounded-xl border border-gray-800">
          <div className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">Toss Win Rate</div>
          <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-blue-400">{tossWinPct}%</div>
        </div>
        <div className="bg-[#1a1f3a] p-4 md:p-6 rounded-xl border border-gray-800">
          <div className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">Game Win % (After Toss Win)</div>
          <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-green-400">{gameWinPct}%</div>
        </div>
        <div className="bg-[#1a1f3a] p-4 md:p-6 rounded-xl border border-gray-800">
          <div className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">Defer Rate</div>
          <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-purple-400">{deferPct}%</div>
        </div>
      </div>

      {/* Actual Game Records */}
      <div className="bg-[#1a1f3a] rounded-xl p-4 md:p-6 border border-gray-800">
        <h3 className="text-base md:text-lg font-bold text-white mb-3 md:mb-4">Actual Game Record</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          <div className="text-center">
            <div className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">Overall</div>
            <div className="text-2xl md:text-3xl font-bold text-white mb-1">
              {gameRecords.overall.wins}-{gameRecords.overall.losses}
              {gameRecords.overall.ties > 0 && `-${gameRecords.overall.ties}`}
            </div>
            <div className="text-sm md:text-base lg:text-lg text-gray-400">({gameRecords.overall.winPct.toFixed(3)})</div>
          </div>
          <div className="text-center">
            <div className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">Home</div>
            <div className="text-2xl md:text-3xl font-bold text-white mb-1">
              {gameRecords.home.wins}-{gameRecords.home.losses}
              {gameRecords.home.ties > 0 && `-${gameRecords.home.ties}`}
            </div>
            <div className="text-sm md:text-base lg:text-lg text-gray-400">({gameRecords.home.winPct.toFixed(3)})</div>
          </div>
          <div className="text-center">
            <div className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">Away</div>
            <div className="text-2xl md:text-3xl font-bold text-white mb-1">
              {gameRecords.away.wins}-{gameRecords.away.losses}
              {gameRecords.away.ties > 0 && `-${gameRecords.away.ties}`}
            </div>
            <div className="text-sm md:text-base lg:text-lg text-gray-400">({gameRecords.away.winPct.toFixed(3)})</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1f3a] rounded-xl p-4 md:p-6 border border-gray-800">
        <h3 className="text-base md:text-lg font-bold text-white mb-3 md:mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
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
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">GAME TYPE</label>
            <div className="flex flex-wrap gap-2">
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
                  aria-pressed={selectedGameTypes.includes(type)}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition ${
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

          <div className="flex items-end">
            <div className="text-sm text-gray-400">
              Showing <span className="text-white font-bold">{sortedGames.length}</span> games
            </div>
          </div>
        </div>
      </div>

      {/* Toss Performance Timeline (Gantt Chart) */}
      <div className="bg-[#1a1f3a] rounded-xl p-4 md:p-6 border border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-xl md:text-2xl font-bold text-white">Performance Timeline</h3>
          <div className="flex gap-1.5 md:gap-2 bg-[#0f172a] rounded-lg p-1 self-start sm:self-auto">
            <button
              onClick={() => setGanttMode('toss')}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition ${
                ganttMode === 'toss' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Coin Toss
            </button>
            <button
              onClick={() => setGanttMode('game')}
              className={`px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition ${
                ganttMode === 'game' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Game Results
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          {ganttMode === 'toss'
            ? 'Cell fill = Regular toss result (Green = Won, Red = Lost). Border = OT toss result (if game went to OT). Gray = No game/Bye week'
            : 'Cell color = Game result (Green = Won game, Red = Lost game, Yellow = Tied game). Gray = No game/Bye week'
          }
        </p>

        <div className="overflow-x-auto py-8" style={{ overflowY: 'visible' }}>
          <div className="min-w-[1200px]" style={{ position: 'relative' }}>
            {Object.keys(ganttData).sort((a, b) => Number(b) - Number(a)).map((season, seasonIdx) => {
              const data = ganttData[season];

              return (
                <div key={season} className="mb-4 relative" style={{ zIndex: 50 - seasonIdx, position: 'relative' }}>
                  <div className="flex items-center mb-2">
                    <div className="w-16 text-sm font-bold text-white text-right pr-4">{season}</div>
                    <div className="flex-1 flex gap-1" style={{ position: 'relative', zIndex: 'inherit' }}>
                      {/* Preseason */}
                      {selectedGameTypes.includes('Preseason') && (
                        <div className="flex gap-0.5">
                          {data.preseason.map((cell: any, idx: number) => {
                            let fillColor = 'bg-gray-800';

                            if (ganttMode === 'toss') {
                              if (cell && cell.regularTossWon !== null) {
                                fillColor = cell.regularTossWon ? 'bg-green-500' : 'bg-red-500';
                              }
                            } else {
                              if (cell && cell.gameResult) {
                                fillColor = cell.gameResult === 'won' ? 'bg-green-500' :
                                           cell.gameResult === 'lost' ? 'bg-red-500' :
                                           'bg-yellow-500';
                              }
                            }

                            return (
                              <div
                                key={`pre-${idx}`}
                                className={`relative w-6 h-8 rounded-md ${fillColor} ${cell ? 'hover:opacity-80 hover:ring-2 hover:ring-blue-400 cursor-pointer' : ''} transition overflow-hidden`}
                                onClick={() => cell && setClickedCell({ ...cell, title: cell.roundName || `Pre Week ${idx + 1}`, season })}
                              >
                                {ganttMode === 'toss' && cell && cell.hasOT && cell.otTossWon !== null && (
                                  <div
                                    className="absolute top-0 right-0 w-0 h-0"
                                    style={{
                                      borderTop: cell.otTossWon
                                        ? (cell.regularTossWon ? '8px solid #166534' : '8px solid #22c55e')
                                        : (cell.regularTossWon ? '#ef4444' : '8px solid #7f1d1d'),
                                      borderRight: cell.otTossWon
                                        ? (cell.regularTossWon ? '8px solid #166534' : '8px solid #22c55e')
                                        : (cell.regularTossWon ? '8px solid #ef4444' : '8px solid #7f1d1d'),
                                      borderBottom: '8px solid transparent',
                                      borderLeft: '8px solid transparent'
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {selectedGameTypes.includes('Preseason') && <div className="w-1"></div>}

                      {/* Regular Season */}
                      {selectedGameTypes.includes('Regular Season') && (
                        <div className="flex gap-0.5">
                          {data.regular.map((cell: any, idx: number) => {
                            let fillColor = 'bg-gray-800';

                            if (ganttMode === 'toss') {
                              if (cell && cell.regularTossWon !== null) {
                                fillColor = cell.regularTossWon ? 'bg-green-500' : 'bg-red-500';
                              }
                            } else {
                              if (cell && cell.gameResult) {
                                fillColor = cell.gameResult === 'won' ? 'bg-green-500' :
                                           cell.gameResult === 'lost' ? 'bg-red-500' :
                                           'bg-yellow-500';
                              }
                            }

                            return (
                              <div
                                key={`reg-${idx}`}
                                className={`relative w-6 h-8 rounded-md ${fillColor} ${cell ? 'hover:opacity-80 hover:ring-2 hover:ring-blue-400 cursor-pointer' : ''} transition overflow-hidden`}
                                onClick={() => cell && setClickedCell({ ...cell, title: `Week ${idx + 1}`, season })}
                              >
                                {ganttMode === 'toss' && cell && cell.hasOT && cell.otTossWon !== null && (
                                  <div
                                    className="absolute top-0 right-0 w-0 h-0"
                                    style={{
                                      borderTop: cell.otTossWon
                                        ? (cell.regularTossWon ? '8px solid #166534' : '8px solid #22c55e')
                                        : (cell.regularTossWon ? '8px solid #ef4444' : '8px solid #7f1d1d'),
                                      borderRight: cell.otTossWon
                                        ? (cell.regularTossWon ? '8px solid #166534' : '8px solid #22c55e')
                                        : (cell.regularTossWon ? '8px solid #ef4444' : '8px solid #7f1d1d'),
                                      borderBottom: '8px solid transparent',
                                      borderLeft: '8px solid transparent'
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {selectedGameTypes.includes('Regular Season') && selectedGameTypes.includes('Postseason') && <div className="w-1"></div>}

                      {/* Postseason */}
                      {selectedGameTypes.includes('Postseason') && (
                        <div className="flex gap-0.5">
                          {data.postseason.map((cell: any, idx: number) => {
                            let fillColor = 'bg-gray-800';

                            if (ganttMode === 'toss') {
                              if (cell && cell.regularTossWon !== null) {
                                fillColor = cell.regularTossWon ? 'bg-green-500' : 'bg-red-500';
                              }
                            } else {
                              if (cell && cell.gameResult) {
                                fillColor = cell.gameResult === 'won' ? 'bg-green-500' :
                                           cell.gameResult === 'lost' ? 'bg-red-500' :
                                           'bg-yellow-500';
                              }
                            }

                            return (
                              <div
                                key={`post-${idx}`}
                                className={`relative w-6 h-8 rounded-md ${fillColor} ${cell ? 'hover:opacity-80 hover:ring-2 hover:ring-blue-400 cursor-pointer' : ''} transition overflow-hidden`}
                                onClick={() => cell && setClickedCell({ ...cell, title: cell.roundName || `Playoff Week ${idx + 1}`, season })}
                              >
                                {ganttMode === 'toss' && cell && cell.hasOT && cell.otTossWon !== null && (
                                  <div
                                    className="absolute top-0 right-0 w-0 h-0"
                                    style={{
                                      borderTop: cell.otTossWon
                                        ? (cell.regularTossWon ? '8px solid #166534' : '8px solid #22c55e')
                                        : (cell.regularTossWon ? '8px solid #ef4444' : '8px solid #7f1d1d'),
                                      borderRight: cell.otTossWon
                                        ? (cell.regularTossWon ? '8px solid #166534' : '8px solid #22c55e')
                                        : (cell.regularTossWon ? '8px solid #ef4444' : '8px solid #7f1d1d'),
                                      borderBottom: '8px solid transparent',
                                      borderLeft: '8px solid transparent'
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Week Labels */}
            <div className="flex items-center mt-2">
              <div className="w-16"></div>
              <div className="flex-1 flex gap-1">
                {selectedGameTypes.includes('Preseason') && (
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(w => (
                      <div key={`pre-label-${w}`} className="w-6 text-[8px] text-gray-500 text-center">P{w}</div>
                    ))}
                  </div>
                )}
                {selectedGameTypes.includes('Preseason') && <div className="w-1"></div>}

                {selectedGameTypes.includes('Regular Season') && (
                  <div className="flex gap-0.5">
                    {Array.from({length: 18}, (_, i) => i + 1).map(w => (
                      <div key={`reg-label-${w}`} className="w-6 text-[8px] text-gray-500 text-center">{w}</div>
                    ))}
                  </div>
                )}
                {selectedGameTypes.includes('Regular Season') && selectedGameTypes.includes('Postseason') && <div className="w-1"></div>}

                {selectedGameTypes.includes('Postseason') && (
                  <div className="flex gap-0.5">
                    {[1,2,3,4].map(w => (
                      <div key={`post-label-${w}`} className="w-6 text-[8px] text-gray-500 text-center">PO{w}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cell Detail Modal */}
      {clickedCell && (
        <GameDetailModal
          clickedCell={clickedCell}
          teamAbbr={teamAbbr}
          getTeamData={getTeamData}
          onClose={() => setClickedCell(null)}
        />
      )}

      {/* Coin Toss Log / Game Log */}
      <div className="bg-[#1a1f3a] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">Game History</h3>
          <div className="flex gap-2 bg-[#0f172a] rounded-lg p-1">
            <button
              onClick={() => setLogMode('toss')}
              aria-pressed={logMode === 'toss'}
              className={`px-4 py-2 rounded-md font-medium transition ${
                logMode === 'toss' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Coin Toss Log
            </button>
            <button
              onClick={() => setLogMode('game')}
              aria-pressed={logMode === 'game'}
              className={`px-4 py-2 rounded-md font-medium transition ${
                logMode === 'game' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Game Log
            </button>
          </div>
        </div>
        {sortedGames.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No games found in selected date range
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-4 pb-2 mb-1 border-b border-gray-800/50">
              <div className="text-[9px] font-bold tracking-widest text-gray-600 uppercase w-20 sm:w-24 flex-shrink-0">Date</div>
              <div className="hidden sm:block text-[9px] font-bold tracking-widest text-gray-600 uppercase w-10 flex-shrink-0">Type</div>
              <div className="text-[9px] font-bold tracking-widest text-gray-600 uppercase flex-1">Opponent</div>
              <div className="text-[9px] font-bold tracking-widest text-gray-600 uppercase flex-shrink-0">Toss</div>
              <div className="text-[9px] font-bold tracking-widest text-gray-600 uppercase w-16 text-right flex-shrink-0">Result</div>
            </div>
            {logMode === 'toss' ? (
              // COIN TOSS LOG - Show all tosses (Regular and OT separately)
              paginatedGames.map((toss: any, idx: number) => {
                const isWinner = toss.winner === teamAbbr;
                const opponent = isWinner ? toss.loser : toss.winner;
                const opponentData = getTeamData(opponent);
                const game = getGameForToss(toss);

                let gameResult = null;
                if (game && game.home_score !== null && game.away_score !== null) {
                  if (game.home_score === game.away_score) {
                    gameResult = 'tie';
                  } else {
                    const gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
                    gameResult = teamAbbr === gameWinner ? 'won' : 'lost';
                  }
                }

                const myScore = game ? (game.home_team === teamAbbr ? game.home_score : game.away_score) : null;
                const theirScore = game ? (game.home_team === teamAbbr ? game.away_score : game.home_score) : null;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      const modalData = {
                        ...toss,
                        game,
                        opponent,
                        gameResult,
                        regularTossWon: toss.toss_type === 'Regular' ? isWinner : null,
                        otTossWon: toss.toss_type === 'Overtime' ? isWinner : null,
                        hasOT: toss.toss_type === 'Overtime',
                        title: toss.game_type === 'Postseason' ? (toss.round_name || `Playoff Week ${toss.week}`) :
                               toss.game_type === 'Preseason' ? `Pre Week ${toss.week}` :
                               `Week ${toss.week}`,
                        season: toss.season,
                        week: toss.week
                      };
                      setClickedCell(modalData);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#111827] transition cursor-pointer"
                    style={{ borderLeft: `3px solid ${isWinner ? '#22c55e' : '#ef4444'}`, backgroundColor: '#0f172a' }}
                  >
                    {/* Date + week */}
                    <div className="w-20 sm:w-24 flex-shrink-0">
                      <div className="text-[11px] font-semibold text-gray-300 tabular-nums leading-tight">
                        {toss.game_date && formatGameDate(toss.game_date)}
                      </div>
                      <div className="text-[10px] text-gray-600 mt-0.5 leading-tight">
                        {toss.season} · Wk {toss.week}
                        {toss.toss_type === 'Overtime' && (
                          <span className="text-yellow-400 ml-1">OT</span>
                        )}
                      </div>
                    </div>

                    {/* Game type */}
                    <div className="hidden sm:block w-10 flex-shrink-0">
                      <span className="text-[9px] font-bold tracking-widest text-gray-600 uppercase bg-gray-800/40 px-1.5 py-0.5 rounded-sm">
                        {toss.game_type === 'Postseason' ? 'PLY' : toss.game_type === 'Preseason' ? 'PRE' : 'REG'}
                      </span>
                    </div>

                    {/* Opponent */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-gray-600 text-[11px] font-medium uppercase tracking-wider">vs</span>
                      {opponentData && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onTeamClick(opponent); }}
                          className="hover:opacity-75 transition flex-shrink-0"
                        >
                          <img src={opponentData.logo_url} alt={opponent} className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
                        </button>
                      )}
                      <span className="text-white text-sm font-bold truncate">{opponent}</span>
                    </div>

                    {/* Toss result pill */}
                    <div className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded tracking-wider whitespace-nowrap ${
                      isWinner
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {isWinner ? 'WIN' : 'LOSS'}
                      {isWinner && toss.winner_choice && (
                        <span className="ml-1 opacity-60 font-normal">· {toss.winner_choice}</span>
                      )}
                    </div>

                    {/* Game score */}
                    {game ? (
                      <div className="flex-shrink-0 w-16 text-right">
                        <div className={`text-sm font-bold leading-none ${
                          gameResult === 'won' ? 'text-green-400' :
                          gameResult === 'lost' ? 'text-red-400' :
                          'text-yellow-400'
                        }`}>
                          {gameResult === 'won' ? 'W' : gameResult === 'lost' ? 'L' : 'T'}
                        </div>
                        {myScore != null && (
                          <div className="text-[10px] text-gray-600 tabular-nums mt-0.5">{myScore}–{theirScore}</div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-16 text-right text-[10px] text-gray-700">—</div>
                    )}
                  </div>
                );
              })
            ) : (
              // GAME LOG - One entry per game with combined toss results
              paginatedGames.map((gameEntry: any, idx: number) => {
                const regularToss = gameEntry.regularToss;
                const otToss = gameEntry.otToss;
                const regularIsWinner = regularToss.winner === teamAbbr;
                const otIsWinner = otToss ? otToss.winner === teamAbbr : null;
                const opponent = regularIsWinner ? regularToss.loser : regularToss.winner;
                const opponentData = getTeamData(opponent);
                const game = getGameForToss(regularToss);

                let gameResult = null;
                if (game && game.home_score !== null && game.away_score !== null) {
                  if (game.home_score === game.away_score) {
                    gameResult = 'tie';
                  } else {
                    const gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
                    gameResult = teamAbbr === gameWinner ? 'won' : 'lost';
                  }
                }

                const gameResultColor =
                  gameResult === 'tie' ? '#eab308' :
                  gameResult === 'won' ? '#22c55e' :
                  gameResult === 'lost' ? '#ef4444' :
                  '#6b7280';
                const myScore = game ? (game.home_team === teamAbbr ? game.home_score : game.away_score) : null;
                const theirScore = game ? (game.home_team === teamAbbr ? game.away_score : game.home_score) : null;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      const modalData = {
                        ...regularToss,
                        game,
                        opponent,
                        gameResult,
                        regularTossWon: regularIsWinner,
                        otTossWon: otIsWinner,
                        hasOT: !!otToss,
                        title: regularToss.game_type === 'Postseason' ? (regularToss.round_name || `Playoff Week ${regularToss.week}`) :
                               regularToss.game_type === 'Preseason' ? `Pre Week ${regularToss.week}` :
                               `Week ${regularToss.week}`,
                        season: regularToss.season,
                        week: regularToss.week
                      };
                      setClickedCell(modalData);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#111827] transition cursor-pointer"
                    style={{ borderLeft: `3px solid ${gameResultColor}`, backgroundColor: '#0f172a' }}
                  >
                    {/* Date + week */}
                    <div className="w-20 sm:w-24 flex-shrink-0">
                      <div className="text-[11px] font-semibold text-gray-300 tabular-nums leading-tight">
                        {regularToss.game_date && formatGameDate(regularToss.game_date)}
                      </div>
                      <div className="text-[10px] text-gray-600 mt-0.5 leading-tight">
                        {regularToss.season} · Wk {regularToss.week}
                        {otToss && <span className="text-yellow-400 ml-1">OT</span>}
                      </div>
                    </div>

                    {/* Game type */}
                    <div className="hidden sm:block w-10 flex-shrink-0">
                      <span className="text-[9px] font-bold tracking-widest text-gray-600 uppercase bg-gray-800/40 px-1.5 py-0.5 rounded-sm">
                        {regularToss.game_type === 'Postseason' ? 'PLY' : regularToss.game_type === 'Preseason' ? 'PRE' : 'REG'}
                      </span>
                    </div>

                    {/* Opponent */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-gray-600 text-[11px] font-medium uppercase tracking-wider">vs</span>
                      {opponentData && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onTeamClick(opponent); }}
                          className="hover:opacity-75 transition flex-shrink-0"
                        >
                          <img src={opponentData.logo_url} alt={opponent} className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
                        </button>
                      )}
                      <span className="text-white text-sm font-bold truncate">{opponent}</span>
                    </div>

                    {/* Toss result indicators */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider whitespace-nowrap border ${
                        regularIsWinner
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        Toss {regularIsWinner ? 'W' : 'L'}
                      </div>
                      {otToss && (
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider whitespace-nowrap border ${
                          otIsWinner
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          <span className="text-yellow-400">OT</span> {otIsWinner ? 'W' : 'L'}
                        </div>
                      )}
                    </div>

                    {/* Game score */}
                    {game ? (
                      <div className="flex-shrink-0 w-16 text-right">
                        <div className="text-sm font-bold leading-none" style={{ color: gameResultColor }}>
                          {gameResult === 'won' ? 'W' : gameResult === 'lost' ? 'L' : gameResult === 'tie' ? 'T' : '—'}
                        </div>
                        {myScore != null && (
                          <div className="text-[10px] text-gray-600 tabular-nums mt-0.5">{myScore}–{theirScore}</div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-16 text-right text-[10px] text-gray-700">—</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Pagination Controls */}
        {showPagination && (
          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                currentPage === 1
                  ? 'bg-[#0a0e1a] text-gray-600 cursor-not-allowed'
                  : 'bg-[#1a1f3a] text-white hover:bg-[#0f172a]'
              }`}
            >
              ←
            </button>

            <span className="text-gray-300">
              Showing {startIndex + 1}-{Math.min(endIndex, totalGamesCount)} of {totalGamesCount}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                currentPage === totalPages
                  ? 'bg-[#0a0e1a] text-gray-600 cursor-not-allowed'
                  : 'bg-[#1a1f3a] text-white hover:bg-[#0f172a]'
              }`}
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

TeamDetailView.displayName = 'TeamDetailView';

export default TeamDetailView;
