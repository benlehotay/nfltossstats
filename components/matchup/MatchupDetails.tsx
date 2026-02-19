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

const MatchupDetails = memo(function MatchupDetails({
  team1, team2, tosses, games, getTeamData, getGameForToss, onTeamClick
}: MatchupDetailsProps) {
  const [clickedGame, setClickedGame] = useState<any>(null);
  const [logMode, setLogMode] = useState<'toss' | 'game'>('toss');

  const team1Data = getTeamData(team1);
  const team2Data = getTeamData(team2);

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
            <h3 className="text-2xl font-bold" style={{ color: team1Data?.primary_color || '#ffffff' }}>
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
            <h3 className="text-2xl font-bold" style={{ color: team2Data?.primary_color || '#ffffff' }}>
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
          <div className="text-4xl font-bold" style={{ color: team1Data?.primary_color }}>
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
          <div className="text-4xl font-bold" style={{ color: team2Data?.primary_color }}>
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
                gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
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
                        {toss.game_date && formatGameDate(toss.game_date)}
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
});

MatchupDetails.displayName = 'MatchupDetails';

export default MatchupDetails;
