'use client';

import { memo } from 'react';
import { formatGameDate } from '@/lib/calculations';
import { Team } from '@/lib/types';

interface GameDetailModalProps {
  clickedCell: any;
  teamAbbr: string | null;
  getTeamData: (abbr: string) => Team | undefined;
  onClose: () => void;
}

const GameDetailModal = memo(function GameDetailModal({ clickedCell, teamAbbr, getTeamData, onClose }: GameDetailModalProps) {
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
                    {formatGameDate(dateStr)}
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
                      src={getTeamData(clickedCell.game.home_team)!.logo_url}
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
                      src={getTeamData(clickedCell.game.away_team)!.logo_url}
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
                <div className="text-right">
                  <span className={`font-bold text-lg ${
                    clickedCell.regularTossWon ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {clickedCell.regularTossWon ? 'WON' : 'LOST'}
                  </span>
                  {clickedCell.regularTossWon && (() => {
                    // Find the regular toss and get the winner's choice
                    const regularToss = clickedCell.tosses?.find((t: any) => t.toss_type === 'Regular') || clickedCell;
                    return regularToss.winner_choice && (
                      <div className="text-xs text-gray-400 mt-1">
                        Chose: {regularToss.winner_choice}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
            {clickedCell.hasOT && clickedCell.otTossWon !== null && (
              <div className="flex items-center justify-between bg-[#0a0e1a] rounded-lg p-4 border border-orange-600">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                  <span className="text-white font-medium">Overtime Toss</span>
                </div>
                <div className="text-right">
                  <span className={`font-bold text-lg ${
                    clickedCell.otTossWon ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {clickedCell.otTossWon ? 'WON' : 'LOST'}
                  </span>
                  {clickedCell.otTossWon && (() => {
                    // Find the OT toss and get the winner's choice
                    const otToss = clickedCell.tosses?.find((t: any) => t.toss_type === 'Overtime') || clickedCell;
                    return otToss.winner_choice && (
                      <div className="text-xs text-gray-400 mt-1">
                        Chose: {otToss.winner_choice}
                      </div>
                    );
                  })()}
                </div>
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
});

GameDetailModal.displayName = 'GameDetailModal';

export default GameDetailModal;
