'use client';

import Link from 'next/link';

const sections = [
  {
    href: '/analytics',
    label: 'Team Analytics',
    sub: 'Win rates, streak history, and defer trends for every team',
  },
  {
    href: '/records',
    label: 'Records & Streaks',
    sub: 'All-time records, longest streaks, and H2H dominance',
  },
  {
    href: '/matchup',
    label: 'Matchup Explorer',
    sub: 'Head-to-head coin toss history between any two teams',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0e27] flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 md:py-24">

        {/* Coin */}
        <div style={{ perspective: '1000px' }} className="mb-10">
          <svg
            className="coin-spin w-16 h-16"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="landingCoinGrad" cx="35%" cy="30%" r="65%">
                <stop offset="0%" stopColor="#fde68a"/>
                <stop offset="60%" stopColor="#f59e0b"/>
                <stop offset="100%" stopColor="#b45309"/>
              </radialGradient>
            </defs>
            <circle cx="24" cy="24" r="23" fill="url(#landingCoinGrad)" stroke="#b45309" strokeWidth="1.5"/>
            <circle cx="24" cy="24" r="19" fill="none" stroke="#fcd34d" strokeWidth="0.75" strokeDasharray="3 2" opacity="0.6"/>
            <ellipse cx="24" cy="24" rx="10" ry="14" fill="#92400e" stroke="#b45309" strokeWidth="1"/>
            <line x1="24" y1="13" x2="24" y2="35" stroke="#fcd34d" strokeWidth="1.2"/>
            <line x1="20" y1="19" x2="28" y2="19" stroke="#fcd34d" strokeWidth="1"/>
            <line x1="19" y1="23" x2="29" y2="23" stroke="#fcd34d" strokeWidth="1"/>
            <line x1="20" y1="27" x2="28" y2="27" stroke="#fcd34d" strokeWidth="1"/>
          </svg>
        </div>

        {/* Title */}
        <h1
          className="text-center mb-4 leading-none font-bold"
          style={{
            fontSize: 'clamp(2.2rem, 7vw, 4rem)',
            fontFamily: "'Barlow Condensed', sans-serif",
            letterSpacing: '0.02em',
          }}
        >
          <span style={{
            background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 40%, #3b82f6 70%, #1d4ed8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            NFLTossStats
          </span>
          <span style={{ color: '#475569' }}>.com</span>
        </h1>

        {/* Description — one sentence, factual */}
        <p
          className="text-gray-500 text-base text-center max-w-xs mb-12"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em', fontSize: '1.1rem' }}
        >
          NFL coin toss outcomes, 2009–present.
        </p>

        {/* Navigation rows */}
        <div className="w-full max-w-sm">
          {sections.map(({ href, label, sub }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center justify-between px-4 py-4 rounded-lg hover:bg-[#1a1f3a] transition-colors"
            >
              <div>
                <div
                  className="text-white font-semibold mb-0.5"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.1rem', letterSpacing: '0.02em' }}
                >
                  {label}
                </div>
                <div className="text-sm text-gray-500">{sub}</div>
              </div>
              <span className="text-gray-700 group-hover:text-gray-400 transition-colors ml-4 flex-shrink-0">
                →
              </span>
            </Link>
          ))}
        </div>

      </main>

      <footer className="text-center py-5 text-gray-700 text-xs border-t border-gray-800/60">
        Play-by-play data via nflverse · regular season &amp; playoffs
      </footer>
    </div>
  );
}
