'use client';

import { useState, memo } from 'react';
import { formatGameDate } from '@/lib/calculations';
import { Toss, Game, Team } from '@/lib/types';

interface MatchupDetailsProps {
  team1: string;
  team2: string;
  tosses: Toss[];
  games: Game[];
  getTeamData: (abbr: string) => Team | undefined;
  getGameForToss: (toss: Toss) => Game | undefined;
  onTeamClick: (abbr: string) => void;
}

// Ensures a team hex color is legible against the dark (#0f172a / #1a1f3a) background.
// Converts to HSL and enforces minimum lightness, preserving team hue identity.
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

const MatchupDetails = memo(function MatchupDetails({
  team1, team2, tosses, games, getTeamData, getGameForToss, onTeamClick
}: MatchupDetailsProps) {
  const [clickedGame, setClickedGame] = useState<any>(null);
  const [logMode, setLogMode] = useState<'toss' | 'game'>('toss');

  const team1Data = getTeamData(team1);
  const team2Data = getTeamData(team2);

  // Readable versions of each team's color — safe for text/bars on dark bg
  const c1 = toReadable(team1Data?.primary_color);
  const c2 = toReadable(team2Data?.primary_color);

  const matchupGames = tosses.filter(t =>
    (t.winner === team1 && t.loser === team2) ||
    (t.winner === team2 && t.loser === team1)
  );

  // Sort games by date (most recent first, OT above Regular for same game)
  const sortedGames = [...matchupGames].sort((a, b) => {
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
          <button onClick={() => onTeamClick(team1)} className="hover:underline cursor-pointer transition">
            <h3 className="text-2xl font-bold" style={{ color: c1 }}>
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
          <button onClick={() => onTeamClick(team2)} className="hover:underline cursor-pointer transition">
            <h3 className="text-2xl font-bold" style={{ color: c2 }}>
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
            backgroundColor: `${team1Data?.primary_color}18`,
            borderColor: `${c1}55`,
            borderWidth: '1px'
          }}
        >
          <div className="text-4xl font-bold" style={{ color: c1 }}>
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
            backgroundColor: `${team2Data?.primary_color}18`,
            borderColor: `${c2}55`,
            borderWidth: '1px'
          }}
        >
          <div className="text-4xl font-bold" style={{ color: c2 }}>
            {team2TossWins}
          </div>
          <div className="text-sm text-gray-400 mt-2">{team2} Toss Wins</div>
        </div>
      </div>

      {/* Game List */}
      {sortedGames.length > 0 ? (
        <div className="mt-6">
          <h4 className="text-lg font-bold text-white mb-4">Game History</h4>
          <div className="space-y-1.5">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-4 pb-2 mb-1 border-b border-gray-800/50">
              <div className="text-[9px] font-bold tracking-widest text-gray-600 uppercase w-24 flex-shrink-0">Date</div>
              <div className="hidden sm:block text-[9px] font-bold tracking-widest text-gray-600 uppercase w-12 flex-shrink-0">Type</div>
              <div className="text-[9px] font-bold tracking-widest text-gray-600 uppercase flex-1">Toss</div>
              <div className="text-[9px] font-bold tracking-widest text-gray-600 uppercase flex-shrink-0 w-16 text-right">Result</div>
            </div>
            {sortedGames.map((toss, idx) => {
              const game = getGameForToss(toss);
              const tossWinner = toss.winner;
              const tossLoser = toss.loser;
              const isOT = toss.toss_type === 'Overtime';
              const winnerColor = tossWinner === team1 ? c1 : c2;

              let gameWinner = null;
              let team1WonGame = null;

              if (game && game.home_score != null && game.away_score != null) {
                gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
                team1WonGame = gameWinner === team1;
              }

              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#111827] transition cursor-pointer"
                  style={{ borderLeft: `3px solid ${winnerColor}`, backgroundColor: '#0f172a' }}
                >
                  {/* Date + week */}
                  <div className="w-24 flex-shrink-0">
                    <div className="text-[11px] font-semibold text-gray-300 tabular-nums leading-tight">
                      {toss.game_date && formatGameDate(toss.game_date)}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-0.5 leading-tight">
                      {toss.season} · Wk {toss.week}
                      {isOT && <span className="text-yellow-400 ml-1">OT</span>}
                    </div>
                  </div>

                  {/* Game type */}
                  <div className="hidden sm:block w-12 flex-shrink-0">
                    <span className="text-[9px] font-bold tracking-widest text-gray-600 uppercase bg-gray-800/40 px-1.5 py-0.5 rounded-sm">
                      {toss.game_type === 'Postseason' ? 'PLY' : toss.game_type === 'Preseason' ? 'PRE' : 'REG'}
                    </span>
                  </div>

                  {/* Toss result */}
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs" style={{ color: winnerColor }}>{tossWinner}</span>
                    <span className="text-gray-600 mx-1.5 text-[10px]">won toss</span>
                    {toss.winner_choice && (
                      <span className="text-[10px] text-gray-600">· chose {toss.winner_choice}</span>
                    )}
                  </div>

                  {/* Game result */}
                  {game ? (
                    <div className="text-right flex-shrink-0 w-16">
                      {team1WonGame !== null && (
                        <div className="text-sm font-bold leading-none" style={{ color: team1WonGame ? c1 : c2 }}>
                          {team1WonGame ? team1 : team2}
                        </div>
                      )}
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
      ) : (
        <div className="text-center py-12 text-gray-400">
          No matchups found with current filters
        </div>
      )}
    </div>
  );
});

MatchupDetails.displayName = 'MatchupDetails';

export default MatchupDetails;
