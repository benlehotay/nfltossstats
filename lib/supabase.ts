import { Toss, Game, Team } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

export async function fetchTosses(): Promise<Toss[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/coin_tosses?select=*&order=season.desc,week.desc`,
    { headers }
  );
  if (!res.ok) throw new Error(`Toss data fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchGames(): Promise<Game[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/games?select=*`,
    { headers }
  );
  if (!res.ok) throw new Error(`Games data fetch failed: ${res.statusText}`);
  return res.json();
}

export async function fetchTeams(): Promise<Team[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/teams?select=*&order=abbreviation`,
    { headers }
  );
  if (!res.ok) throw new Error(`Team data fetch failed: ${res.statusText}`);
  return res.json();
}
