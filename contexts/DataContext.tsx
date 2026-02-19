'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Toss, Game, Team } from '@/lib/types';
import { fetchTosses, fetchGames, fetchTeams } from '@/lib/supabase';

interface DataContextValue {
  tosses: Toss[];
  games: Game[];
  teams: Team[];
  loading: boolean;
  error: string | null;
}

const DataContext = createContext<DataContextValue>({
  tosses: [],
  games: [],
  teams: [],
  loading: true,
  error: null,
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [tosses, setTosses] = useState<Toss[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [tossData, gamesData, teamsData] = await Promise.all([
          fetchTosses(),
          fetchGames(),
          fetchTeams(),
        ]);
        setTosses(tossData || []);
        setGames(gamesData || []);
        setTeams(teamsData || []);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <DataContext.Provider value={{ tosses, games, teams, loading, error }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
