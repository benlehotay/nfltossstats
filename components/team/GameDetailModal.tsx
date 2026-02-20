'use client';

import { memo } from 'react';
import Link from 'next/link';
import { formatGameDate } from '@/lib/calculations';
import { Team } from '@/lib/types';

function toReadable(hex: string | undefined): string {
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

// suppress unused warning — kept for future use
void toReadable;

interface GameDetailModalProps {
  clickedCell: any;
  teamAbbr: string | null;
  getTeamData: (abbr: string) => Team | undefined;
  onClose: () => void;
}

const GameDetailModal = memo(function GameDetailModal({ clickedCell, teamAbbr, getTeamData, onClose }: GameDetailModalProps) {
  if (!clickedCell) return null;

  const game = clickedCell.game;

  // Derive toss winners
  const regularTossWinner: string | null =
    clickedCell.regularTossWon != null
      ? (clickedCell.regularTossWon ? teamAbbr : clickedCell.opponent) ?? null
      : (clickedCell.winner ?? null);

  const otTossWinner: string | null =
    clickedCell.hasOT && clickedCell.otTossWon != null
      ? (clickedCell.otTossWon ? teamAbbr : clickedCell.opponent) ?? null
      : null;

  // Derive winner choices
  const regularTossObj =
    clickedCell.tosses?.find((t: any) => t.toss_type === 'Regular') ??
    (clickedCell.toss_type === 'Regular' ? clickedCell : null);
  const otTossObj =
    clickedCell.tosses?.find((t: any) => t.toss_type === 'Overtime') ??
    (clickedCell.toss_type === 'Overtime' ? clickedCell : null);
  const regularTossChoice: string | null = regularTossObj?.winner_choice ?? null;
  const otTossChoice: string | null = otTossObj?.winner_choice ?? null;

  // Score info
  const homeTeam: string = game?.home_team ?? '';
  const awayTeam: string = game?.away_team ?? '';
  const homeScore: number | null = game?.home_score ?? null;
  const awayScore: number | null = game?.away_score ?? null;
  const margin =
    homeScore != null && awayScore != null ? Math.abs(homeScore - awayScore) : 0;

  let gameWinnerAbbr: string | null = null;
  if (homeScore != null && awayScore != null) {
    if (homeScore > awayScore) gameWinnerAbbr = homeTeam;
    else if (awayScore > homeScore) gameWinnerAbbr = awayTeam;
  }

  const homeTeamData = homeTeam ? getTeamData(homeTeam) : undefined;
  const awayTeamData = awayTeam ? getTeamData(awayTeam) : undefined;

  // Date / type
  const dateStr =
    game?.game_date || clickedCell.game_date || clickedCell.tosses?.[0]?.game_date;
  const gameType =
    clickedCell.game_type || clickedCell.tosses?.[0]?.game_type || '';
  const gameTypeLabel =
    gameType === 'Postseason'
      ? 'Playoff'
      : gameType === 'Preseason'
      ? 'Preseason'
      : 'Regular Season';

  // Insight line
  let insightLine: string | null = null;
  if (
    regularTossWinner &&
    homeScore != null &&
    awayScore != null &&
    homeScore !== awayScore
  ) {
    if (regularTossWinner === gameWinnerAbbr) {
      insightLine = `${regularTossWinner} won the toss and the game`;
    } else if (gameWinnerAbbr) {
      insightLine = `${regularTossWinner} won the toss, ${gameWinnerAbbr} won the game`;
    }
  }

  const showRegularToss =
    clickedCell.regularTossWon !== null && regularTossWinner;
  const showOTToss = clickedCell.hasOT && otTossWinner;

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-[10000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f172a] rounded-2xl border border-gray-700/50 max-w-md w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start justify-between">
          <div>
            <div
              className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-0.5"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {gameTypeLabel}
              {dateStr ? ` · ${formatGameDate(dateStr)}` : ''}
            </div>
            <div
              className="text-base font-bold text-white"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: '0.02em',
              }}
            >
              {clickedCell.season} Season · {clickedCell.title}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition ml-4 mt-0.5 flex-shrink-0"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 2L14 14M14 2L2 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Scoreboard */}
        <div className="mx-5 mb-4">
          {game && homeScore != null ? (
            <div className="bg-[#1a1f3a] rounded-xl px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                {/* Home Team */}
                <div className="flex-1 flex flex-col items-center text-center min-w-0">
                  <Link
                    href={`/team/${homeTeam}`}
                    className="hover:opacity-80 transition mb-2"
                  >
                    {homeTeamData?.logo_url ? (
                      <img
                        src={homeTeamData.logo_url}
                        alt={homeTeam}
                        className="w-14 h-14 object-contain"
                      />
                    ) : (
                      <div className="w-14 h-14" />
                    )}
                  </Link>
                  <div className="text-xs font-bold text-white">{homeTeam}</div>
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider">
                    Home
                  </div>
                  <div
                    className="font-bold leading-none mt-1.5"
                    style={{
                      fontSize: 'clamp(2.5rem, 8vw, 3.5rem)',
                      fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif",
                      color:
                        (homeScore ?? 0) > (awayScore ?? 0)
                          ? '#22c55e'
                          : (homeScore ?? 0) < (awayScore ?? 0)
                          ? '#ef4444'
                          : '#eab308',
                    }}
                  >
                    {homeScore}
                  </div>
                </div>

                {/* Center */}
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0 px-2">
                  <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                    FINAL
                  </div>
                  <div
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider border ${
                      clickedCell.gameResult === 'tie'
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        : clickedCell.gameResult === 'won'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : clickedCell.gameResult === 'lost'
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-gray-700/20 text-gray-600 border-gray-700/20'
                    }`}
                  >
                    {clickedCell.gameResult === 'tie'
                      ? 'TIE'
                      : clickedCell.gameResult === 'won'
                      ? 'WIN'
                      : clickedCell.gameResult === 'lost'
                      ? 'LOSS'
                      : '—'}
                  </div>
                  {margin > 0 && (
                    <div className="text-[10px] text-gray-600">
                      Won by {margin}
                    </div>
                  )}
                </div>

                {/* Away Team */}
                <div className="flex-1 flex flex-col items-center text-center min-w-0">
                  <Link
                    href={`/team/${awayTeam}`}
                    className="hover:opacity-80 transition mb-2"
                  >
                    {awayTeamData?.logo_url ? (
                      <img
                        src={awayTeamData.logo_url}
                        alt={awayTeam}
                        className="w-14 h-14 object-contain"
                      />
                    ) : (
                      <div className="w-14 h-14" />
                    )}
                  </Link>
                  <div className="text-xs font-bold text-white">{awayTeam}</div>
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider">
                    Away
                  </div>
                  <div
                    className="font-bold leading-none mt-1.5"
                    style={{
                      fontSize: 'clamp(2.5rem, 8vw, 3.5rem)',
                      fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif",
                      color:
                        (awayScore ?? 0) > (homeScore ?? 0)
                          ? '#22c55e'
                          : (awayScore ?? 0) < (homeScore ?? 0)
                          ? '#ef4444'
                          : '#eab308',
                    }}
                  >
                    {awayScore}
                  </div>
                </div>
              </div>

              {/* Venue */}
              {(game.venue || game.city || game.state) && (
                <div className="mt-3 pt-3 border-t border-gray-700/40 text-center text-[11px] text-gray-600">
                  {[
                    game.venue,
                    [game.city, game.state].filter(Boolean).join(', '),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#1a1f3a] rounded-xl px-4 py-6 text-center">
              <div className="text-base font-bold text-white mb-1">
                vs {clickedCell.opponent}
              </div>
              <div className="text-xs text-gray-500">Game data not available</div>
            </div>
          )}
        </div>

        {/* Coin Toss Section */}
        <div className="mx-5 mb-5">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
            Coin Toss
          </div>
          <div className="space-y-1.5">
            {/* Opening / Regular Toss */}
            {showRegularToss &&
              (() => {
                const tossTeamData = getTeamData(regularTossWinner!);
                return (
                  <div className="flex items-center gap-2.5 bg-[#1a1f3a] rounded-lg px-3 py-2.5">
                    <Link
                      href={`/team/${regularTossWinner}`}
                      className="flex-shrink-0 hover:opacity-80 transition"
                    >
                      {tossTeamData?.logo_url ? (
                        <img
                          src={tossTeamData.logo_url}
                          alt={regularTossWinner!}
                          className="w-7 h-7 object-contain"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-700" />
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {regularTossWinner} · Opening Toss
                      </div>
                      {regularTossChoice && (
                        <div className="text-[10px] text-gray-500">
                          Chose {regularTossChoice}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] font-bold px-2 py-0.5 rounded tracking-wider border bg-green-500/10 text-green-400 border-green-500/20 flex-shrink-0">
                      WON
                    </div>
                  </div>
                );
              })()}

            {/* OT Toss */}
            {showOTToss &&
              (() => {
                const otTeamData = getTeamData(otTossWinner!);
                return (
                  <div className="flex items-center gap-2.5 bg-[#1a1f3a] rounded-lg px-3 py-2.5 border border-yellow-500/15">
                    <Link
                      href={`/team/${otTossWinner}`}
                      className="flex-shrink-0 hover:opacity-80 transition"
                    >
                      {otTeamData?.logo_url ? (
                        <img
                          src={otTeamData.logo_url}
                          alt={otTossWinner!}
                          className="w-7 h-7 object-contain"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gray-700" />
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {otTossWinner} ·{' '}
                        <span className="text-yellow-400">OT Toss</span>
                      </div>
                      {otTossChoice && (
                        <div className="text-[10px] text-gray-500">
                          Chose {otTossChoice}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] font-bold px-2 py-0.5 rounded tracking-wider border bg-yellow-500/10 text-yellow-400 border-yellow-500/20 flex-shrink-0">
                      WON
                    </div>
                  </div>
                );
              })()}

            {/* Insight */}
            {insightLine && (
              <div className="text-[11px] text-gray-500 text-center pt-1">
                {insightLine}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

GameDetailModal.displayName = 'GameDetailModal';

export default GameDetailModal;
