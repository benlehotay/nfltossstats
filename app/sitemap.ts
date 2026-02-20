import { MetadataRoute } from 'next';

const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB',  'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LAR', 'LV',  'MIA', 'MIN', 'NE',  'NO',  'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF',  'TB',  'TEN', 'WAS',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.nfltossstats.com';
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base,              lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/analytics`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/records`,   lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/matchup`,   lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];

  const teamRoutes: MetadataRoute.Sitemap = NFL_TEAMS.map(abbr => ({
    url: `${base}/team/${abbr}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...teamRoutes];
}
