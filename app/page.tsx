'use client';

import Link from 'next/link';
import { useData } from '@/contexts/DataContext';
import { useMemo } from 'react';
import { Toss, Team } from '@/lib/types';

// Ensures a team hex color is legible against dark backgrounds
// Converts to HSL and enforces minimum lightness, preserving team hue/identity
function toReadable(hex: string): string {
  if (!hex || hex.length < 7) return '#60a5fa';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rN) h = (gN - bN) / d + (gN < bN ? 6 : 0);
    else if (max === gN) h = (bN - rN) / d + 2;
    else h = (rN - gN) / d + 4;
    h /= 6;
  }
  const finalL = Math.max(l, 0.55);
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(finalL * 100)}%)`;
}

const sections = [
  {
    href: '/analytics',
    label: 'Team Analytics',
    sub: 'Win rates, streak history, and defer trends for every team',
  },
  {
    href: '/records',
    label: 'Records & Streaks',
    sub: 'All-time records, longest streaks, and H2H dominance',
  },
  {
    href: '/matchup',
    label: 'Matchup Explorer',
    sub: 'Head-to-head coin toss history between any two teams',
  },
];

export default function LandingPage() {
  const { tosses, games, teams, loading } = useData();

  const stats = useMemo(() => {
    if (tosses.length === 0 || games.length === 0) return null;

    const gameMap = new Map(games.map(g => [String(g.game_id), g]));
    const seasons = [...new Set(tosses.map(t => t.season))].sort((a, b) => b - a);
    const latestSeason = seasons[0];
    const oldestSeason = seasons[seasons.length - 1];

    // 1. Toss winner → game winner (regular season, decisive games, opening toss only)
    const rsRegular = tosses.filter(t => t.toss_type === 'Regular' && t.game_type === 'Regular Season');
    const scoredGames = rsRegular.filter(t => {
      const g = gameMap.get(String(t.game_id));
      return g && g.home_score != null && g.away_score != null && g.home_score !== g.away_score;
    });
    const tossWonGame = scoredGames.filter(t => {
      const g = gameMap.get(String(t.game_id))!;
      const winner = (g.home_score ?? 0) > (g.away_score ?? 0) ? g.home_team : g.away_team;
      return t.winner === winner;
    });
    const gameWinRate = scoredGames.length > 0
      ? (Math.round((tossWonGame.length / scoredGames.length) * 1000) / 10).toFixed(1)
      : '50.0';

    // 2. Defer rate: latest season vs. oldest season in the dataset
    const getDeferRate = (season: number) => {
      const st = tosses.filter(t => t.season === season && t.toss_type === 'Regular' && t.winner_choice);
      if (st.length === 0) return 0;
      return Math.round((st.filter(t => t.winner_choice === 'Defer').length / st.length) * 100);
    };
    const latestDeferRate = getDeferRate(latestSeason);
    const oldestDeferRate = getDeferRate(oldestSeason);

    // 3. Active win + loss streaks — use ALL tosses (Regular + OT), matching Records page behavior.
    //    Sort chronologically with Regular before OT for the same game.
    const allSorted = [...tosses].sort((a, b) => {
      if (a.game_date && b.game_date) {
        const d = new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
        if (d !== 0) return d;
      }
      if (a.season !== b.season) return a.season - b.season;
      if (a.week !== b.week) return a.week - b.week;
      const sameGame =
        a.game_date === b.game_date &&
        ((a.winner === b.winner && a.loser === b.loser) ||
          (a.winner === b.loser && a.loser === b.winner));
      if (sameGame) {
        if (a.toss_type === 'Regular' && b.toss_type === 'Overtime') return -1;
        if (a.toss_type === 'Overtime' && b.toss_type === 'Regular') return 1;
      }
      return 0;
    });

    const teamTossMap: Record<string, Toss[]> = {};
    allSorted.forEach(toss => {
      [toss.winner, toss.loser].forEach(team => {
        if (!team || team === 'Unknown') return;
        if (!teamTossMap[team]) teamTossMap[team] = [];
        teamTossMap[team].push(toss);
      });
    });

    const defunctSet = new Set(teams.filter(t => t.defunct).map(t => t.abbreviation));
    const activeTeamSet = new Set(teams.map(t => t.abbreviation));

    let bestWinStreak = 0; let bestWinTeams: string[] = [];
    let bestLossStreak = 0; let bestLossTeams: string[] = [];

    Object.keys(teamTossMap).forEach(team => {
      if (defunctSet.has(team) || !activeTeamSet.has(team)) return;
      const recentFirst = [...teamTossMap[team]].reverse();
      let winStreak = 0, loseStreak = 0;

      for (const toss of recentFirst) {
        if (toss.winner === team) {
          winStreak++;
          if (loseStreak > 0) break;
        } else {
          loseStreak++;
          if (winStreak > 0) break;
        }
      }

      if (winStreak > bestWinStreak) { bestWinStreak = winStreak; bestWinTeams = [team]; }
      else if (winStreak === bestWinStreak && winStreak > 0) { bestWinTeams.push(team); }
      if (loseStreak > bestLossStreak) { bestLossStreak = loseStreak; bestLossTeams = [team]; }
      else if (loseStreak === bestLossStreak && loseStreak > 0) { bestLossTeams.push(team); }
    });

    return {
      gameWinRate,
      totalScoredGames: scoredGames.length,
      latestSeason,
      oldestSeason,
      latestDeferRate,
      oldestDeferRate,
      activeWinStreak: bestWinStreak,
      winStreakTeams: bestWinTeams,
      activeLossStreak: bestLossStreak,
      lossStreakTeams: bestLossTeams,
    };
  }, [tosses, games, teams]);

  const teamMap = useMemo(() => new Map(teams.map(t => [t.abbreviation, t])), [teams]);
  const winTeamData = stats?.winStreakTeams?.[0] ? teamMap.get(stats.winStreakTeams[0]) : undefined;
  const lossTeamData = stats?.lossStreakTeams?.[0] ? teamMap.get(stats.lossStreakTeams[0]) : undefined;
  const winTeamColor = winTeamData?.primary_color ? toReadable(winTeamData.primary_color) : '#22c55e';
  const lossTeamColor = lossTeamData?.primary_color ? toReadable(lossTeamData.primary_color) : '#ef4444';

  return (
    <div className="min-h-screen bg-[#0a0e27] flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center pt-12 pb-10 px-6 text-center">

        <div style={{ perspective: '1000px' }} className="mb-7">
          <svg className="coin-spin w-20 h-20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="landingCoinGrad" cx="35%" cy="30%" r="65%">
                <stop offset="0%" stopColor="#fde68a"/>
                <stop offset="60%" stopColor="#f59e0b"/>
                <stop offset="100%" stopColor="#b45309"/>
              </radialGradient>
            </defs>
            <circle cx="24" cy="24" r="23" fill="url(#landingCoinGrad)" stroke="#b45309" strokeWidth="1.5"/>
            <circle cx="24" cy="24" r="19" fill="none" stroke="#fcd34d" strokeWidth="0.75" strokeDasharray="3 2" opacity="0.6"/>
            <ellipse cx="24" cy="24" rx="10" ry="14" fill="#92400e" stroke="#b45309" strokeWidth="1"/>
            <line x1="24" y1="13" x2="24" y2="35" stroke="#fcd34d" strokeWidth="1.2"/>
            <line x1="20" y1="19" x2="28" y2="19" stroke="#fcd34d" strokeWidth="1"/>
            <line x1="19" y1="23" x2="29" y2="23" stroke="#fcd34d" strokeWidth="1"/>
            <line x1="20" y1="27" x2="28" y2="27" stroke="#fcd34d" strokeWidth="1"/>
          </svg>
        </div>

        <h1
          className="headline-text leading-none mb-3"
          style={{ fontSize: 'clamp(2.8rem, 9vw, 5rem)', fontFamily: "var(--font-barlow), sans-serif", letterSpacing: '0.02em' }}
        >
          <span style={{
            background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 40%, #3b82f6 70%, #1d4ed8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>NFLTossStats</span>
          <span style={{ color: '#475569' }}>.com</span>
        </h1>

        <div className="flex items-center gap-2">
          <span className="stat-badge inline-flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full uppercase"
            style={{ fontFamily: "var(--font-barlow), sans-serif" }}>
            🏈 Every Toss
          </span>
          <span className="stat-badge inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full uppercase"
            style={{ fontFamily: "var(--font-barlow), sans-serif" }}>
            📊 Every Season
          </span>
          <span className="stat-badge inline-flex items-center gap-1 bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full uppercase"
            style={{ fontFamily: "var(--font-barlow), sans-serif" }}>
            🏆 32 Teams
          </span>
        </div>
      </div>

      {/* ── Key Findings ─────────────────────────────────────────────── */}
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Stat 1 — Toss-to-game correlation */}
          <StatCard
            loading={loading || !stats}
            category="Does winning the toss help?"
            value={stats ? `${stats.gameWinRate}%` : null}
            label="of toss winners won the game"
            context={
              stats
                ? `Measured across ${stats.totalScoredGames.toLocaleString()} regular season games since ${stats.oldestSeason}. The coin is fair — and so, it turns out, is the game.`
                : ''
            }
            accentColor="#3b82f6"
          />

          {/* Stat 2 — Defer rate shift */}
          <StatCard
            loading={loading || !stats}
            category="The strategy shift"
            value={stats ? `${stats.latestDeferRate}%` : null}
            label={`of winners deferred in ${stats?.latestSeason ?? '—'}`}
            context={
              stats
                ? `In ${stats.oldestSeason}, just ${stats.oldestDeferRate}% chose to defer. The entire league reversed course over 15 years.`
                : ''
            }
            accentColor="#3b82f6"
          />

          {/* Stat 3 — Active win + loss streaks */}
          <StreakCard
            loading={loading || !stats}
            winStreak={stats?.activeWinStreak ?? null}
            winTeams={stats?.winStreakTeams ?? []}
            winTeamColor={winTeamColor}
            lossStreak={stats?.activeLossStreak ?? null}
            lossTeams={stats?.lossStreakTeams ?? []}
            lossTeamColor={lossTeamColor}
            getTeamData={(abbr) => teamMap.get(abbr)}
          />

        </div>
      </div>

      {/* ── Section navigation ───────────────────────────────────────── */}
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 pb-16">
        <div className="border-t border-gray-800 pt-8 mb-2">
          <p className="text-[11px] text-gray-600 uppercase tracking-widest mb-4"
            style={{ fontFamily: "var(--font-barlow), sans-serif" }}>
            Explore the data
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {sections.map(({ href, label, sub }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center justify-between bg-[#1a1f3a] hover:bg-[#1e2444] border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 transition-colors"
            >
              <div>
                <div
                  className="font-bold text-white mb-0.5"
                  style={{ fontFamily: "var(--font-barlow), sans-serif", fontSize: '1.05rem', letterSpacing: '0.02em' }}
                >
                  {label}
                </div>
                <div className="text-xs text-gray-500">{sub}</div>
              </div>
              <span className="text-gray-600 group-hover:text-gray-300 transition-colors ml-5 flex-shrink-0">→</span>
            </Link>
          ))}
        </div>
      </div>

      <footer className="text-center py-5 text-gray-700 text-xs border-t border-gray-800/60 mt-auto">
        Play-by-play data via nflverse · regular season &amp; playoffs
      </footer>
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  loading: boolean;
  category: string;
  value: string | null;
  label: string;
  context: string;
  accentColor: string;
  logo?: string;
}

function StatCard({ loading, category, value, label, context, accentColor, logo }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-[#1a1f3a] rounded-xl border border-gray-800 p-6 animate-pulse"
        style={{ borderTopWidth: '3px', borderTopColor: '#374151' }}>
        <div className="h-2.5 w-28 bg-gray-700 rounded mb-5" />
        <div className="h-14 w-36 bg-gray-700 rounded mb-2" />
        <div className="h-3.5 w-44 bg-gray-700 rounded mb-5" />
        <div className="h-2.5 w-full bg-gray-800 rounded mb-1" />
        <div className="h-2.5 w-4/5 bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <div
      className="bg-[#1a1f3a] rounded-xl border border-gray-800 p-6 flex flex-col"
      style={{ borderTopWidth: '3px', borderTopColor: accentColor }}
    >
      <div
        className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-4"
        style={{ fontFamily: "var(--font-barlow), sans-serif" }}
      >
        {category}
      </div>

      {logo && (
        <img src={logo} alt="" className="w-10 h-10 object-contain mb-2" />
      )}

      <div
        className="font-bold leading-none mb-2"
        style={{
          fontSize: 'clamp(3rem, 6vw, 4.5rem)',
          fontFamily: "var(--font-bebas), var(--font-barlow), sans-serif",
          color: accentColor,
        }}
      >
        {value}
      </div>

      <div className="text-white text-sm font-medium mb-4">{label}</div>

      <div className="text-gray-500 text-xs leading-relaxed mt-auto">{context}</div>
    </div>
  );
}

// ── StreakCard ────────────────────────────────────────────────────────────────

interface StreakCardProps {
  loading: boolean;
  winStreak: number | null;
  winTeams: string[];
  winTeamColor: string;
  lossStreak: number | null;
  lossTeams: string[];
  lossTeamColor: string;
  getTeamData: (abbr: string) => Team | undefined;
}

function StreakCard({
  loading,
  winStreak, winTeams, winTeamColor,
  lossStreak, lossTeams, lossTeamColor,
  getTeamData,
}: StreakCardProps) {
  if (loading) {
    return (
      <div className="bg-[#1a1f3a] rounded-xl border border-gray-800 overflow-hidden animate-pulse"
        style={{ borderTopWidth: '3px', borderTopColor: '#374151' }}>
        <div className="p-6">
          <div className="h-2.5 w-32 bg-gray-700 rounded mb-4" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-700 rounded" />
            <div>
              <div className="h-10 w-14 bg-gray-700 rounded mb-1.5" />
              <div className="h-3 w-28 bg-gray-800 rounded" />
            </div>
          </div>
        </div>
        <div className="h-px bg-gray-800 mx-6" />
        <div className="p-6">
          <div className="h-2.5 w-32 bg-gray-700 rounded mb-4" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-700 rounded" />
            <div>
              <div className="h-10 w-14 bg-gray-700 rounded mb-1.5" />
              <div className="h-3 w-28 bg-gray-800 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-[#1a1f3a] rounded-xl border border-gray-800 overflow-hidden flex flex-col"
      style={{ borderTopWidth: '3px', borderTopColor: '#22c55e' }}
    >
      {/* Win streak — top half */}
      <div className="p-6 flex-1">
        <div
          className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-4"
          style={{ fontFamily: "var(--font-barlow), sans-serif" }}
        >
          Longest active win streak
        </div>
        <div className="flex items-center gap-3">
          {/* Logo(s) */}
          {winTeams.length === 1 && getTeamData(winTeams[0])?.logo_url ? (
            <Link href={`/team/${winTeams[0]}`} className="flex-shrink-0 hover:opacity-80 transition">
              <img src={getTeamData(winTeams[0])!.logo_url} alt={winTeams[0]} className="w-10 h-10 object-contain" />
            </Link>
          ) : winTeams.length > 1 ? (
            <div className="flex -space-x-3 flex-shrink-0">
              {winTeams.slice(0, 3).map(t => {
                const td = getTeamData(t);
                return td?.logo_url ? (
                  <Link key={t} href={`/team/${t}`} className="hover:opacity-80 transition">
                    <img src={td.logo_url} alt={t} className="w-10 h-10 object-contain ring-2 ring-[#1a1f3a]" />
                  </Link>
                ) : null;
              })}
            </div>
          ) : null}
          <div>
            <div
              className="font-bold leading-none mb-1"
              style={{
                fontSize: 'clamp(2.4rem, 5vw, 3.5rem)',
                fontFamily: "var(--font-bebas), var(--font-barlow), sans-serif",
                color: '#22c55e',
              }}
            >
              {winStreak}
            </div>
            <div className="text-xs font-medium" style={{ color: '#6b7280' }}>
              consecutive wins
              {winTeams.length === 1 && winTeams[0] && (
                <Link
                  href={`/team/${winTeams[0]}`}
                  className="ml-1.5 hover:opacity-80 transition font-semibold"
                  style={{ color: winTeamColor }}
                >
                  · {winTeams[0]}
                </Link>
              )}
              {winTeams.length > 1 && (
                <>
                  <span className="ml-1.5">{winTeams.join(' · ')}</span>
                  <span className="text-gray-600 ml-1">(tied)</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Diagonal divider — SVG line from green (left) to red (right) */}
      <div className="px-0 py-0 overflow-hidden" style={{ height: '14px' }}>
        <svg viewBox="0 0 200 14" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="streakDivGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#4b5563" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <line x1="0" y1="11" x2="200" y2="3" stroke="url(#streakDivGrad)" strokeWidth="1" />
        </svg>
      </div>

      {/* Loss streak — bottom half */}
      <div className="p-6 flex-1">
        <div
          className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase mb-4"
          style={{ fontFamily: "var(--font-barlow), sans-serif" }}
        >
          Longest active loss streak
        </div>
        <div className="flex items-center gap-3">
          {/* Logo(s) */}
          {lossTeams.length === 1 && getTeamData(lossTeams[0])?.logo_url ? (
            <Link href={`/team/${lossTeams[0]}`} className="flex-shrink-0 hover:opacity-80 transition">
              <img src={getTeamData(lossTeams[0])!.logo_url} alt={lossTeams[0]} className="w-10 h-10 object-contain" />
            </Link>
          ) : lossTeams.length > 1 ? (
            <div className="flex -space-x-3 flex-shrink-0">
              {lossTeams.slice(0, 3).map(t => {
                const td = getTeamData(t);
                return td?.logo_url ? (
                  <Link key={t} href={`/team/${t}`} className="hover:opacity-80 transition">
                    <img src={td.logo_url} alt={t} className="w-10 h-10 object-contain ring-2 ring-[#1a1f3a]" />
                  </Link>
                ) : null;
              })}
            </div>
          ) : null}
          <div>
            <div
              className="font-bold leading-none mb-1"
              style={{
                fontSize: 'clamp(2.4rem, 5vw, 3.5rem)',
                fontFamily: "var(--font-bebas), var(--font-barlow), sans-serif",
                color: '#ef4444',
              }}
            >
              {lossStreak}
            </div>
            <div className="text-xs font-medium" style={{ color: '#6b7280' }}>
              consecutive losses
              {lossTeams.length === 1 && lossTeams[0] && (
                <Link
                  href={`/team/${lossTeams[0]}`}
                  className="ml-1.5 hover:opacity-80 transition font-semibold"
                  style={{ color: lossTeamColor }}
                >
                  · {lossTeams[0]}
                </Link>
              )}
              {lossTeams.length > 1 && (
                <>
                  <span className="ml-1.5">{lossTeams.join(' · ')}</span>
                  <span className="text-gray-600 ml-1">(tied)</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
