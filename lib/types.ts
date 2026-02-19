export interface Toss {
  game_id: string | number;
  season: number;
  week: number;
  game_date: string;
  game_type: string;
  toss_type: string; // 'Regular' | 'Overtime'
  winner: string;
  loser: string;
  winner_choice: string; // 'Defer' | 'Receive'
  round_name?: string;
}

export interface Game {
  game_id: string | number;
  season: number;
  week: number;
  game_date: string;
  game_type: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  venue?: string;
  city?: string;
  state?: string;
}

export interface Team {
  abbreviation: string;
  name: string;
  city: string;
  state: string;
  conference: string;
  division: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  defunct?: boolean;
}

export interface TeamStat {
  abbr: string;
  totalTosses: number;
  tossWins: number;
  tossWinPct: number;
  gameWinPct: number;
  deferPct: number;
  currentStreak: number;
}

export interface OpponentStat {
  abbr: string;
  totalMatchups: number;
  totalTosses: number;
  tossWins: number;
  gameWins: number;
  gamesWithData: number;
  tossHistory: Array<{
    season: number;
    week: number;
    game_date: string;
    toss_type: string;
    opponentWon: boolean;
  }>;
  tossWinPct: number;
  gameWinPct: number;
  currentStreak: number;
}
