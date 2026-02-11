"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ReferenceLine, Cell } from 'recharts';

// ============================================================================
// SUPABASE CONFIGURATION
// ============================================================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function CoinTossAnalytics() {
  // Data state
  const [tosses, setTosses] = useState([]);
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [seasonFilter, setSeasonFilter] = useState('last5'); // 'last5', 'last10', 'all', 'custom'
  const [customSeasonStart, setCustomSeasonStart] = useState(0);
  const [customSeasonEnd, setCustomSeasonEnd] = useState(0);
  const [selectedGameTypes, setSelectedGameTypes] = useState(['Regular Season', 'Postseason']);

  // View state
  const [currentView, setCurrentView] = useState('analytics'); // analytics, team-detail, matchup, records
  const [previousView, setPreviousView] = useState('analytics'); // Track where user came from
  const [selectedTeamDetail, setSelectedTeamDetail] = useState(null);
  const [compareTeams, setCompareTeams] = useState([]);

  // Sort state for tables
  const [sortBy, setSortBy] = useState('abbr');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch coin tosses
      const tossResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/coin_tosses?select=*&order=season.desc,week.desc`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          }
        }
      );

      if (!tossResponse.ok) {
        throw new Error(`Toss data fetch failed: ${tossResponse.statusText}`);
      }

      const tossData = await tossResponse.json();

      // Fetch games
      const gamesResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/games?select=*`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          }
        }
      );

      if (!gamesResponse.ok) {
        throw new Error(`Games data fetch failed: ${gamesResponse.statusText}`);
      }

      const gamesData = await gamesResponse.json();

      // Fetch teams
      const teamResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/teams?select=*&order=abbreviation`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          }
        }
      );

      if (!teamResponse.ok) {
        throw new Error(`Team data fetch failed: ${teamResponse.statusText}`);
      }

      const teamData = await teamResponse.json();

      setTosses(tossData || []);
      setGames(gamesData || []);
      setTeams(teamData || []);
      
      // Initialize custom range to available seasons
      if (tossData && tossData.length > 0) {
        const seasons = [...new Set(tossData.map(t => t.season))].sort((a, b) => b - a);
        if (seasons.length > 0) {
          setCustomSeasonStart(seasons[seasons.length - 1]); // oldest
          setCustomSeasonEnd(seasons[0]); // newest
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get game for a toss
  const getGameForToss = (toss) => {
    return games.find(g => String(g.game_id) === String(toss.game_id));
  };

  // Get team data
  const getTeamData = (abbr) => teams.find(t => t.abbreviation === abbr);

  // Available filter options
  const availableSeasons = useMemo(() => 
    [...new Set(tosses.map(t => t.season))].sort((a, b) => b - a),
    [tosses]
  );

  const availableGameTypes = useMemo(() => {
    const types = [...new Set(tosses.map(t => t.game_type))].filter(Boolean);
    // Sort: Preseason, Regular Season, Postseason
    return types.sort((a, b) => {
      const order = { 'Preseason': 1, 'Regular Season': 2, 'Postseason': 3 };
      return (order[a] || 99) - (order[b] || 99);
    });
  }, [tosses]);

  // Filtered tosses based on current filters
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
      // 'all' - include everything
      
      if (!includeBasedOnSeason) return false;

      // Game type filter
      if (selectedGameTypes.length > 0 && !selectedGameTypes.includes(t.game_type)) {
        return false;
      }

      return true;
    });
  }, [tosses, selectedTeams, seasonFilter, customSeasonStart, customSeasonEnd, selectedGameTypes, availableSeasons]);

  // Calculate team statistics
  const teamStats = useMemo(() => {
    return calculateTeamStats(filteredTosses, games, getGameForToss);
  }, [filteredTosses, games]);

  // Sort team stats
  const sortedTeamStats = useMemo(() => {
    const sorted = [...teamStats].sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      // Handle string comparison (for team abbreviations)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        if (sortDirection === 'asc') {
          return aVal.localeCompare(bVal);
        } else {
          return bVal.localeCompare(aVal);
        }
      }
      
      // Handle numeric comparison
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    return sorted;
  }, [teamStats, sortBy, sortDirection]);

  const handleSort = (column) => {
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
          <button 
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e27]">
      {/* Header */}
      <header className="bg-[#0f172a] border-b border-gray-800 sticky top-0 z-50 overflow-hidden">

        {/* Animated yard-line background */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&display=swap');

          @keyframes yardScroll {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes coinSpin {
            0%   { transform: rotateY(0deg); }
            40%  { transform: rotateY(720deg); }
            55%  { transform: rotateY(810deg); }
            65%  { transform: rotateY(780deg); }
            75%  { transform: rotateY(810deg); }
            85%  { transform: rotateY(795deg); }
            100% { transform: rotateY(810deg); }
          }
          @keyframes coinGlow {
            0%, 100% { filter: drop-shadow(0 0 6px rgba(250,204,21,0.5)); }
            50%       { filter: drop-shadow(0 0 18px rgba(250,204,21,0.9)); }
          }
          @keyframes headlinePulse {
            0%, 100% { text-shadow: 0 0 20px rgba(96,165,250,0.3); }
            50%       { text-shadow: 0 0 40px rgba(96,165,250,0.7), 0 0 80px rgba(96,165,250,0.3); }
          }
          @keyframes badgePop {
            0%   { opacity: 0; transform: scale(0.7) translateY(4px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes statFadeIn {
            0%   { opacity: 0; transform: translateY(6px); }
            100% { opacity: 1; transform: translateY(0); }
          }

          .headline-text {
            font-family: 'Bebas Neue', sans-serif;
            animation: headlinePulse 3s ease-in-out infinite;
          }
          .coin-spin {
            animation: coinSpin 3.5s cubic-bezier(0.23,1,0.32,1) infinite;
            animation-delay: 0.5s;
            transform-style: preserve-3d;
            animation: coinSpin 4s ease-in-out infinite, coinGlow 2s ease-in-out infinite;
          }
          .yard-scroll {
            animation: yardScroll 18s linear infinite;
          }
          .stat-badge {
            animation: badgePop 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
          }
          .stat-badge:nth-child(1) { animation-delay: 0.1s; }
          .stat-badge:nth-child(2) { animation-delay: 0.2s; }
          .stat-badge:nth-child(3) { animation-delay: 0.3s; }
        `}</style>

        {/* Scrolling yard lines — decorative layer */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.06]">
          <div className="yard-scroll flex h-full" style={{ width: '200%' }}>
            {[...Array(40)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-16 h-full border-r border-white" />
            ))}
          </div>
        </div>

        {/* Subtle green turf gradient strip at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-60" />

        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 md:py-4 relative">
          <div className="flex items-center justify-between mb-3 md:mb-4">

            {/* LEFT: Coin + Title block */}
            <div className="flex items-center gap-3 md:gap-4">

              {/* Animated coin — smaller on mobile */}
              <div style={{ perspective: '400px' }} className="flex-shrink-0">
                <svg
                  className="coin-spin w-9 h-9 md:w-12 md:h-12"
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="24" cy="24" r="23" fill="url(#coinGrad)" stroke="#b45309" strokeWidth="1.5"/>
                  <circle cx="24" cy="24" r="19" fill="none" stroke="#fcd34d" strokeWidth="0.75" strokeDasharray="3 2" opacity="0.6"/>
                  <ellipse cx="24" cy="24" rx="10" ry="14" fill="#92400e" stroke="#b45309" strokeWidth="1"/>
                  <line x1="24" y1="13" x2="24" y2="35" stroke="#fcd34d" strokeWidth="1.2"/>
                  <line x1="20" y1="19" x2="28" y2="19" stroke="#fcd34d" strokeWidth="1"/>
                  <line x1="19" y1="23" x2="29" y2="23" stroke="#fcd34d" strokeWidth="1"/>
                  <line x1="20" y1="27" x2="28" y2="27" stroke="#fcd34d" strokeWidth="1"/>
                  <defs>
                    <radialGradient id="coinGrad" cx="35%" cy="30%" r="65%">
                      <stop offset="0%" stopColor="#fde68a"/>
                      <stop offset="60%" stopColor="#f59e0b"/>
                      <stop offset="100%" stopColor="#b45309"/>
                    </radialGradient>
                  </defs>
                </svg>
              </div>

              {/* Title + tagline */}
              <div>
                <h1 className="headline-text leading-none tracking-wide" style={{ fontSize: 'clamp(1.5rem, 5vw, 2.4rem)' }}>
                  <span style={{
                    background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 40%, #3b82f6 70%, #1d4ed8 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>NFLTossStats</span>
                  <span style={{ color: '#94a3b8', fontSize: 'clamp(1.1rem, 3.5vw, 1.8rem)' }}>.com</span>
                </h1>

                {/* Tagline badges — hidden on small mobile, shown md+ */}
                <div className="hidden sm:flex items-center gap-2 mt-0.5">
                  <span className="stat-badge inline-flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    🏈 Every Toss
                  </span>
                  <span className="stat-badge inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    📊 Every Season
                  </span>
                  <span className="stat-badge hidden md:inline-flex items-center gap-1 bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full uppercase"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    🏆 32 Teams
                  </span>
                </div>
                {/* Minimal tagline on xs only */}
                <p className="sm:hidden text-[10px] text-gray-500 mt-0.5" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  The Ultimate NFL Coin Toss Database
                </p>
              </div>
            </div>

            {/* RIGHT: Nav buttons — icon-only on mobile, full label on md+ */}
            <div className="flex gap-1.5 md:gap-2">
              {[
                { view: 'analytics', label: 'Team Performance', icon: '📋' },
                { view: 'records',   label: 'Records & Streaks', icon: '🏆' },
                { view: 'matchup',   label: 'Matchup Explorer',  icon: '⚔️' },
              ].map(({ view, label, icon }) => (
                <button
                  key={view}
                  onClick={() => {
                    setCurrentView(view);
                    setSelectedTeams([]);
                    setSeasonFilter('last5');
                    setSelectedGameTypes(['Regular Season', 'Postseason']);
                  }}
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  title={label}
                  className={`rounded-lg font-semibold tracking-wide transition-all duration-200 flex items-center gap-1.5
                    px-2 py-2 md:px-4 md:py-2 text-base md:text-sm
                    ${currentView === view
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-105'
                      : 'bg-[#1a1f3a] text-gray-400 hover:text-white hover:bg-[#252d4a] border border-gray-700/50'
                    }`}
                >
                  <span>{icon}</span>
                  <span className="hidden md:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filters Bar - Only show on Analytics view */}
          {currentView === 'analytics' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Season Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">SEASON RANGE</label>
                <select
                  value={seasonFilter}
                  onChange={(e) => setSeasonFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1f3a] border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="last1">Last Season</option>
                  <option value="last5">Last 5 Seasons</option>
                  <option value="last10">Last 10 Seasons</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>
                
                {/* Custom Range Inputs */}
                {seasonFilter === 'custom' && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">From</label>
                      <select
                        value={customSeasonStart}
                        onChange={(e) => setCustomSeasonStart(parseInt(e.target.value))}
                        className="w-full px-2 py-1.5 bg-[#0f172a] border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-2 py-1.5 bg-[#0f172a] border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                        selectedGameTypes.includes(type)
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#1a1f3a] text-gray-400 hover:bg-[#252b4a]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Active Filters Display - Only show on Analytics view */}
          {currentView === 'analytics' && (seasonFilter !== 'last5' || selectedGameTypes.length > 0) && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">Active filters:</span>
              {seasonFilter === 'last10' && (
                <span className="px-2 py-1 bg-purple-900 text-purple-300 rounded text-xs">
                  Last 10 Seasons
                </span>
              )}
              {seasonFilter === 'all' && (
                <span className="px-2 py-1 bg-purple-900 text-purple-300 rounded text-xs">
                  All Time
                </span>
              )}
              {seasonFilter === 'custom' && (
                <span className="px-2 py-1 bg-purple-900 text-purple-300 rounded text-xs">
                  {customSeasonStart} - {customSeasonEnd}
                </span>
              )}
              {selectedGameTypes.map(type => (
                <span key={type} className="px-2 py-1 bg-green-900 text-green-300 rounded text-xs">
                  {type}
                  <button
                    onClick={() => setSelectedGameTypes(selectedGameTypes.filter(t => t !== type))}
                    className="ml-1 text-green-400 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                onClick={() => {
                  setSeasonFilter('last5');
                  setSelectedGameTypes([]);
                }}
                className="px-2 py-1 bg-red-900 text-red-300 rounded text-xs hover:bg-red-800"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-3 md:px-6 py-4 md:py-8">
        {currentView === 'analytics' && (
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
            onTeamClick={(team) => {
              setPreviousView('analytics');
              setSelectedTeamDetail(team);
              setCurrentView('team-detail');
            }}
          />
        )}

        {currentView === 'records' && (
          <RecordsView
            tosses={tosses}
            games={games}
            teams={teams}
            teamStats={teamStats}
            getTeamData={getTeamData}
            getGameForToss={getGameForToss}
            onTeamClick={(team) => {
              setPreviousView('records');
              setSelectedTeamDetail(team);
              setCurrentView('team-detail');
            }}
          />
        )}

        {currentView === 'matchup' && (
          <MatchupExplorer
            tosses={tosses}
            games={games}
            teams={teams}
            getTeamData={getTeamData}
            getGameForToss={getGameForToss}
            compareTeams={compareTeams}
            setCompareTeams={setCompareTeams}
            onTeamClick={(team) => {
              setPreviousView('matchup');
              setSelectedTeamDetail(team);
              setCurrentView('team-detail');
            }}
          />
        )}

        {currentView === 'team-detail' && selectedTeamDetail && (
          <TeamDetailView
            teamAbbr={selectedTeamDetail}
            tosses={tosses}
            games={games}
            teams={teams}
            getTeamData={getTeamData}
            getGameForToss={getGameForToss}
            onBack={() => setCurrentView(previousView)}
            onTeamClick={(team) => setSelectedTeamDetail(team)}
          />
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-[#0f172a] border-t border-gray-800 mt-8 md:mt-12">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 md:py-6">
          <p className="text-center text-xs md:text-sm text-gray-500">
            NFLTossStats.com is not affiliated with, endorsed by, or officially connected with the National Football League (NFL) or any of its teams. 
            All NFL team names, logos, and data are property of their respective owners.
          </p>
          <p className="text-center text-xs text-gray-600 mt-2">
            © {new Date().getFullYear()} NFLTossStats.com - All data sourced from publicly available NFL statistics.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// ANALYTICS VIEW - Main data exploration
// ============================================================================
function AnalyticsView({ teamStats, filteredTosses, games, teams, selectedTeams, setSelectedTeams, getTeamData, getGameForToss, sortBy, sortDirection, onSort, onTeamClick }) {
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [expandedOpponent, setExpandedOpponent] = useState(null); // Format: "TEAM-OPPONENT" e.g. "MIN-GB"
  const [clickedGame, setClickedGame] = useState(null); // For game detail modal
  const [tableView, setTableView] = useState('table'); // 'table' | 'streaks'
  
  // Opponent sorting state - separate for each expanded team
  const [opponentSortBy, setOpponentSortBy] = useState({});
  const [opponentSortDirection, setOpponentSortDirection] = useState({});
  
  // Calculate key metrics
  const tossesWithGames = filteredTosses.filter(t => {
    const game = getGameForToss(t);
    return game && game.home_score !== null && game.away_score !== null && t.toss_type === 'Regular';
  });

  const tossWinnerWonGame = tossesWithGames.filter(t => {
    const game = getGameForToss(t);
    const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
    return t.winner === gameWinner;
  }).length;

  const winCorrelation = tossesWithGames.length > 0 
    ? Math.round((tossWinnerWonGame / tossesWithGames.length) * 100)
    : 0;

  const deferCount = filteredTosses.filter(t => t.winner_choice === 'Defer').length;
  const deferRate = filteredTosses.length > 0 ? Math.round((deferCount / filteredTosses.length) * 100) : 0;

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <span className="text-gray-600">⇅</span>;
    return sortDirection === 'asc' ? <span className="text-blue-400">↑</span> : <span className="text-blue-400">↓</span>;
  };

  // Show all teams (no filtering logic needed since accordion shows opponents inline)
  const displayedTeamStats = teamStats;
  
  // Get individual games between team and opponent
  const getGamesVsOpponent = (teamAbbr, opponentAbbr) => {
    return filteredTosses
      .filter(t => 
        (t.winner === teamAbbr && t.loser === opponentAbbr) ||
        (t.winner === opponentAbbr && t.loser === teamAbbr)
      )
      .sort((a, b) => {
        // First sort by date (most recent first)
        if (a.game_date && b.game_date) {
          const dateCompare = new Date(b.game_date) - new Date(a.game_date);
          if (dateCompare !== 0) return dateCompare;
        } else if (b.season !== a.season) {
          return b.season - a.season;
        } else if (b.week !== a.week) {
          return b.week - a.week;
        }
        
        // Same date - check if same game (same teams)
        const sameGame = (
          a.game_date === b.game_date &&
          ((a.winner === b.winner && a.loser === b.loser) || 
           (a.winner === b.loser && a.loser === b.winner))
        );
        
        if (sameGame) {
          // OT happened AFTER Regular, so OT should appear ABOVE (first) in descending order
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
          <div className="text-xs md:text-sm text-gray-400 mb-1">Defer Rate</div>
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
          <table className="w-full">
            <thead className="bg-[#0f172a] border-b border-gray-800">
              <tr>
                <th className="px-3 md:px-4 py-3 text-left">
                  <button onClick={() => onSort('abbr')} className="flex items-center gap-1 md:gap-2 text-xs font-bold text-gray-400 uppercase hover:text-white transition">
                    Team <SortIcon column="abbr" />
                  </button>
                </th>
                <th className="px-2 md:px-4 py-3 text-center hidden sm:table-cell">
                  <button onClick={() => onSort('totalTosses')} className="flex items-center justify-center gap-1 md:gap-2 text-xs font-bold text-gray-400 uppercase hover:text-white transition w-full">
                    Tosses <SortIcon column="totalTosses" />
                  </button>
                </th>
                <th className="px-2 md:px-4 py-3 text-center hidden sm:table-cell">
                  <button onClick={() => onSort('tossWins')} className="flex items-center justify-center gap-1 md:gap-2 text-xs font-bold text-gray-400 uppercase hover:text-white transition w-full">
                    Wins <SortIcon column="tossWins" />
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
                    Streak <SortIcon column="currentStreak" />
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
                opponentStats = [...opponentStats].sort((a, b) => {
                  let aVal, bVal;
                  
                  switch (currentSortBy) {
                    case 'opponent':
                      aVal = a.abbr;
                      bVal = b.abbr;
                      break;
                    case 'matchups':
                      aVal = a.totalMatchups;
                      bVal = b.totalMatchups;
                      break;
                    case 'tossWins':
                      aVal = a.tossWins;
                      bVal = b.tossWins;
                      break;
                    case 'gameWins':
                      aVal = a.gameWins;
                      bVal = b.gameWins;
                      break;
                    case 'tossWinPct':
                      aVal = a.tossWinPct;
                      bVal = b.tossWinPct;
                      break;
                    case 'gameWinPct':
                      aVal = a.gameWinPct;
                      bVal = b.gameWinPct;
                      break;
                    case 'streak':
                      aVal = a.currentStreak;
                      bVal = b.currentStreak;
                      break;
                    default:
                      aVal = a.tossWinPct;
                      bVal = b.tossWinPct;
                  }
                  
                  if (typeof aVal === 'string') {
                    return currentSortDirection === 'asc' 
                      ? aVal.localeCompare(bVal)
                      : bVal.localeCompare(aVal);
                  }
                  
                  return currentSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                });
                
                // Handler for opponent column clicks
                const handleOpponentSort = (column) => {
                  const currentSort = opponentSortBy[team.abbr];
                  const currentDir = opponentSortDirection[team.abbr] || 'desc';
                  
                  if (currentSort === column) {
                    // Toggle direction
                    setOpponentSortDirection({
                      ...opponentSortDirection,
                      [team.abbr]: currentDir === 'asc' ? 'desc' : 'asc'
                    });
                  } else {
                    // New column, default to desc
                    setOpponentSortBy({
                      ...opponentSortBy,
                      [team.abbr]: column
                    });
                    setOpponentSortDirection({
                      ...opponentSortDirection,
                      [team.abbr]: 'desc'
                    });
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
                          className="text-gray-500 hover:text-blue-400 transition-colors px-2 py-1 rounded hover:bg-blue-900/20"
                          title={`Go to ${team.abbr} Team Page`}
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
                        <td colSpan="8" className="bg-[#0a0e1a] p-0">
                          <div className="p-6">
                            <h3 className="text-lg font-bold text-white mb-4">
                              Opponents Faced by {team.abbr}
                            </h3>
                            {opponentStats.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead className="bg-[#0f172a] border-b border-gray-700">
                                    <tr>
                                      <th 
                                        className="px-4 py-2 text-left text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpponentSort('opponent');
                                        }}
                                      >
                                        <div className="flex items-center gap-1">
                                          Opponent
                                          {currentSortBy === 'opponent' && (
                                            <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th 
                                        className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpponentSort('matchups');
                                        }}
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          Matchups
                                          {currentSortBy === 'matchups' && (
                                            <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th 
                                        className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpponentSort('tossWins');
                                        }}
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          Toss Wins vs {team.abbr}
                                          {currentSortBy === 'tossWins' && (
                                            <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th 
                                        className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpponentSort('gameWins');
                                        }}
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          Game Wins vs {team.abbr}
                                          {currentSortBy === 'gameWins' && (
                                            <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th 
                                        className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpponentSort('tossWinPct');
                                        }}
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          Toss Win %
                                          {currentSortBy === 'tossWinPct' && (
                                            <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th 
                                        className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpponentSort('gameWinPct');
                                        }}
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          Won Game After Toss Win %
                                          {currentSortBy === 'gameWinPct' && (
                                            <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>
                                          )}
                                        </div>
                                      </th>
                                      <th 
                                        className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase cursor-pointer hover:text-white transition"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpponentSort('streak');
                                        }}
                                      >
                                        <div className="flex items-center justify-center gap-1">
                                          Streak vs {team.abbr}
                                          {currentSortBy === 'streak' && (
                                            <span className="text-blue-400">{currentSortDirection === 'asc' ? '▲' : '▼'}</span>
                                          )}
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-800">
                                    {opponentStats.map((opp) => {
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
                                                <span className="text-gray-400 text-sm">
                                                  {isOppExpanded ? '▼' : '▶'}
                                                </span>
                                                {oppData && (
                                                  <img 
                                                    src={oppData.logo_url} 
                                                    alt={oppData.name}
                                                    className="w-6 h-6 object-contain"
                                                  />
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
                                                opp.currentStreak > 0 
                                                  ? 'bg-green-900 text-green-300' 
                                                  : 'bg-red-900 text-red-300'
                                              }`}>
                                                {opp.currentStreak > 0 ? `W${opp.currentStreak}` : `L${Math.abs(opp.currentStreak)}`}
                                              </span>
                                            </td>
                                          </tr>
                                          
                                          {/* Nested Accordion: Individual Games */}
                                          {isOppExpanded && (
                                            <tr>
                                              <td colSpan="7" className="bg-[#050810] p-0">
                                                <div className="p-4">
                                                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">
                                                    Individual Games: {team.abbr} vs {opp.abbr} ({oppGames.length} games)
                                                  </h4>
                                                  <div className="space-y-2">
                                                    {oppGames.map((toss, idx) => {
                                                      const game = getGameForToss(toss);
                                                      const teamWonToss = toss.winner === team.abbr;
                                                      const isOT = toss.toss_type === 'Overtime';
                                                      
                                                      // Determine game winner
                                                      let gameWinner = null;
                                                      let teamWonGame = null;
                                                      if (game && game.home_score != null && game.away_score != null) {
                                                        gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
                                                        teamWonGame = gameWinner === team.abbr;
                                                      }
                                                      
                                                      return (
                                                        <div 
                                                          key={idx}
                                                          className="flex items-center justify-between p-3 bg-[#1a1f3a] rounded-lg text-sm hover:bg-[#0f172a] transition cursor-pointer"
                                                          onClick={() => {
                                                            // Create cell data for modal
                                                            let gameResult = null;
                                                            if (game && game.home_score !== null) {
                                                              if (game.home_score === game.away_score) {
                                                                gameResult = 'tie';
                                                              } else {
                                                                gameResult = teamWonGame ? 'won' : 'lost';
                                                              }
                                                            }
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
                                                          <div className="flex items-center gap-4">
                                                            <div className={`w-2 h-12 rounded ${teamWonToss ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                            <div className="text-gray-400 w-32">
                                                              {toss.game_date && new Date(toss.game_date).toLocaleDateString()}
                                                              <div className="text-xs">{toss.season} Wk {toss.week}</div>
                                                              <div className="text-xs">
                                                                {toss.game_type}
                                                                {isOT && <span className="text-yellow-400 ml-1">(OT)</span>}
                                                              </div>
                                                            </div>
                                                            <div className="text-white">
                                                              <div className="mb-1">
                                                                <span className={`font-bold ${teamWonToss ? 'text-green-400' : 'text-gray-300'}`}>
                                                                  {toss.winner}
                                                                </span>
                                                                {' won toss vs '}
                                                                <span className={`${!teamWonToss ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
                                                                  {toss.loser}
                                                                </span>
                                                              </div>
                                                              {toss.winner_choice && (
                                                                <div className="text-xs text-gray-400">
                                                                  Chose to {toss.winner_choice}
                                                                </div>
                                                              )}
                                                            </div>
                                                          </div>
                                                          <div className="text-right">
                                                            {game ? (
                                                              <>
                                                                <div className="text-sm text-gray-300 mb-1">
                                                                  Final: {game.home_team} {game.home_score} - {game.away_score} {game.away_team}
                                                                </div>
                                                                <div className={`text-xs font-bold ${teamWonGame ? 'text-green-400' : 'text-red-400'}`}>
                                                                  {team.abbr} {teamWonGame ? 'WON' : 'LOST'} game
                                                                </div>
                                                              </>
                                                            ) : (
                                                              <div className="text-xs text-gray-500">Game data unavailable</div>
                                                            )}
                                                          </div>
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
            <div className="flex items-center justify-center gap-6 mb-5 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-gradient-to-l from-red-600 to-red-700"></div>
                <span>Longest Loss Streak</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-gradient-to-r from-green-600 to-green-700"></div>
                <span>Longest Win Streak</span>
              </div>
              <span className="text-gray-500">• Click a team logo to view their team page</span>
            </div>

            <div className="space-y-1">
              {(() => {
                // Calculate streaks for each team from filteredTosses
                const teamStreaks = {};
                
                teams.forEach(team => {
                  const teamTosses = filteredTosses.filter(t => 
                    t.winner === team.abbreviation || t.loser === team.abbreviation
                  );
                  
                  if (teamTosses.length === 0) return;
                  
                  const sorted = [...teamTosses].sort((a, b) => {
                    if (a.game_date && b.game_date) {
                      const dateCompare = new Date(a.game_date) - new Date(b.game_date);
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
                
                const sortedTeams = Object.values(teamStreaks).sort((a, b) => b.maxWin - a.maxWin);
                
                if (sortedTeams.length === 0) {
                  return <div className="text-gray-400 text-center py-4">No streak data available for selected filters</div>;
                }
                
                const globalMaxWin = Math.max(...sortedTeams.map(t => t.maxWin), 1);
                const globalMaxLoss = Math.max(...sortedTeams.map(t => t.maxLoss), 1);
                const globalMax = Math.max(globalMaxWin, globalMaxLoss);
                
                return sortedTeams.map(team => (
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
    </div>
  );
}

// Calculate opponent stats for a single team (used in accordion expansion)
function calculateOpponentStatsForTeam(tosses, teamAbbr, getGameForToss) {
  const opponentMap = {};
  
  // Sort ALL tosses chronologically, ensuring Regular comes before OT for same game
  const sortedTosses = [...tosses].filter(t => t.winner === teamAbbr || t.loser === teamAbbr)
    .sort((a, b) => {
      // First sort by date
      if (a.game_date && b.game_date) {
        const dateCompare = new Date(a.game_date) - new Date(b.game_date);
        if (dateCompare !== 0) return dateCompare;
      } else if (a.season !== b.season) {
        return a.season - b.season;
      } else if (a.week !== b.week) {
        return a.week - b.week;
      }
      
      // Same date - check if it's the same game (same teams on same date)
      const sameGame = (
        a.game_date === b.game_date &&
        ((a.winner === b.winner && a.loser === b.loser) || 
         (a.winner === b.loser && a.loser === b.winner))
      );
      
      if (sameGame) {
        // Regular toss comes BEFORE OT toss for the same game
        if (a.toss_type === 'Regular' && b.toss_type === 'Overtime') return -1;
        if (a.toss_type === 'Overtime' && b.toss_type === 'Regular') return 1;
      }
      
      return 0;
    });
  
  // Process each toss individually (both Regular and OT count)
  sortedTosses.forEach(toss => {
    const opponent = toss.winner === teamAbbr ? toss.loser : toss.winner;
    const teamWonToss = toss.winner === teamAbbr;
    
    if (!opponentMap[opponent]) {
      opponentMap[opponent] = {
        abbr: opponent,
        totalMatchups: 0,
        tossWins: 0,
        gameWins: 0,
        gamesWithData: 0,
        tossHistory: []
      };
    }
    
    opponentMap[opponent].totalMatchups++;
    
    // Store EACH toss result for streak calculation
    opponentMap[opponent].tossHistory.push({
      season: toss.season,
      week: toss.week,
      game_date: toss.game_date,
      toss_type: toss.toss_type,
      opponentWon: !teamWonToss
    });
    
    if (!teamWonToss) {
      opponentMap[opponent].tossWins++;
    }
    
    const game = getGameForToss(toss);
    if (game && game.home_score != null && game.away_score != null) {
      opponentMap[opponent].gamesWithData++;
      const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
      if (opponent === gameWinner) {
        opponentMap[opponent].gameWins++;
      }
    }
  });
  
  return Object.values(opponentMap)
    .map(opp => {
      // Calculate current streak from toss history (most recent tosses)
      let currentStreak = 0;
      if (opp.tossHistory.length > 0) {
        // Already sorted chronologically, just reverse for most recent first
        const recentFirst = [...opp.tossHistory].reverse();
        const mostRecentWin = recentFirst[0].opponentWon;
        
        // Count consecutive tosses with same result from most recent backwards
        for (const toss of recentFirst) {
          if (toss.opponentWon !== mostRecentWin) break;
          currentStreak += mostRecentWin ? 1 : -1;
        }
      }
      
      return {
        ...opp,
        tossWinPct: opp.totalMatchups > 0 ? Math.round((opp.tossWins / opp.totalMatchups) * 100) : 0,
        gameWinPct: opp.gamesWithData > 0 ? Math.round((opp.gameWins / opp.gamesWithData) * 100) : 0,
        currentStreak: currentStreak
      };
    })
    .sort((a, b) => b.totalMatchups - a.totalMatchups);
}

// Calculate opponent stats when filtering by specific teams
function calculateOpponentStats(filteredTosses, filteredTeams, getGameForToss) {
  const opponentMap = {};
  
  // Get set of filtered team abbreviations
  const filteredTeamAbbrs = new Set(filteredTeams.map(t => t.abbr));
  
  console.log('Filtered team abbrs:', Array.from(filteredTeamAbbrs));
  
  // Go through each toss and find opponents
  filteredTosses.forEach(toss => {
    let opponent = null;
    let opponentWonToss = false;
    let opponentWonGame = false;
    
    // Determine who the opponent is
    if (filteredTeamAbbrs.has(toss.winner) && !filteredTeamAbbrs.has(toss.loser)) {
      // Filtered team won toss, loser is opponent
      opponent = toss.loser;
      opponentWonToss = false;
    } else if (filteredTeamAbbrs.has(toss.loser) && !filteredTeamAbbrs.has(toss.winner)) {
      // Filtered team lost toss, winner is opponent
      opponent = toss.winner;
      opponentWonToss = true;
    } else {
      // Either both are filtered teams or neither is (shouldn't happen with proper filtering)
      return;
    }
    
    // Initialize opponent if first time seeing them
    if (!opponentMap[opponent]) {
      opponentMap[opponent] = {
        abbr: opponent,
        totalMatchups: 0,
        tossWins: 0,
        gameWins: 0,
        gamesWithData: 0,
        gameHistory: [] // Track game outcomes for streak calculation
      };
    }
    
    // Increment matchup count (only once per toss)
    opponentMap[opponent].totalMatchups++;
    
    // Track if opponent won the toss
    if (opponentWonToss) {
      opponentMap[opponent].tossWins++;
    }
    
    // Check game outcome
    const game = getGameForToss(toss);
    if (game && game.home_score != null && game.away_score != null) {
      opponentMap[opponent].gamesWithData++;
      const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
      const oppWon = opponent === gameWinner;
      
      if (oppWon) {
        opponentMap[opponent].gameWins++;
      }
      
      // Add to history for streak calculation
      opponentMap[opponent].gameHistory.push({
        season: toss.season,
        week: toss.week,
        won: oppWon
      });
    }
  });
  
  console.log('Opponent map:', opponentMap);
  
  const results = Object.values(opponentMap)
    .map(opp => {
      // Calculate streak from game history
      let streak = 0;
      if (opp.gameHistory.length > 0) {
        // Sort by season/week descending (most recent first)
        const sorted = opp.gameHistory.sort((a, b) => {
          if (b.season !== a.season) return b.season - a.season;
          return b.week - a.week;
        });
        
        const mostRecentWin = sorted[0].won;
        for (const game of sorted) {
          if (game.won !== mostRecentWin) break;
          streak += mostRecentWin ? 1 : -1;
        }
      }
      
      return {
        ...opp,
        tossWinPct: opp.totalMatchups > 0 ? Math.round((opp.tossWins / opp.totalMatchups) * 100) : 0,
        gameWinPct: opp.gamesWithData > 0 ? Math.round((opp.gameWins / opp.gamesWithData) * 100) : 0,
        currentStreak: streak
      };
    })
    .sort((a, b) => b.totalMatchups - a.totalMatchups);
  
  console.log('Opponent results:', results);
  
  return results;
}

// ============================================================================
// MATCHUP EXPLORER
// ============================================================================
function MatchupExplorer({ tosses, games, teams, getTeamData, getGameForToss, compareTeams, setCompareTeams, onTeamClick }) {
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
    const types = [...new Set(tosses.map(t => t.game_type))].filter(Boolean);
    const order = { 'Preseason': 1, 'Regular Season': 2, 'Postseason': 3 };
    return types.sort((a, b) => (order[a] || 99) - (order[b] || 99));
  }, [tosses]);
  
  // Initialize custom range
  useEffect(() => {
    if (availableSeasons.length > 0 && customSeasonStart === 0) {
      setCustomSeasonStart(availableSeasons[availableSeasons.length - 1]);
      setCustomSeasonEnd(availableSeasons[0]);
    }
  }, [availableSeasons, customSeasonStart]);
  
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
  
  return (
    <div className="space-y-6">
      <div className="bg-[#1a1f3a] p-6 rounded-xl border border-gray-800">
        <h2 className="text-2xl font-bold text-white mb-4">Matchup Explorer</h2>
        <p className="text-gray-400 mb-6">Select two teams to compare their head-to-head coin toss history</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Team 1</label>
            <select
              value={compareTeams[0] || ''}
              onChange={(e) => setCompareTeams([e.target.value, compareTeams[1]])}
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
              value={compareTeams[1] || ''}
              onChange={(e) => setCompareTeams([compareTeams[0], e.target.value])}
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
              <option value="all">All Time</option>
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

      {compareTeams[0] && compareTeams[1] && (
        <MatchupDetails
          team1={compareTeams[0]}
          team2={compareTeams[1]}
          tosses={filteredMatchupTosses}
          games={games}
          getTeamData={getTeamData}
          getGameForToss={getGameForToss}
          onTeamClick={onTeamClick}
        />
      )}
    </div>
  );
}

function MatchupDetails({ team1, team2, tosses, games, getTeamData, getGameForToss, onTeamClick }) {
  const [clickedGame, setClickedGame] = useState(null); // For game detail modal
  const [logMode, setLogMode] = useState('toss'); // 'toss' or 'game'
  
  const team1Data = getTeamData(team1);
  const team2Data = getTeamData(team2);

  const matchupGames = tosses.filter(t => 
    (t.winner === team1 && t.loser === team2) ||
    (t.winner === team2 && t.loser === team1)
  );

  // Sort games by date (most recent first, OT above Regular for same game)
  const sortedGames = [...matchupGames].sort((a, b) => {
    // Most recent first
    if (a.game_date && b.game_date) {
      const dateCompare = new Date(b.game_date) - new Date(a.game_date);
      if (dateCompare !== 0) return dateCompare;
    } else if (b.season !== a.season) {
      return b.season - a.season;
    } else if (b.week !== a.week) {
      return b.week - a.week;
    }
    
    // Same date - check if same game (same teams)
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
  });

  const team1TossWins = matchupGames.filter(t => t.winner === team1).length;
  const team2TossWins = matchupGames.filter(t => t.winner === team2).length;

  return (
    <div className="bg-[#1a1f3a] p-8 rounded-xl border border-gray-800">
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col items-center flex-1">
          {team1Data && (
            <button
              onClick={() => onTeamClick(team1)}
              className="cursor-pointer hover:opacity-80 transition"
            >
              <img src={team1Data.logo_url} alt={team1} className="w-24 h-24 object-contain mb-3" />
            </button>
          )}
          <button
            onClick={() => onTeamClick(team1)}
            className="hover:underline cursor-pointer transition"
          >
            <h3 
              className="text-2xl font-bold"
              style={{ color: team1Data?.primary_color || '#ffffff' }}
            >
              {team1}
            </h3>
          </button>
          <p className="text-gray-400">{team1Data?.name}</p>
        </div>
        
        <div className="text-4xl font-bold text-gray-600 px-8">VS</div>
        
        <div className="flex flex-col items-center flex-1">
          {team2Data && (
            <button
              onClick={() => onTeamClick(team2)}
              className="cursor-pointer hover:opacity-80 transition"
            >
              <img src={team2Data.logo_url} alt={team2} className="w-24 h-24 object-contain mb-3" />
            </button>
          )}
          <button
            onClick={() => onTeamClick(team2)}
            className="hover:underline cursor-pointer transition"
          >
            <h3 
              className="text-2xl font-bold"
              style={{ color: team2Data?.primary_color || '#ffffff' }}
            >
              {team2}
            </h3>
          </button>
          <p className="text-gray-400">{team2Data?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div 
          className="rounded-lg p-6 text-center"
          style={{ 
            backgroundColor: `${team1Data?.primary_color}22`,
            borderColor: `${team1Data?.primary_color}44`,
            borderWidth: '1px'
          }}
        >
          <div 
            className="text-4xl font-bold"
            style={{ color: team1Data?.primary_color }}
          >
            {team1TossWins}
          </div>
          <div className="text-sm text-gray-400 mt-2">{team1} Toss Wins</div>
        </div>
        <div className="bg-[#0f172a] rounded-lg p-6 text-center">
          <div className="text-4xl font-bold text-gray-400">{matchupGames.length}</div>
          <div className="text-sm text-gray-400 mt-2">Total Matchups</div>
        </div>
        <div 
          className="rounded-lg p-6 text-center"
          style={{ 
            backgroundColor: `${team2Data?.primary_color}22`,
            borderColor: `${team2Data?.primary_color}44`,
            borderWidth: '1px'
          }}
        >
          <div 
            className="text-4xl font-bold"
            style={{ color: team2Data?.primary_color }}
          >
            {team2TossWins}
          </div>
          <div className="text-sm text-gray-400 mt-2">{team2} Toss Wins</div>
        </div>
      </div>

      {/* Game List */}
      {sortedGames.length > 0 ? (
        <div className="mt-6">
          <h4 className="text-lg font-bold text-white mb-4">Game History</h4>
          <div className="space-y-2">
            {sortedGames.map((toss, idx) => {
              const game = getGameForToss(toss);
              const tossWinner = toss.winner;
              const tossLoser = toss.loser;
              const isOT = toss.toss_type === 'Overtime';
              
              let gameWinner = null;
              let team1WonGame = null;
              let team2WonGame = null;
              
              if (game && game.home_score != null && game.away_score != null) {
                gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
                team1WonGame = gameWinner === team1;
                team2WonGame = gameWinner === team2;
              }
              
              return (
                <div 
                  key={idx} 
                  className="bg-[#0f172a] p-4 rounded-lg border"
                  style={{
                    borderColor: tossWinner === team1 ? `${team1Data?.primary_color}44` : `${team2Data?.primary_color}44`
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-2 h-16 rounded"
                        style={{
                          backgroundColor: tossWinner === team1 ? team1Data?.primary_color : team2Data?.primary_color
                        }}
                      ></div>
                      <div className="text-sm text-gray-400 w-32">
                        {toss.game_date && new Date(toss.game_date).toLocaleDateString()}
                        <div className="text-xs">{toss.season} Wk {toss.week}</div>
                        <div className="text-xs">
                          {toss.game_type}
                          {isOT && <span className="text-yellow-400 ml-1">(OT)</span>}
                        </div>
                      </div>
                      <div className="text-white">
                        <div className="mb-1">
                          <span 
                            className="font-bold"
                            style={{ color: tossWinner === team1 ? team1Data?.primary_color : team2Data?.primary_color }}
                          >
                            {tossWinner}
                          </span>
                          {' won toss vs '}
                          <span className="text-gray-400">{tossLoser}</span>
                        </div>
                        {toss.winner_choice && (
                          <div className="text-xs text-gray-400">
                            Chose to {toss.winner_choice}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {game ? (
                        <>
                          <div className="text-sm text-gray-300 mb-1">
                            Final: {game.home_team} {game.home_score} - {game.away_score} {game.away_team}
                          </div>
                          {team1WonGame !== null && (
                            <div className="text-xs">
                              <span 
                                className="font-bold"
                                style={{ color: team1WonGame ? team1Data?.primary_color : team2Data?.primary_color }}
                              >
                                {team1WonGame ? team1 : team2} WON
                              </span>
                              {' game'}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-gray-500">Game data unavailable</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          No matchups found with current filters
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TEAM DETAIL VIEW
// ============================================================================
function TeamDetailView({ teamAbbr, tosses, games, teams, getTeamData, getGameForToss, onBack, onTeamClick }) {
  const [seasonFilter, setSeasonFilter] = useState('last5'); // last5, last10, all, custom
  const [customSeasonStart, setCustomSeasonStart] = useState(0);
  const [customSeasonEnd, setCustomSeasonEnd] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGameTypes, setSelectedGameTypes] = useState(['Regular Season', 'Postseason']); // Default to Regular + Postseason
  const [clickedCell, setClickedCell] = useState(null); // For modal popup
  const [ganttMode, setGanttMode] = useState('toss'); // 'toss' or 'game'
  const [logMode, setLogMode] = useState('toss'); // 'toss' or 'game' for log view
  const GAMES_PER_PAGE = 25;

  const teamData = getTeamData(teamAbbr);
  const teamTosses = tosses.filter(t => t.winner === teamAbbr || t.loser === teamAbbr);
  
  // Get available seasons and game types
  const availableSeasons = useMemo(() => 
    [...new Set(teamTosses.map(t => t.season))].sort((a, b) => b - a),
    [teamTosses]
  );
  
  const availableGameTypes = useMemo(() => {
    const types = [...new Set(teamTosses.map(t => t.game_type))].filter(Boolean);
    const order = { 'Preseason': 1, 'Regular Season': 2, 'Postseason': 3 };
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
    // Season filter
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
    // 'all' includes everything
    
    if (!includeBasedOnSeason) return false;
    
    // Game type filter
    if (selectedGameTypes.length > 0 && !selectedGameTypes.includes(toss.game_type)) {
      return false;
    }
    
    return true;
  });
  
  const tossWins = filteredTeamTosses.filter(t => t.winner === teamAbbr).length;
  const tossWinPct = filteredTeamTosses.length > 0 ? Math.round((tossWins / filteredTeamTosses.length) * 100) : 0;
  
  const winningTosses = filteredTeamTosses.filter(t => t.winner === teamAbbr);
  const defers = winningTosses.filter(t => t.winner_choice === 'Defer').length;
  const deferPct = tossWins > 0 ? Math.round((defers / tossWins) * 100) : 0;
  
  // Game win rate when winning toss
  const tossWinsWithGames = winningTosses.filter(t => {
    const game = getGameForToss(t);
    return game && game.home_score !== null && game.away_score !== null;
  });
  
  const gameWins = tossWinsWithGames.filter(t => {
    const game = getGameForToss(t);
    const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
    return teamAbbr === gameWinner;
  }).length;
  
  const gameWinPct = tossWinsWithGames.length > 0 
    ? Math.round((gameWins / tossWinsWithGames.length) * 100)
    : 0;
  
  // Calculate actual game records (W-L-T) for filtered tosses
  const teamGames = useMemo(() => {
    // Get unique games from filtered tosses
    const gameIds = new Set();
    const uniqueGames = [];
    
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
        // Tie
        ties++;
        if (isHome) homeTies++;
        if (isAway) awayTies++;
      } else if (game.home_score > game.away_score) {
        // Home team won
        if (isHome) {
          wins++;
          homeWins++;
        } else {
          losses++;
          awayLosses++;
        }
      } else {
        // Away team won
        if (isAway) {
          wins++;
          awayWins++;
        } else {
          losses++;
          homeLosses++;
        }
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
      // First sort by date
      if (a.game_date && b.game_date) {
        const dateCompare = new Date(a.game_date) - new Date(b.game_date);
        if (dateCompare !== 0) return dateCompare;
      } else if (a.season !== b.season) {
        return a.season - b.season;
      } else if (a.week !== b.week) {
        return a.week - b.week;
      }
      
      // Same date - check if same game
      const sameGame = (
        a.game_date === b.game_date &&
        ((a.winner === b.winner && a.loser === b.loser) || 
         (a.winner === b.loser && a.loser === b.winner))
      );
      
      if (sameGame) {
        // Regular before OT
        if (a.toss_type === 'Regular' && b.toss_type === 'Overtime') return -1;
        if (a.toss_type === 'Overtime' && b.toss_type === 'Regular') return 1;
      }
      
      return 0;
    });
  
  // Create deduplicated game list (one entry per game for Game Log view)
  const uniqueGames = [];
  const seenGames = new Set();
  
  sortedGames.forEach(toss => {
    const gameKey = `${toss.game_date}-${toss.season}-${toss.week}-${[toss.winner, toss.loser].sort().join('-')}`;
    if (!seenGames.has(gameKey)) {
      seenGames.add(gameKey);
      
      // Find OT toss for this game if it exists
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
  
  // Calculate current streak - count BOTH Regular and OT tosses
  let currentStreak = 0;
  if (sortedGames.length > 0) {
    // Reverse to get most recent first
    const recentFirst = [...sortedGames].reverse();
    const mostRecentIsWin = recentFirst[0].winner === teamAbbr;
    for (const toss of recentFirst) {
      const currentIsWin = toss.winner === teamAbbr;
      if (currentIsWin !== mostRecentIsWin) break;
      currentStreak += mostRecentIsWin ? 1 : -1;
    }
  }
  
  // Pagination logic - only paginate if more than 25 games
  const totalGames = sortedGames.length;
  const totalPages = Math.ceil(totalGames / GAMES_PER_PAGE);
  const showPagination = totalGames > GAMES_PER_PAGE;
  
  // Get games for current page (most recent first for display)
  const displayList = logMode === 'toss' ? sortedGames : uniqueGames;
  const displayGames = displayList.slice().reverse(); // Reverse for display (most recent first)
  const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
  const endIndex = startIndex + GAMES_PER_PAGE;
  const paginatedGames = displayGames.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [seasonFilter, customSeasonStart, customSeasonEnd, selectedGameTypes]);
  
  // Prepare Gantt timeline data
  const ganttData = useMemo(() => {
    // Group tosses by season and week
    const seasonData = {};
    
    // First pass: determine if we have any pre-2021 seasons
    const hasPre2021Seasons = filteredTeamTosses.some(t => t.season < 2021);
    
    filteredTeamTosses.forEach(toss => {
      if (!seasonData[toss.season]) {
        // Use 5 cells only if there are pre-2021 seasons in the view
        const preseasonCells = hasPre2021Seasons ? 5 : 4;
        
        seasonData[toss.season] = {
          preseason: Array(preseasonCells).fill(null),
          preseasonActualWeeks: toss.season >= 2021 ? 4 : 5, // Track actual weeks for this season
          regular: Array(18).fill(null),  // Weeks 1-18
          postseason: Array(4).fill(null) // Weeks 1-4
        };
      }
      
      let category, weekIndex;
      const gameType = (toss.game_type || '').trim().toLowerCase();
      const weekNum = parseInt(toss.week);
      const isOT = toss.toss_type === 'Overtime';
      
      // Determine category based on game_type
      if (gameType === 'preseason' || gameType.includes('pre')) {
        category = 'preseason';
        weekIndex = weekNum - 1; // Weeks 1-4 or 1-5 map to indices 0-4
      } else if (gameType === 'postseason' || gameType.includes('post')) {
        category = 'postseason';
        weekIndex = weekNum - 1; // Weeks 1-4 map to indices 0-3
      } else {
        // Regular season or anything else
        category = 'regular';
        weekIndex = weekNum - 1; // Weeks 1-18 map to indices 0-17
      }
      
      const weekArray = seasonData[toss.season][category];
      
      if (weekIndex >= 0 && weekIndex < weekArray.length) {
        const game = getGameForToss(toss);
        let gameResult = null;
        
        // Determine game result
        if (game && game.home_score !== null && game.away_score !== null) {
          if (game.home_score === game.away_score) {
            gameResult = 'tie';
          } else {
            const teamScore = game.home_team === teamAbbr ? game.home_score : game.away_score;
            const oppScore = game.home_team === teamAbbr ? game.away_score : game.home_score;
            gameResult = teamScore > oppScore ? 'won' : 'lost';
          }
        }
        
        // Check if there's already a toss for this week (for OT games)
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
          // Add OT toss to existing
          weekArray[weekIndex].tosses.push(toss);
          weekArray[weekIndex].hasOT = weekArray[weekIndex].hasOT || isOT;
          
          // Track OT result separately
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

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="px-4 py-2 bg-[#1a1f3a] text-white rounded-lg hover:bg-[#0f172a] transition"
      >
        ← Back
      </button>

      {/* Team Header */}
      <div 
        className="rounded-2xl p-12 border"
        style={{
          background: `linear-gradient(135deg, ${teamData.primary_color}22 0%, ${teamData.secondary_color}22 100%)`,
          borderColor: `${teamData.primary_color}44`
        }}
      >
        <div className="flex items-center gap-8">
          <img 
            src={teamData.logo_url} 
            alt={teamData.name}
            className="w-40 h-40 object-contain"
          />
          <div>
            <h1 className="text-5xl font-bold text-white mb-2">{teamData.name}</h1>
            <p className="text-2xl text-gray-300 mb-4">{teamData.city}, {teamData.state}</p>
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-black/30 rounded-lg">
                <div className="text-sm text-gray-400">Conference</div>
                <div className="text-lg font-bold text-white">{teamData.conference}</div>
              </div>
              <div className="px-4 py-2 bg-black/30 rounded-lg">
                <div className="text-sm text-gray-400">Division</div>
                <div className="text-lg font-bold text-white">{teamData.division}</div>
              </div>
              <div className="px-4 py-2 bg-black/30 rounded-lg">
                <div className="text-sm text-gray-400">Active Streak</div>
                <div className={`text-lg font-bold ${
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#1a1f3a] p-6 rounded-xl border border-gray-800">
          <div className="text-sm text-gray-400 mb-2">Total Tosses</div>
          <div className="text-4xl font-bold text-white">{filteredTeamTosses.length}</div>
        </div>
        <div className="bg-[#1a1f3a] p-6 rounded-xl border border-gray-800">
          <div className="text-sm text-gray-400 mb-2">Toss Win Rate</div>
          <div className="text-4xl font-bold text-blue-400">{tossWinPct}%</div>
        </div>
        <div className="bg-[#1a1f3a] p-6 rounded-xl border border-gray-800">
          <div className="text-sm text-gray-400 mb-2">Game Win % (After Toss Win)</div>
          <div className="text-4xl font-bold text-green-400">{gameWinPct}%</div>
        </div>
        <div className="bg-[#1a1f3a] p-6 rounded-xl border border-gray-800">
          <div className="text-sm text-gray-400 mb-2">Defer Rate</div>
          <div className="text-4xl font-bold text-purple-400">{deferPct}%</div>
        </div>
      </div>

      {/* Actual Game Records */}
      <div className="bg-[#1a1f3a] rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-bold text-white mb-4">Actual Game Record</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Overall Record */}
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-2">Overall</div>
            <div className="text-3xl font-bold text-white mb-1">
              {gameRecords.overall.wins}-{gameRecords.overall.losses}
              {gameRecords.overall.ties > 0 && `-${gameRecords.overall.ties}`}
            </div>
            <div className="text-lg text-gray-400">({gameRecords.overall.winPct.toFixed(3)})</div>
          </div>
          
          {/* Home Record */}
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-2">Home</div>
            <div className="text-3xl font-bold text-white mb-1">
              {gameRecords.home.wins}-{gameRecords.home.losses}
              {gameRecords.home.ties > 0 && `-${gameRecords.home.ties}`}
            </div>
            <div className="text-lg text-gray-400">({gameRecords.home.winPct.toFixed(3)})</div>
          </div>
          
          {/* Away Record */}
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-2">Away</div>
            <div className="text-3xl font-bold text-white mb-1">
              {gameRecords.away.wins}-{gameRecords.away.losses}
              {gameRecords.away.ties > 0 && `-${gameRecords.away.ties}`}
            </div>
            <div className="text-lg text-gray-400">({gameRecords.away.winPct.toFixed(3)})</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1f3a] rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-bold text-white mb-4">Filters</h3>
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
              <option value="all">All Time</option>
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
      <div className="bg-[#1a1f3a] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-white">Performance Timeline</h3>
          <div className="flex gap-2 bg-[#0f172a] rounded-lg p-1">
            <button
              onClick={() => setGanttMode('toss')}
              className={`px-4 py-2 rounded-md font-medium transition ${
                ganttMode === 'toss' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Coin Toss Results
            </button>
            <button
              onClick={() => setGanttMode('game')}
              className={`px-4 py-2 rounded-md font-medium transition ${
                ganttMode === 'game' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
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
        
        <div className="overflow-x-auto py-32" style={{ overflowY: 'visible' }}>
          <div className="min-w-[1200px]" style={{ position: 'relative' }}>
            {Object.keys(ganttData).sort((a, b) => b - a).map((season, seasonIdx) => {
              const data = ganttData[season];
              
              return (
                <div key={season} className="mb-4 relative" style={{ zIndex: 50 - seasonIdx, position: 'relative' }}>
                  {/* Season Label */}
                  <div className="flex items-center mb-2">
                    <div className="w-16 text-sm font-bold text-white text-right pr-4">{season}</div>
                    <div className="flex-1 flex gap-1" style={{ position: 'relative', zIndex: 'inherit' }}>
                      {/* Preseason */}
                      {selectedGameTypes.includes('Preseason') && (
                        <div className="flex gap-0.5">
                          {data.preseason.map((cell, idx) => {
                            // Determine fill color based on mode
                            let fillColor = 'bg-gray-800'; // No game
                            
                            if (ganttMode === 'toss') {
                              // Toss mode - color based on regular toss result
                              if (cell && cell.regularTossWon !== null) {
                                fillColor = cell.regularTossWon ? 'bg-green-500' : 'bg-red-500';
                              }
                            } else {
                              // Game mode - color based on game result
                              if (cell && cell.gameResult) {
                                fillColor = cell.gameResult === 'won' ? 'bg-green-500' : 
                                           cell.gameResult === 'lost' ? 'bg-red-500' :
                                           'bg-yellow-500'; // tie
                              }
                            }
                            
                            return (
                              <div
                                key={`pre-${idx}`}
                                className={`relative w-6 h-8 rounded-md ${fillColor} ${cell ? 'hover:opacity-80 hover:ring-2 hover:ring-blue-400 cursor-pointer' : ''} transition overflow-hidden`}
                                onClick={() => cell && setClickedCell({ ...cell, title: cell.roundName || `Pre Week ${idx + 1}`, season })}
                              >
                                {/* OT Triangle in top-right corner */}
                                {ganttMode === 'toss' && cell && cell.hasOT && cell.otTossWon !== null && (
                                  <div 
                                    className="absolute top-0 right-0 w-0 h-0"
                                    style={{
                                      borderTop: cell.otTossWon 
                                        ? (cell.regularTossWon ? '8px solid #166534' : '8px solid #22c55e')  // Darker green if both won, bright if different
                                        : (cell.regularTossWon ? '#ef4444' : '8px solid #7f1d1d'),  // Bright red if different, darker if both lost
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
                      
                      {/* Divider - only show if preseason is displayed */}
                      {selectedGameTypes.includes('Preseason') && <div className="w-1"></div>}
                      
                      {/* Regular Season */}
                      {selectedGameTypes.includes('Regular Season') && (
                        <div className="flex gap-0.5">
                          {data.regular.map((cell, idx) => {
                            // Determine fill color based on mode
                            let fillColor = 'bg-gray-800'; // No game
                            
                            if (ganttMode === 'toss') {
                              // Toss mode - color based on regular toss result
                              if (cell && cell.regularTossWon !== null) {
                                fillColor = cell.regularTossWon ? 'bg-green-500' : 'bg-red-500';
                              }
                            } else {
                              // Game mode - color based on game result
                              if (cell && cell.gameResult) {
                                fillColor = cell.gameResult === 'won' ? 'bg-green-500' : 
                                           cell.gameResult === 'lost' ? 'bg-red-500' :
                                           'bg-yellow-500'; // tie
                              }
                            }
                          
                          return (
                            <div
                              key={`reg-${idx}`}
                              className={`relative w-6 h-8 rounded-md ${fillColor} ${cell ? 'hover:opacity-80 hover:ring-2 hover:ring-blue-400 cursor-pointer' : ''} transition overflow-hidden`}
                              onClick={() => cell && setClickedCell({ ...cell, title: `Week ${idx + 1}`, season })}
                            >
                              {/* OT Triangle in top-right corner */}
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
                      
                      {/* Divider - only show if regular season is displayed AND postseason will be shown */}
                      {selectedGameTypes.includes('Regular Season') && selectedGameTypes.includes('Postseason') && <div className="w-1"></div>}
                      
                      {/* Postseason */}
                      {selectedGameTypes.includes('Postseason') && (
                        <div className="flex gap-0.5">
                          {data.postseason.map((cell, idx) => {
                            // Determine fill color based on mode
                            let fillColor = 'bg-gray-800'; // No game
                            
                            if (ganttMode === 'toss') {
                              // Toss mode - color based on regular toss result
                              if (cell && cell.regularTossWon !== null) {
                                fillColor = cell.regularTossWon ? 'bg-green-500' : 'bg-red-500';
                              }
                            } else {
                              // Game mode - color based on game result
                              if (cell && cell.gameResult) {
                                fillColor = cell.gameResult === 'won' ? 'bg-green-500' : 
                                           cell.gameResult === 'lost' ? 'bg-red-500' :
                                           'bg-yellow-500'; // tie
                              }
                            }
                          
                          return (
                            <div
                              key={`post-${idx}`}
                              className={`relative w-6 h-8 rounded-md ${fillColor} ${cell ? 'hover:opacity-80 hover:ring-2 hover:ring-blue-400 cursor-pointer' : ''} transition overflow-hidden`}
                              onClick={() => cell && setClickedCell({ ...cell, title: cell.roundName || `Playoff Week ${cell.week}`, season })}
                            >
                              {/* OT Triangle in top-right corner */}
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
                {/* Pre labels */}
                {selectedGameTypes.includes('Preseason') && (
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(w => (
                      <div key={`pre-label-${w}`} className="w-6 text-[8px] text-gray-500 text-center">P{w}</div>
                    ))}
                  </div>
                )}
                {selectedGameTypes.includes('Preseason') && <div className="w-1"></div>}
                
                {/* Regular labels */}
                {selectedGameTypes.includes('Regular Season') && (
                  <div className="flex gap-0.5">
                    {Array.from({length: 18}, (_, i) => i + 1).map(w => (
                      <div key={`reg-label-${w}`} className="w-6 text-[8px] text-gray-500 text-center">{w}</div>
                    ))}
                  </div>
                )}
                {selectedGameTypes.includes('Regular Season') && selectedGameTypes.includes('Postseason') && <div className="w-1"></div>}
                
                {/* Post labels */}
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
              className={`px-4 py-2 rounded-md font-medium transition ${
                logMode === 'toss' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Coin Toss Log
            </button>
            <button
              onClick={() => setLogMode('game')}
              className={`px-4 py-2 rounded-md font-medium transition ${
                logMode === 'game' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
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
          <div className="space-y-2">
            {logMode === 'toss' ? (
              // COIN TOSS LOG - Show all tosses (Regular and OT separately)
              paginatedGames.map((toss, idx) => {
                const isWinner = toss.winner === teamAbbr;
                const opponent = isWinner ? toss.loser : toss.winner;
                const opponentData = getTeamData(opponent);
                const game = getGameForToss(toss);
                
                // Determine game result (won/lost/tie)
                let gameResult = null;
                if (game && game.home_score !== null && game.away_score !== null) {
                  if (game.home_score === game.away_score) {
                    gameResult = 'tie';
                  } else {
                    const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
                    gameResult = teamAbbr === gameWinner ? 'won' : 'lost';
                  }
                }
                
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      // Open modal with game details
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
                    className="w-full flex items-center justify-between p-4 bg-[#0f172a] rounded-lg hover:bg-[#1a1f3a] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-12 rounded ${isWinner ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div className="text-sm text-gray-400 w-32 text-left">
                        {toss.game_date && new Date(toss.game_date).toLocaleDateString()}
                        <div className="text-xs">{toss.season} Wk {toss.week}</div>
                        <div className="text-xs">{toss.game_type}{toss.toss_type === 'Overtime' ? ' (OT)' : ''}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-semibold">vs</span>
                        {opponentData && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent modal from opening
                              onTeamClick(opponent);
                            }}
                            className="hover:opacity-75 transition"
                          >
                            <img 
                              src={opponentData.logo_url} 
                              alt={opponent}
                              className="w-8 h-8 object-contain"
                            />
                          </button>
                        )}
                        <span className="text-white font-bold">{opponent}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-sm mb-1 ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
                        Toss: {isWinner ? 'WON' : 'LOST'}
                      </div>
                      {game && (
                        <div className={`font-bold text-sm ${
                          gameResult === 'tie' ? 'text-yellow-400' :
                          gameResult === 'won' ? 'text-green-400' : 
                          'text-red-400'
                        }`}>
                          Game: {gameResult === 'tie' ? 'TIED' : (gameResult === 'won' ? 'WON' : 'LOST')} ({game.home_team === teamAbbr ? game.home_score : game.away_score}-{game.home_team === teamAbbr ? game.away_score : game.home_score})
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              // GAME LOG - One entry per game with combined toss results
              paginatedGames.map((gameEntry, idx) => {
                const regularToss = gameEntry.regularToss;
                const otToss = gameEntry.otToss;
                const regularIsWinner = regularToss.winner === teamAbbr;
                const otIsWinner = otToss ? otToss.winner === teamAbbr : null;
                const opponent = regularIsWinner ? regularToss.loser : regularToss.winner;
                const opponentData = getTeamData(opponent);
                const game = getGameForToss(regularToss);
                
                // Determine game result
                let gameResult = null;
                if (game && game.home_score !== null && game.away_score !== null) {
                  if (game.home_score === game.away_score) {
                    gameResult = 'tie';
                  } else {
                    const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
                    gameResult = teamAbbr === gameWinner ? 'won' : 'lost';
                  }
                }
                
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      // Open modal with game details
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
                    className="w-full flex items-center justify-between p-4 bg-[#0f172a] rounded-lg hover:bg-[#1a1f3a] transition cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-12 rounded ${
                        gameResult === 'tie' ? 'bg-yellow-500' :
                        gameResult === 'won' ? 'bg-green-500' : 
                        gameResult === 'lost' ? 'bg-red-500' :
                        'bg-gray-500'
                      }`}></div>
                      <div className="text-sm text-gray-400 w-32 text-left">
                        {regularToss.game_date && new Date(regularToss.game_date).toLocaleDateString()}
                        <div className="text-xs">{regularToss.season} Wk {regularToss.week}</div>
                        <div className="text-xs">{regularToss.game_type}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-white font-semibold">vs</span>
                        {opponentData && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent modal from opening
                              onTeamClick(opponent);
                            }}
                            className="hover:opacity-75 transition"
                          >
                            <img 
                              src={opponentData.logo_url} 
                              alt={opponent}
                              className="w-8 h-8 object-contain"
                            />
                          </button>
                        )}
                        <span className="text-white font-bold">{opponent}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {game && (
                        <div className={`font-bold text-lg mb-1 ${
                          gameResult === 'tie' ? 'text-yellow-400' :
                          gameResult === 'won' ? 'text-green-400' : 
                          'text-red-400'
                        }`}>
                          {gameResult === 'tie' ? 'TIED' : (gameResult === 'won' ? 'WON' : 'LOST')} {game.home_team === teamAbbr ? game.home_score : game.away_score}-{game.home_team === teamAbbr ? game.away_score : game.home_score}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        <span className={regularIsWinner ? 'text-green-400' : 'text-red-400'}>
                          Toss: {regularIsWinner ? 'W' : 'L'}
                        </span>
                        {otToss && (
                          <span className={`ml-2 ${otIsWinner ? 'text-green-400' : 'text-red-400'}`}>
                            OT: {otIsWinner ? 'W' : 'L'}
                          </span>
                        )}
                      </div>
                    </div>
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
              Showing {startIndex + 1}-{Math.min(endIndex, totalGames)} of {totalGames}
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
}

// ============================================================================
// RECORDS & STREAKS VIEW
// ============================================================================
// Reusable Game Detail Modal Component
function GameDetailModal({ clickedCell, teamAbbr, getTeamData, onClose }) {
  if (!clickedCell) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10000] p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-[#1a1f3a] to-[#0f172a] rounded-2xl p-8 border-2 border-gray-700 max-w-2xl w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
          <div>
            {/* Date at top */}
            {(() => {
              // Try multiple sources for the date
              const dateStr = clickedCell.game?.game_date || 
                             clickedCell.game_date || 
                             clickedCell.tosses?.[0]?.game_date;
              
              if (dateStr) {
                return (
                  <div className="text-sm text-gray-400 mb-2">
                    {new Date(dateStr).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                );
              }
              return null;
            })()}
            <h3 className="text-2xl font-bold text-white">{clickedCell.season}</h3>
            <div className="text-lg text-blue-400">{clickedCell.title}</div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-3xl leading-none w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-700"
          >
            ×
          </button>
        </div>

        {/* Scoreboard */}
        {clickedCell.game && clickedCell.game.home_score !== null ? (
          <div className="mb-6">
            <div className="bg-[#0a0e1a] rounded-xl p-6 border border-gray-700">
              
              {/* Teams and Scores */}
              <div className="flex items-center justify-between gap-6">
                {/* Home Team */}
                <div className="flex-1 flex flex-col items-center">
                  {getTeamData(clickedCell.game.home_team)?.logo_url && (
                    <img 
                      src={getTeamData(clickedCell.game.home_team).logo_url}
                      alt={clickedCell.game.home_team}
                      className="w-20 h-20 object-contain mb-3"
                    />
                  )}
                  <div className="text-white font-bold text-lg">{clickedCell.game.home_team}</div>
                  <div className="text-xs text-gray-400">Home</div>
                  <div className={`text-4xl font-bold mt-2 ${
                    clickedCell.game.home_score > clickedCell.game.away_score ? 'text-green-400' :
                    clickedCell.game.home_score < clickedCell.game.away_score ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    {clickedCell.game.home_score}
                  </div>
                </div>

                {/* VS Separator */}
                <div className="flex flex-col items-center">
                  <div className="text-gray-500 text-sm font-bold">VS</div>
                  <div className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                    clickedCell.gameResult === 'tie' ? 'bg-yellow-900 text-yellow-400' :
                    clickedCell.gameResult === 'won' ? 'bg-green-900 text-green-400' :
                    'bg-red-900 text-red-400'
                  }`}>
                    {clickedCell.gameResult === 'tie' ? 'TIED' : 
                     (clickedCell.gameResult === 'won' ? 'WON' : 'LOST')}
                  </div>
                </div>

                {/* Away Team */}
                <div className="flex-1 flex flex-col items-center">
                  {getTeamData(clickedCell.game.away_team)?.logo_url && (
                    <img 
                      src={getTeamData(clickedCell.game.away_team).logo_url}
                      alt={clickedCell.game.away_team}
                      className="w-20 h-20 object-contain mb-3"
                    />
                  )}
                  <div className="text-white font-bold text-lg">{clickedCell.game.away_team}</div>
                  <div className="text-xs text-gray-400">Away</div>
                  <div className={`text-4xl font-bold mt-2 ${
                    clickedCell.game.away_score > clickedCell.game.home_score ? 'text-green-400' :
                    clickedCell.game.away_score < clickedCell.game.home_score ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    {clickedCell.game.away_score}
                  </div>
                </div>
              </div>

              {/* Venue Info */}
              {(clickedCell.game.venue || clickedCell.game.city || clickedCell.game.state) && (
                <div className="mt-6 pt-4 border-t border-gray-700 text-center">
                  <div className="text-xs text-gray-500 mb-1">VENUE</div>
                  {clickedCell.game.venue && (
                    <div className="text-white font-medium">{clickedCell.game.venue}</div>
                  )}
                  {(clickedCell.game.city || clickedCell.game.state) && (
                    <div className="text-gray-400 text-sm">
                      {clickedCell.game.city}{clickedCell.game.city && clickedCell.game.state ? ', ' : ''}{clickedCell.game.state}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-6 text-center text-gray-400">
            <div className="text-lg font-bold text-white mb-2">vs {clickedCell.opponent}</div>
            <div className="text-sm">Game data not available</div>
          </div>
        )}

        {/* Toss Results */}
        <div className="mb-6">
          <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Coin Toss Results</div>
          <div className="space-y-2">
            {clickedCell.regularTossWon !== null && (
              <div className="flex items-center justify-between bg-[#0a0e1a] rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  <span className="text-white font-medium">Regular Toss</span>
                </div>
                <span className={`font-bold text-lg ${
                  clickedCell.regularTossWon ? 'text-green-400' : 'text-red-400'
                }`}>
                  {clickedCell.regularTossWon ? 'WON' : 'LOST'}
                </span>
              </div>
            )}
            {clickedCell.hasOT && clickedCell.otTossWon !== null && (
              <div className="flex items-center justify-between bg-[#0a0e1a] rounded-lg p-4 border border-orange-600">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                  <span className="text-white font-medium">Overtime Toss</span>
                </div>
                <span className={`font-bold text-lg ${
                  clickedCell.otTossWon ? 'text-green-400' : 'text-red-400'
                }`}>
                  {clickedCell.otTossWon ? 'WON' : 'LOST'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-6 rounded-xl transition shadow-lg"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function RecordsView({ tosses, games, teams, teamStats, getTeamData, getGameForToss, onTeamClick }) {
  const [expandedRecord, setExpandedRecord] = useState(null);
  
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
    const types = [...new Set(tosses.map(t => t.game_type))].filter(Boolean);
    const order = { 'Preseason': 1, 'Regular Season': 2, 'Postseason': 3 };
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
    const deferReceiveTrend = {};
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
        deferPct: Math.round((deferReceiveTrend[season].defer / (deferReceiveTrend[season].defer + deferReceiveTrend[season].receive)) * 100),
        defer: deferReceiveTrend[season].defer,
        receive: deferReceiveTrend[season].receive
      }));
    
    // Toss Win → Game Win Correlation by Season
    const tossGameCorrelation = {};
    filteredTosses.forEach(toss => {
      if (toss.toss_type !== 'Regular') return; // Only regular season opening tosses
      
      const game = getGameForToss(toss);
      if (!game || game.home_score == null || game.away_score == null) return;
      
      if (!tossGameCorrelation[toss.season]) {
        tossGameCorrelation[toss.season] = { tossWinnerAlsoWonGame: 0, total: 0 };
      }
      
      tossGameCorrelation[toss.season].total++;
      const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
      if (toss.winner === gameWinner) {
        tossGameCorrelation[toss.season].tossWinnerAlsoWonGame++;
      }
    });
    
    const correlationData = Object.keys(tossGameCorrelation)
      .sort()
      .map(season => ({
        season: parseInt(season),
        correlation: Math.round((tossGameCorrelation[season].tossWinnerAlsoWonGame / tossGameCorrelation[season].total) * 100)
      }));
    
    // Team comparison data (Win vs Loss streaks)
    const teamTosses = {};
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
      let currentStreakStart = null;
      let currentStreakEnd = null;
      let currentIsWin = null;
      
      // Sort by date/season/week AND ensure Regular comes before OT
      const sorted = [...teamTosses[team]].sort((a, b) => {
        if (a.game_date && b.game_date) {
          const dateCompare = new Date(a.game_date) - new Date(b.game_date);
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
            currentStreakStart = toss.game_date ? new Date(toss.game_date).toLocaleDateString() : `${toss.season} Wk ${toss.week}`;
            currentStreakEnd = toss.game_date ? new Date(toss.game_date).toLocaleDateString() : `${toss.season} Wk ${toss.week}`;
          } else {
            // Continuing win streak
            currentStreak++;
            currentStreakEnd = toss.game_date ? new Date(toss.game_date).toLocaleDateString() : `${toss.season} Wk ${toss.week}`;
          }
          
          if (currentStreak > longestWin) {
            longestWin = currentStreak;
            longestWinDates = { start: currentStreakStart, end: currentStreakEnd };
          }
          
          currentIsWin = true;
        } else {
          // Loss
          if (currentIsWin !== false) {
            // Starting a NEW loss streak (was winning or first toss)
            currentStreak = 1;
            currentStreakStart = toss.game_date ? new Date(toss.game_date).toLocaleDateString() : `${toss.season} Wk ${toss.week}`;
            currentStreakEnd = toss.game_date ? new Date(toss.game_date).toLocaleDateString() : `${toss.season} Wk ${toss.week}`;
          } else {
            // Continuing loss streak
            currentStreak++;
            currentStreakEnd = toss.game_date ? new Date(toss.game_date).toLocaleDateString() : `${toss.season} Wk ${toss.week}`;
          }
          
          if (currentStreak > longestLoss) {
            longestLoss = currentStreak;
            longestLossDates = { start: currentStreakStart, end: currentStreakEnd };
          }
          
          currentIsWin = false;
        }
      });
      
      // Check final streak one more time
      if (currentIsWin === true && currentStreak > longestWin) {
        longestWin = currentStreak;
        longestWinDates = { start: currentStreakStart, end: currentStreakEnd };
      } else if (currentIsWin === false && currentStreak > longestLoss) {
        longestLoss = currentStreak;
        longestLossDates = { start: currentStreakStart, end: currentStreakEnd };
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
  
  const RecordCard = ({ title, value, team, teams, subtext, games, gamesByTeam, recordKey, breakdown, getGameForToss, getTeamData }) => {
    const teamList = teams || [team]; // Use teams array if provided, otherwise single team
    const teamData = teamList.map(t => getTeamData(t));
    const isExpanded = expandedRecord === recordKey;
    const [clickedGame, setClickedGame] = useState(null); // For game detail modal
    
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
              {subtext && <div className="text-sm text-gray-400 mt-1">{subtext}</div>}
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
            {games && games.length > 0 && (
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
                            {getTeamData(t)?.logo_url && (
                              <img 
                                src={getTeamData(t).logo_url}
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
                                return new Date(b.game_date) - new Date(a.game_date);
                              }
                              return b.season - a.season || b.week - a.week;
                            }).map((toss, idx) => {
                              const game = getGameForToss(toss);
                              const teamWonToss = toss.winner === t;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    // Create cell data for modal
                                    const opponent = teamWonToss ? toss.loser : toss.winner;
                                    let gameResult = null;
                                    if (game && game.home_score !== null) {
                                      if (game.home_score === game.away_score) {
                                        gameResult = 'tie';
                                      } else {
                                        const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
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
                                  className="w-full flex items-center gap-2 p-2 bg-[#1a1f3a] rounded-lg text-xs hover:bg-[#0f172a] transition"
                                >
                                  <div className={`w-1 h-8 rounded ${teamWonToss ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                  <div className="flex-1 text-left">
                                    <div className="text-gray-400 text-[10px]">
                                      {toss.game_date && new Date(toss.game_date).toLocaleDateString()}
                                    </div>
                                    <div className="text-white">{toss.season} Wk {toss.week}</div>
                                  </div>
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
                      Games ({games.length})
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {games.sort((a, b) => {
                        // Most recent first
                        if (a.game_date && b.game_date) {
                          const dateCompare = new Date(b.game_date) - new Date(a.game_date);
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
                        const game = getGameForToss(toss);
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
                                  const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
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
                            className="w-full flex items-center justify-between p-3 bg-[#1a1f3a] rounded-lg text-sm hover:bg-[#0f172a] transition cursor-pointer"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-2 h-10 rounded ${teamWonToss ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <div className="text-gray-400 w-28">
                                {toss.game_date && new Date(toss.game_date).toLocaleDateString()}
                                <div className="text-xs">{toss.season} Wk {toss.week}</div>
                                <div className="text-xs">
                                  {toss.game_type}
                                  {isOT && <span className="text-yellow-400 ml-1">(OT)</span>}
                                </div>
                              </div>
                              <div className="text-white">
                                <span className={`font-bold ${teamWonToss ? 'text-green-400' : 'text-red-400'}`}>{toss.winner}</span>
                                {' won toss vs '}
                                <span>{toss.loser}</span>
                              </div>
                            </div>
                        {game && (
                          <div className="text-gray-400 text-xs">
                            Final: {game.home_team} {game.home_score} - {game.away_score} {game.away_team}
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
            teamAbbr={team}
            getTeamData={getTeamData}
            onClose={() => setClickedGame(null)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center py-8">
        <h1 className="text-5xl font-bold text-white mb-4">Records & Streaks</h1>
        <p className="text-xl text-gray-400">The most impressive coin toss achievements in NFL history</p>
      </div>

      {/* Filters */}
      <div className="bg-[#1a1f3a] p-6 rounded-xl border border-gray-800">
        <h3 className="text-lg font-bold text-white mb-4">Filters</h3>
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
              <option value="all">All Time</option>
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
            subtext="Current streak"
            games={records.activeWinStreak.games}
            recordKey="active-win"
            getGameForToss={getGameForToss}
            getTeamData={getTeamData}
          />
          <RecordCard
            title="Longest Active Losing Streak"
            value={records.activeLoseStreak.streak}
            team={records.activeLoseStreak.team}
            subtext="Current streak"
            games={records.activeLoseStreak.games}
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
          
          {/* Toss Win → Game Win Correlation */}
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
        </div>

        {/* Team Performance Quadrant Visualization */}
        <div className="bg-[#1a1f3a] p-6 rounded-xl border border-gray-800">
          <h3 className="text-xl font-bold text-white mb-2">Team Performance Matrix</h3>
          <p className="text-sm text-gray-400 mb-6">Toss Success vs Game Success - See which teams are blessed, cursed, lucky, or doomed</p>
          
          <div className="w-full" style={{ height: '600px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 40, right: 40, bottom: 40, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  type="number" 
                  dataKey="tossWinPct" 
                  name="Toss Win %" 
                  domain={[30, 70]}
                  label={{ value: 'Toss Win %', position: 'bottom', fill: '#9ca3af', offset: 0 }}
                  stroke="#9ca3af"
                  tick={{ fill: '#9ca3af' }}
                />
                <YAxis 
                  type="number" 
                  dataKey="gameWinPct" 
                  name="Game Win %" 
                  domain={[0, 100]}
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
                            <div className="text-blue-400">Toss Win %: {data.tossWinPct}%</div>
                            <div className="text-green-400">Game Win % (After Toss Win): {data.gameWinPct}%</div>
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
                  shape={(props) => {
                    const { cx, cy, payload } = props;
                    const teamData = getTeamData(payload.abbr);
                    if (!teamData?.logo_url) return null;
                    
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
        </div>
      </div>
    </div>
  );
}

// Calculate all records
function calculateAllRecords(tosses, games, getGameForToss, teams) {
  // Sort ALL tosses chronologically, ensuring Regular comes before OT for same game
  const sortedTosses = [...tosses].sort((a, b) => {
    // First sort by date
    if (a.game_date && b.game_date) {
      const dateCompare = new Date(a.game_date) - new Date(b.game_date);
      if (dateCompare !== 0) return dateCompare;
    } else if (a.season !== b.season) {
      return a.season - b.season;
    } else if (a.week !== b.week) {
      return a.week - b.week;
    }
    
    // Same date - check if it's the same game (same teams on same date)
    const sameGame = (
      a.game_date === b.game_date &&
      ((a.winner === b.winner && a.loser === b.loser) || 
       (a.winner === b.loser && a.loser === b.winner))
    );
    
    if (sameGame) {
      // Regular toss comes BEFORE OT toss for the same game
      if (a.toss_type === 'Regular' && b.toss_type === 'Overtime') return -1;
      if (a.toss_type === 'Overtime' && b.toss_type === 'Regular') return 1;
    }
    
    return 0;
  });
  
  // Group tosses by team
  const teamTosses = {};
  sortedTosses.forEach(toss => {
    [toss.winner, toss.loser].forEach(team => {
      if (!teamTosses[team]) teamTosses[team] = [];
      teamTosses[team].push(toss);
    });
  });

  // Find longest winning streak
  let longestWin = { team: '', streak: 0, games: [], startDate: '', endDate: '' };
  Object.keys(teamTosses).forEach(team => {
    let maxStreak = 0;
    let maxStreakGames = [];
    let currentStreak = 0;
    let currentStreakGames = [];
    
    // Each toss counts separately, including both Regular and OT from same game
    teamTosses[team].forEach((toss) => {
      if (toss.winner === team) {
        currentStreak++;
        currentStreakGames.push(toss);
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          maxStreakGames = [...currentStreakGames];
        }
      } else {
        currentStreak = 0;
        currentStreakGames = [];
      }
    });
    
    if (maxStreak > longestWin.streak && maxStreakGames.length > 0) {
      longestWin = {
        team,
        teams: [team],
        streak: maxStreak,
        games: maxStreakGames,
        gamesByTeam: { [team]: maxStreakGames }, // Store games per team
        startDate: maxStreakGames[0]?.game_date ? new Date(maxStreakGames[0].game_date).toLocaleDateString() : 
                   `${maxStreakGames[0]?.season} Wk ${maxStreakGames[0]?.week}`,
        endDate: maxStreakGames[maxStreakGames.length - 1]?.game_date ? 
                 new Date(maxStreakGames[maxStreakGames.length - 1].game_date).toLocaleDateString() :
                 `${maxStreakGames[maxStreakGames.length - 1]?.season} Wk ${maxStreakGames[maxStreakGames.length - 1]?.week}`
      };
    } else if (maxStreak === longestWin.streak && maxStreak > 0 && maxStreakGames.length > 0) {
      // Tied for longest - add this team to the array
      if (!longestWin.teams) longestWin.teams = [longestWin.team];
      longestWin.teams.push(team);
      if (!longestWin.gamesByTeam) longestWin.gamesByTeam = { [longestWin.team]: longestWin.games };
      longestWin.gamesByTeam[team] = maxStreakGames;
    }
  });

  // Find longest losing streak
  let longestLose = { team: '', teams: [], streak: 0, games: [], startDate: '', endDate: '' };
  Object.keys(teamTosses).forEach(team => {
    let maxStreak = 0;
    let maxStreakGames = [];
    let currentStreak = 0;
    let currentStreakGames = [];
    
    // Each toss counts separately
    teamTosses[team].forEach(toss => {
      if (toss.loser === team) {
        currentStreak++;
        currentStreakGames.push(toss);
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          maxStreakGames = [...currentStreakGames];
        }
      } else {
        currentStreak = 0;
        currentStreakGames = [];
      }
    });
    
    if (maxStreak > longestLose.streak && maxStreakGames.length > 0) {
      longestLose = {
        team,
        teams: [team],
        streak: maxStreak,
        games: maxStreakGames,
        gamesByTeam: { [team]: maxStreakGames },
        startDate: maxStreakGames[0]?.game_date ? new Date(maxStreakGames[0].game_date).toLocaleDateString() :
                   `${maxStreakGames[0]?.season} Wk ${maxStreakGames[0]?.week}`,
        endDate: maxStreakGames[maxStreakGames.length - 1]?.game_date ? 
                 new Date(maxStreakGames[maxStreakGames.length - 1].game_date).toLocaleDateString() :
                 `${maxStreakGames[maxStreakGames.length - 1]?.season} Wk ${maxStreakGames[maxStreakGames.length - 1]?.week}`
      };
    } else if (maxStreak === longestLose.streak && maxStreak > 0 && maxStreakGames.length > 0) {
      // Tied for longest - add this team
      if (!longestLose.teams) longestLose.teams = [longestLose.team];
      longestLose.teams.push(team);
      if (!longestLose.gamesByTeam) longestLose.gamesByTeam = { [longestLose.team]: longestLose.games };
      longestLose.gamesByTeam[team] = maxStreakGames;
    }
  });

  // Find active streaks (most recent tosses, including OT)
  // Exclude defunct teams from active streak consideration
  let activeWin = { team: '', streak: 0, games: [] };
  let activeLose = { team: '', streak: 0, games: [] };
  
  Object.keys(teamTosses).forEach(team => {
    // Skip defunct teams
    const teamData = teams.find(t => t.abbreviation === team);
    if (teamData?.defunct) return;
    
    const recentTosses = [...teamTosses[team]].reverse(); // Most recent first
    let winStreak = 0;
    let loseStreak = 0;
    let winGames = [];
    let loseGames = [];
    
    for (const toss of recentTosses) {
      if (toss.winner === team) {
        winStreak++;
        winGames.push(toss);
        if (loseStreak > 0) break;
      } else if (toss.loser === team) {
        loseStreak++;
        loseGames.push(toss);
        if (winStreak > 0) break;
      }
    }
    
    if (winStreak > activeWin.streak) {
      activeWin = { team, streak: winStreak, games: winGames.reverse() };
    }
    if (loseStreak > activeLose.streak) {
      activeLose = { team, streak: loseStreak, games: loseGames.reverse() };
    }
  });

  // Best/worst toss win percentage (count ALL tosses)
  let bestPct = { team: '', percentage: 0, wins: 0, total: 0, byYear: [] };
  let worstPct = { team: '', percentage: 100, wins: 0, total: 0, byYear: [] };
  
  Object.keys(teamTosses).forEach(team => {
    const wins = teamTosses[team].filter(t => t.winner === team).length;
    const total = teamTosses[team].length;
    if (total >= 50) {
      const pct = Math.round((wins / total) * 100);
      
      // Calculate by year breakdown
      const yearBreakdown = {};
      teamTosses[team].forEach(t => {
        if (!yearBreakdown[t.season]) {
          yearBreakdown[t.season] = { wins: 0, total: 0 };
        }
        yearBreakdown[t.season].total++;
        if (t.winner === team) {
          yearBreakdown[t.season].wins++;
        }
      });
      
      const byYear = Object.keys(yearBreakdown)
        .sort((a, b) => b - a)
        .slice(0, 10)
        .map(year => ({
          label: `${year}: ${yearBreakdown[year].wins}-${yearBreakdown[year].total - yearBreakdown[year].wins}`,
          value: `${Math.round((yearBreakdown[year].wins / yearBreakdown[year].total) * 100)}%`
        }));
      
      if (pct > bestPct.percentage) {
        bestPct = { team, percentage: pct, wins, total, byYear };
      }
      if (pct < worstPct.percentage) {
        worstPct = { team, percentage: pct, wins, total, byYear };
      }
    }
  });

  // Best conversion rate (toss win → game win)
  let bestConv = { team: '', percentage: 0, tossWins: 0, gameWins: 0, byOpponent: [] };
  
  Object.keys(teamTosses).forEach(team => {
    const tossWins = teamTosses[team].filter(t => t.winner === team);
    const tossWinsWithGames = tossWins.filter(t => {
      const game = getGameForToss(t);
      return game && game.home_score != null && game.away_score != null;
    });
    
    const gameWins = tossWinsWithGames.filter(t => {
      const game = getGameForToss(t);
      const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
      return team === gameWinner;
    }).length;
    
    if (tossWinsWithGames.length >= 20) {
      const pct = Math.round((gameWins / tossWinsWithGames.length) * 100);
      
      // Calculate by opponent breakdown
      const oppBreakdown = {};
      tossWinsWithGames.forEach(t => {
        const opp = t.loser;
        if (!oppBreakdown[opp]) {
          oppBreakdown[opp] = { tossWins: 0, gameWins: 0 };
        }
        oppBreakdown[opp].tossWins++;
        
        const game = getGameForToss(t);
        const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
        if (team === gameWinner) {
          oppBreakdown[opp].gameWins++;
        }
      });
      
      const byOpponent = Object.keys(oppBreakdown)
        .filter(opp => oppBreakdown[opp].tossWins >= 3)
        .sort((a, b) => {
          const pctA = oppBreakdown[a].gameWins / oppBreakdown[a].tossWins;
          const pctB = oppBreakdown[b].gameWins / oppBreakdown[b].tossWins;
          return pctB - pctA;
        })
        .slice(0, 10)
        .map(opp => ({
          label: `vs ${opp}: ${oppBreakdown[opp].gameWins}/${oppBreakdown[opp].tossWins} games won`,
          value: `${Math.round((oppBreakdown[opp].gameWins / oppBreakdown[opp].tossWins) * 100)}%`
        }));
      
      if (pct > bestConv.percentage) {
        bestConv = { team, percentage: pct, tossWins: tossWinsWithGames.length, gameWins, byOpponent };
      }
    }
  });

  // Most consecutive defers
  let mostDefers = { team: '', streak: 0, games: [], startDate: '', endDate: '' };
  
  Object.keys(teamTosses).forEach(team => {
    const wins = teamTosses[team].filter(t => t.winner === team);
    let currentStreak = 0;
    let currentGames = [];
    let maxStreak = 0;
    let maxGames = [];
    
    wins.forEach(toss => {
      if (toss.winner_choice === 'Defer') {
        currentStreak++;
        currentGames.push(toss);
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          maxGames = [...currentGames];
        }
      } else {
        currentStreak = 0;
        currentGames = [];
      }
    });
    
    if (maxStreak > mostDefers.streak) {
      mostDefers = {
        team,
        streak: maxStreak,
        games: maxGames,
        startDate: maxGames[0]?.game_date ? new Date(maxGames[0].game_date).toLocaleDateString() : '',
        endDate: maxGames[maxGames.length - 1]?.game_date ? new Date(maxGames[maxGames.length - 1].game_date).toLocaleDateString() : ''
      };
    }
  });

  // Most lopsided rivalry
  let mostLopsided = { team: '', opponent: '', wins: 0, losses: 0, percentage: 0, games: [] };
  
  Object.keys(teamTosses).forEach(team => {
    const opponentMap = {};
    teamTosses[team].forEach(toss => {
      const opp = toss.winner === team ? toss.loser : toss.winner;
      if (!opponentMap[opp]) opponentMap[opp] = { wins: 0, losses: 0, games: [] };
      if (toss.winner === team) {
        opponentMap[opp].wins++;
      } else {
        opponentMap[opp].losses++;
      }
      opponentMap[opp].games.push(toss);
    });
    
    Object.keys(opponentMap).forEach(opp => {
      const { wins, losses, games } = opponentMap[opp];
      const total = wins + losses;
      if (total >= 5) {
        const pct = Math.round((wins / total) * 100);
        if (pct > mostLopsided.percentage) {
          mostLopsided = { team, opponent: opp, wins, losses, percentage: pct, games };
        }
      }
    });
  });

  // Longest H2H streak
  let longestH2H = { team: '', opponent: '', streak: 0, games: [] };
  
  Object.keys(teamTosses).forEach(team => {
    const opponentMap = {};
    teamTosses[team].forEach(toss => {
      const opp = toss.winner === team ? toss.loser : toss.winner;
      if (!opponentMap[opp]) opponentMap[opp] = [];
      opponentMap[opp].push(toss);
    });
    
    Object.keys(opponentMap).forEach(opp => {
      let currentStreak = 0;
      let currentGames = [];
      let maxStreak = 0;
      let maxGames = [];
      
      opponentMap[opp].forEach(toss => {
        if (toss.winner === team) {
          currentStreak++;
          currentGames.push(toss);
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
            maxGames = [...currentGames];
          }
        } else {
          currentStreak = 0;
          currentGames = [];
        }
      });
      
      if (maxStreak > longestH2H.streak) {
        longestH2H = { team, opponent: opp, streak: maxStreak, games: maxGames };
      }
    });
  });

  // Best/worst season records
  let bestSeason = { team: '', season: 0, wins: 0, losses: 0, percentage: 0, games: [] };
  let worstSeason = { team: '', season: 0, wins: 0, losses: 0, percentage: 100, games: [] };
  
  Object.keys(teamTosses).forEach(team => {
    const seasonMap = {};
    teamTosses[team].forEach(toss => {
      if (!seasonMap[toss.season]) seasonMap[toss.season] = { wins: 0, losses: 0, games: [] };
      if (toss.winner === team) {
        seasonMap[toss.season].wins++;
      } else {
        seasonMap[toss.season].losses++;
      }
      seasonMap[toss.season].games.push(toss);
    });
    
    Object.keys(seasonMap).forEach(season => {
      const { wins, losses, games } = seasonMap[season];
      const total = wins + losses;
      if (total >= 10) {
        const pct = Math.round((wins / total) * 100);
        if (pct > bestSeason.percentage) {
          bestSeason = { team, season: parseInt(season), wins, losses, percentage: pct, games };
        }
        if (pct < worstSeason.percentage) {
          worstSeason = { team, season: parseInt(season), wins, losses, percentage: pct, games };
        }
      }
    });
  });

  return {
    longestTossWinStreak: longestWin,
    longestTossLoseStreak: longestLose,
    activeWinStreak: activeWin,
    activeLoseStreak: activeLose,
    bestTossWinPct: bestPct,
    worstTossWinPct: worstPct,
    bestConversion: bestConv,
    mostConsecutiveDefers: mostDefers,
    mostLopsidedRivalry: mostLopsided,
    longestH2HStreak: longestH2H,
    bestSeasonRecord: bestSeason,
    worstSeasonRecord: worstSeason
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateTeamStats(tosses, games, getGameForToss) {
  const teamMap = {};

  tosses.forEach(toss => {
    [toss.winner, toss.loser].forEach(team => {
      if (!team || team === 'Unknown') return;
      if (!teamMap[team]) {
        teamMap[team] = {
          abbr: team,
          totalTosses: 0,
          tossWins: 0,
          defers: 0,
          receives: 0,
          history: [],
          gameWins: 0,
          gamesWithData: 0
        };
      }
      teamMap[team].totalTosses++;
      teamMap[team].history.push(toss);
      
      if (toss.winner === team) {
        teamMap[team].tossWins++;
        if (toss.winner_choice === 'Defer') teamMap[team].defers++;
        if (toss.winner_choice === 'Receive') teamMap[team].receives++;
        
        // Check game outcome
        const game = getGameForToss(toss);
        if (game && game.home_score != null && game.away_score != null && toss.toss_type === 'Regular') {
          teamMap[team].gamesWithData++;
          const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
          if (team === gameWinner) {
            teamMap[team].gameWins++;
          }
        }
      }
    });
  });

  return Object.values(teamMap).map(team => {
    const tossWinPct = team.totalTosses > 0 ? Math.round((team.tossWins / team.totalTosses) * 100) : 0;
    const gameWinPct = team.gamesWithData > 0 ? Math.round((team.gameWins / team.gamesWithData) * 100) : 0;
    const deferPct = team.tossWins > 0 ? Math.round((team.defers / team.tossWins) * 100) : 0;
    
    // Calculate streak - count BOTH Regular and OT tosses separately
    let streak = 0;
    
    // Sort all tosses chronologically, Regular before OT for same game
    const sortedHistory = [...team.history].sort((a, b) => {
      // First sort by date
      if (a.game_date && b.game_date) {
        const dateCompare = new Date(a.game_date) - new Date(b.game_date);
        if (dateCompare !== 0) return dateCompare;
      } else if (a.season !== b.season) {
        return a.season - b.season;
      } else if (a.week !== b.week) {
        return a.week - b.week;
      }
      
      // Same date - check if same game
      const sameGame = (
        a.game_date === b.game_date &&
        ((a.winner === b.winner && a.loser === b.loser) || 
         (a.winner === b.loser && a.loser === b.winner))
      );
      
      if (sameGame) {
        // Regular before OT
        if (a.toss_type === 'Regular' && b.toss_type === 'Overtime') return -1;
        if (a.toss_type === 'Overtime' && b.toss_type === 'Regular') return 1;
      }
      
      return 0;
    });
    
    // Reverse to get most recent first
    const recentFirst = sortedHistory.reverse();
    
    if (recentFirst.length > 0) {
      const mostRecentIsWin = recentFirst[0].winner === team.abbr;
      for (const toss of recentFirst) {
        const currentIsWin = toss.winner === team.abbr;
        if (currentIsWin !== mostRecentIsWin) break;
        streak += mostRecentIsWin ? 1 : -1;
      }
    }

    return {
      abbr: team.abbr,
      totalTosses: team.totalTosses,
      tossWins: team.tossWins,
      tossWinPct,
      gameWinPct,
      deferPct,
      currentStreak: streak
    };
  });
}