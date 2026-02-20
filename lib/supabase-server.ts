import { Toss, Game, Team } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

// Fetch only the tosses involving a specific team (winner or loser).
// Used server-side with Next.js fetch caching (revalidate = 1 day).
export async function fetchTeamTosses(abbr: string): Promise<Toss[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/coin_tosses?select=*&or=(winner.eq.${abbr},loser.eq.${abbr})&order=season.desc,week.desc`,
    { headers, next: { revalidate: 86400 } }
  );
  if (!res.ok) throw new Error(`Failed to fetch tosses for ${abbr}: ${res.statusText}`);
  return res.json();
}

// Fetch only the games involving a specific team (home or away).
export async function fetchTeamGames(abbr: string): Promise<Game[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/games?select=*&or=(home_team.eq.${abbr},away_team.eq.${abbr})`,
    { headers, next: { revalidate: 86400 } }
  );
  if (!res.ok) throw new Error(`Failed to fetch games for ${abbr}: ${res.statusText}`);
  return res.json();
}

// Fetch all teams. Small payload (32 rows); fine to reuse across pages.
export async function fetchTeams(): Promise<Team[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/teams?select=*&order=abbreviation`,
    { headers, next: { revalidate: 86400 } }
  );
  if (!res.ok) throw new Error(`Failed to fetch teams: ${res.statusText}`);
  return res.json();
}
