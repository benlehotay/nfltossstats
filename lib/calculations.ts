import { Toss, Game, Team, TeamStat } from './types';

// Helper function to format dates without timezone shift
// Dates from DB are stored as YYYY-MM-DD and should display as-is
export function formatGameDate(dateString: string): string {
  if (!dateString) return '';
  // Parse as UTC to prevent timezone conversion
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
}

export function calculateTeamStats(
  tosses: Toss[],
  games: Game[],
  getGameForToss: (toss: Toss) => Game | undefined
): TeamStat[] {
  const teamMap: Record<string, any> = {};

  tosses.forEach(toss => {
    // IMPORTANT: Only count Regular tosses for team stats to avoid double-counting OT games
    // OT tosses are still tracked in history for streak calculations
    const isRegularToss = toss.toss_type === 'Regular';

    [toss.winner, toss.loser].forEach(team => {
      if (!team || team === 'Unknown') return;
      if (!teamMap[team]) {
        teamMap[team] = {
          abbr: team,
          totalTosses: 0,  // Only Regular tosses
          tossWins: 0,      // Only Regular toss wins
          defers: 0,
          receives: 0,
          history: [],      // All tosses (Regular + OT) for streak calculation
          gameWins: 0,
          gamesWithData: 0
        };
      }

      // Always add to history for streak calculations
      teamMap[team].history.push(toss);

      // Only count Regular tosses for matchup stats
      if (isRegularToss) {
        teamMap[team].totalTosses++;

        if (toss.winner === team) {
          teamMap[team].tossWins++;
          if (toss.winner_choice === 'Defer') teamMap[team].defers++;
          if (toss.winner_choice === 'Receive') teamMap[team].receives++;

          // Check game outcome
          const game = getGameForToss(toss);
          if (game && game.home_score != null && game.away_score != null) {
            teamMap[team].gamesWithData++;
            const gameWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
            if (team === gameWinner) {
              teamMap[team].gameWins++;
            }
          }
        }
      }
    });
  });

  return Object.values(teamMap).map((team: any) => {
    const tossWinPct = team.totalTosses > 0 ? Math.round((team.tossWins / team.totalTosses) * 100) : 0;
    const gameWinPct = team.gamesWithData > 0 ? Math.round((team.gameWins / team.gamesWithData) * 100) : 0;
    const deferPct = team.tossWins > 0 ? Math.round((team.defers / team.tossWins) * 100) : 0;

    // Calculate streak - count BOTH Regular and OT tosses separately
    let streak = 0;

    // Sort all tosses chronologically, Regular before OT for same game
    const sortedHistory = [...team.history].sort((a: Toss, b: Toss) => {
      // First sort by date
      if (a.game_date && b.game_date) {
        const dateCompare = new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
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

export function calculateAllRecords(
  tosses: Toss[],
  games: Game[],
  getGameForToss: (toss: Toss) => Game | undefined,
  teams: Team[]
) {
  // Sort ALL tosses chronologically, ensuring Regular comes before OT for same game
  const sortedTosses = [...tosses].sort((a, b) => {
    // First sort by date
    if (a.game_date && b.game_date) {
      const dateCompare = new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
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
  const teamTosses: Record<string, Toss[]> = {};
  sortedTosses.forEach(toss => {
    [toss.winner, toss.loser].forEach(team => {
      if (!teamTosses[team]) teamTosses[team] = [];
      teamTosses[team].push(toss);
    });
  });

  // Find longest winning streak
  let longestWin: any = { team: '', streak: 0, games: [], startDate: '', endDate: '' };
  Object.keys(teamTosses).forEach(team => {
    let maxStreak = 0;
    let maxStreakGames: Toss[] = [];
    let currentStreak = 0;
    let currentStreakGames: Toss[] = [];

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
        gamesByTeam: { [team]: maxStreakGames },
        startDate: maxStreakGames[0]?.game_date ? formatGameDate(maxStreakGames[0].game_date) :
                   `${maxStreakGames[0]?.season} Wk ${maxStreakGames[0]?.week}`,
        endDate: maxStreakGames[maxStreakGames.length - 1]?.game_date ?
                 formatGameDate(maxStreakGames[maxStreakGames.length - 1].game_date) :
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
  let longestLose: any = { team: '', teams: [], streak: 0, games: [], startDate: '', endDate: '' };
  Object.keys(teamTosses).forEach(team => {
    let maxStreak = 0;
    let maxStreakGames: Toss[] = [];
    let currentStreak = 0;
    let currentStreakGames: Toss[] = [];

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
        startDate: maxStreakGames[0]?.game_date ? formatGameDate(maxStreakGames[0].game_date) :
                   `${maxStreakGames[0]?.season} Wk ${maxStreakGames[0]?.week}`,
        endDate: maxStreakGames[maxStreakGames.length - 1]?.game_date ?
                 formatGameDate(maxStreakGames[maxStreakGames.length - 1].game_date) :
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
  let activeWin: any = { team: '', teams: [], streak: 0, games: [], gamesByTeam: {} };
  let activeLose: any = { team: '', teams: [], streak: 0, games: [], gamesByTeam: {} };

  Object.keys(teamTosses).forEach(team => {
    // Skip defunct teams
    const teamData = teams.find(t => t.abbreviation === team);
    if (teamData?.defunct) return;

    const recentTosses = [...teamTosses[team]].reverse(); // Most recent first
    let winStreak = 0;
    let loseStreak = 0;
    let winGames: Toss[] = [];
    let loseGames: Toss[] = [];

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
      activeWin = {
        team,
        teams: [team],
        streak: winStreak,
        games: winGames.reverse(),
        gamesByTeam: { [team]: winGames.reverse() }
      };
    } else if (winStreak === activeWin.streak && winStreak > 0) {
      // Tied for active win streak - add this team
      if (!activeWin.teams) activeWin.teams = [activeWin.team];
      activeWin.teams.push(team);
      if (!activeWin.gamesByTeam) activeWin.gamesByTeam = { [activeWin.team]: activeWin.games };
      activeWin.gamesByTeam[team] = winGames.reverse();
    }

    if (loseStreak > activeLose.streak) {
      activeLose = {
        team,
        teams: [team],
        streak: loseStreak,
        games: loseGames.reverse(),
        gamesByTeam: { [team]: loseGames.reverse() }
      };
    } else if (loseStreak === activeLose.streak && loseStreak > 0) {
      // Tied for active lose streak - add this team
      if (!activeLose.teams) activeLose.teams = [activeLose.team];
      activeLose.teams.push(team);
      if (!activeLose.gamesByTeam) activeLose.gamesByTeam = { [activeLose.team]: activeLose.games };
      activeLose.gamesByTeam[team] = loseGames.reverse();
    }
  });

  // Best/worst toss win percentage (count ALL tosses)
  let bestPct: any = { team: '', percentage: 0, wins: 0, total: 0, byYear: [] };
  let worstPct: any = { team: '', percentage: 100, wins: 0, total: 0, byYear: [] };

  Object.keys(teamTosses).forEach(team => {
    const wins = teamTosses[team].filter(t => t.winner === team).length;
    const total = teamTosses[team].length;
    if (total >= 50) {
      const pct = Math.round((wins / total) * 100);

      // Calculate by year breakdown
      const yearBreakdown: Record<string, { wins: number; total: number }> = {};
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
        .sort((a, b) => Number(b) - Number(a))
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
  let bestConv: any = { team: '', percentage: 0, tossWins: 0, gameWins: 0, byOpponent: [] };

  Object.keys(teamTosses).forEach(team => {
    const tossWins = teamTosses[team].filter(t => t.winner === team);
    const tossWinsWithGames = tossWins.filter(t => {
      const game = getGameForToss(t);
      return game && game.home_score != null && game.away_score != null;
    });

    const gameWins = tossWinsWithGames.filter(t => {
      const game = getGameForToss(t);
      if (!game) return false;
      const gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
      return team === gameWinner;
    }).length;

    if (tossWinsWithGames.length >= 20) {
      const pct = Math.round((gameWins / tossWinsWithGames.length) * 100);

      // Calculate by opponent breakdown
      const oppBreakdown: Record<string, { tossWins: number; gameWins: number }> = {};
      tossWinsWithGames.forEach(t => {
        const opp = t.loser;
        if (!oppBreakdown[opp]) {
          oppBreakdown[opp] = { tossWins: 0, gameWins: 0 };
        }
        oppBreakdown[opp].tossWins++;

        const game = getGameForToss(t);
        if (!game) return;
        const gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
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
  let mostDefers: any = { team: '', streak: 0, games: [], startDate: '', endDate: '' };

  Object.keys(teamTosses).forEach(team => {
    const wins = teamTosses[team].filter(t => t.winner === team);
    let currentStreak = 0;
    let currentGames: Toss[] = [];
    let maxStreak = 0;
    let maxGames: Toss[] = [];

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
        startDate: maxGames[0]?.game_date ? formatGameDate(maxGames[0].game_date) : '',
        endDate: maxGames[maxGames.length - 1]?.game_date ? formatGameDate(maxGames[maxGames.length - 1].game_date) : ''
      };
    }
  });

  // Most lopsided rivalry
  let mostLopsided: any = { team: '', opponent: '', wins: 0, losses: 0, percentage: 0, games: [] };

  Object.keys(teamTosses).forEach(team => {
    const opponentMap: Record<string, { wins: number; losses: number; games: Toss[] }> = {};
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
  let longestH2H: any = { team: '', opponent: '', streak: 0, games: [] };

  Object.keys(teamTosses).forEach(team => {
    const opponentMap: Record<string, Toss[]> = {};
    teamTosses[team].forEach(toss => {
      const opp = toss.winner === team ? toss.loser : toss.winner;
      if (!opponentMap[opp]) opponentMap[opp] = [];
      opponentMap[opp].push(toss);
    });

    Object.keys(opponentMap).forEach(opp => {
      let currentStreak = 0;
      let currentGames: Toss[] = [];
      let maxStreak = 0;
      let maxGames: Toss[] = [];

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
  let bestSeason: any = { team: '', season: 0, wins: 0, losses: 0, percentage: 0, games: [] };
  let worstSeason: any = { team: '', season: 0, wins: 0, losses: 0, percentage: 100, games: [] };

  Object.keys(teamTosses).forEach(team => {
    const seasonMap: Record<string, { wins: number; losses: number; games: Toss[] }> = {};
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

// Calculate opponent stats for a single team (used in accordion expansion)
export function calculateOpponentStatsForTeam(
  tosses: Toss[],
  teamAbbr: string,
  getGameForToss: (toss: Toss) => Game | undefined
) {
  const opponentMap: Record<string, any> = {};

  // Sort ALL tosses chronologically, ensuring Regular comes before OT for same game
  const sortedTosses = [...tosses].filter(t => t.winner === teamAbbr || t.loser === teamAbbr)
    .sort((a, b) => {
      // First sort by date
      if (a.game_date && b.game_date) {
        const dateCompare = new Date(a.game_date).getTime() - new Date(b.game_date).getTime();
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
        totalMatchups: 0,      // Games (Regular tosses only)
        totalTosses: 0,        // All tosses (Regular + OT) for toss win %
        tossWins: 0,           // All toss wins (Regular + OT)
        gameWins: 0,
        gamesWithData: 0,
        tossHistory: [],
        gameIds: new Set() // Track unique games to avoid double-counting OT
      };
    }

    // Count ALL tosses for toss win percentage
    opponentMap[opponent].totalTosses++;
    if (!teamWonToss) {
      opponentMap[opponent].tossWins++;
    }

    // Only count Regular tosses for game matchup count
    if (toss.toss_type === 'Regular') {
      opponentMap[opponent].totalMatchups++;
    }

    // Store EACH toss result for streak calculation (includes OT)
    opponentMap[opponent].tossHistory.push({
      season: toss.season,
      week: toss.week,
      game_date: toss.game_date,
      toss_type: toss.toss_type,
      opponentWon: !teamWonToss
    });

    // Only count each unique GAME once for game wins/losses
    const game = getGameForToss(toss);
    if (game && game.home_score != null && game.away_score != null) {
      const gameKey = `${game.season}-${game.week}-${game.home_team}-${game.away_team}`;

      if (!opponentMap[opponent].gameIds.has(gameKey)) {
        opponentMap[opponent].gameIds.add(gameKey);
        opponentMap[opponent].gamesWithData++;

        const gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;
        if (opponent === gameWinner) {
          opponentMap[opponent].gameWins++;
        }
      }
    }
  });

  return Object.values(opponentMap)
    .map((opp: any) => {
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

      const { gameIds, ...oppData } = opp; // Remove Set before returning
      return {
        ...oppData,
        tossWinPct: opp.totalTosses > 0 ? Math.round((opp.tossWins / opp.totalTosses) * 100) : 0,
        gameWinPct: opp.gamesWithData > 0 ? Math.round((opp.gameWins / opp.gamesWithData) * 100) : 0,
        currentStreak: currentStreak
      };
    })
    .sort((a: any, b: any) => b.totalMatchups - a.totalMatchups);
}

// Calculate opponent stats when filtering by specific teams
export function calculateOpponentStats(
  filteredTosses: Toss[],
  filteredTeams: { abbr: string }[],
  getGameForToss: (toss: Toss) => Game | undefined
) {
  const opponentMap: Record<string, any> = {};

  // Get set of filtered team abbreviations
  const filteredTeamAbbrs = new Set(filteredTeams.map(t => t.abbr));

  // Go through each toss and find opponents
  filteredTosses.forEach(toss => {
    let opponent = null;
    let opponentWonToss = false;

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
        totalTosses: 0,
        tossWins: 0,
        gameWins: 0,
        gamesWithData: 0,
        gameHistory: [],
        gameIds: new Set()
      };
    }

    // Count ALL tosses for toss win percentage
    opponentMap[opponent].totalTosses++;
    if (opponentWonToss) {
      opponentMap[opponent].tossWins++;
    }

    // Only count Regular tosses for game matchup count
    if (toss.toss_type === 'Regular') {
      opponentMap[opponent].totalMatchups++;
    }

    // Only count each unique GAME once for game wins/losses
    const game = getGameForToss(toss);
    if (game && game.home_score != null && game.away_score != null) {
      const gameKey = `${game.season}-${game.week}-${game.home_team}-${game.away_team}`;

      if (!opponentMap[opponent].gameIds.has(gameKey)) {
        opponentMap[opponent].gameIds.add(gameKey);
        opponentMap[opponent].gamesWithData++;

        const gameWinner = (game.home_score ?? 0) > (game.away_score ?? 0) ? game.home_team : game.away_team;

        // Game win = opponent won (from opponent's perspective)
        let opponentWonGame = false;
        if (filteredTeamAbbrs.has(game.home_team) && !filteredTeamAbbrs.has(game.away_team)) {
          opponentWonGame = gameWinner === game.away_team;
        } else if (filteredTeamAbbrs.has(game.away_team) && !filteredTeamAbbrs.has(game.home_team)) {
          opponentWonGame = gameWinner === game.home_team;
        }

        if (opponentWonGame) {
          opponentMap[opponent].gameWins++;
        }

        opponentMap[opponent].gameHistory.push({
          season: toss.season,
          week: toss.week,
          game_date: toss.game_date,
          opponentWonGame
        });
      }
    }
  });

  const results = Object.values(opponentMap).map((opp: any) => {
    // Calculate streak from game history
    let streak = 0;
    if (opp.gameHistory.length > 0) {
      const recentFirst = [...opp.gameHistory].reverse();
      const mostRecentWin = recentFirst[0].opponentWonGame;

      for (const game of recentFirst) {
        if (game.opponentWonGame !== mostRecentWin) break;
        streak += mostRecentWin ? 1 : -1;
      }
    }

    const { gameIds, ...oppData } = opp;
    return {
      ...oppData,
      tossWinPct: opp.totalTosses > 0 ? Math.round((opp.tossWins / opp.totalTosses) * 100) : 0,
      gameWinPct: opp.gamesWithData > 0 ? Math.round((opp.gameWins / opp.gamesWithData) * 100) : 0,
      currentStreak: streak
    };
  })
  .sort((a: any, b: any) => b.totalMatchups - a.totalMatchups);

  console.log('Opponent results:', results);

  return results;
}
