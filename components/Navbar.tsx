'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/analytics', label: 'Team Analytics',   icon: '📋' },
  { href: '/records',   label: 'Records & Streaks', icon: '🏆' },
  { href: '/matchup',   label: 'Matchup Explorer',  icon: '⚔️' },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="bg-[#0f172a] border-b border-gray-800 sticky top-0 z-50 overflow-hidden">

      {/* Scrolling yard lines — decorative */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.06]">
        <div className="yard-scroll flex h-full" style={{ width: '200%' }}>
          {[...Array(40)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-16 h-full border-r border-white" />
          ))}
        </div>
      </div>

      {/* Green turf strip */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-60" />

      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 md:py-4 relative">
        <div className="flex items-center justify-between">

          {/* LEFT: Coin + site name */}
          <Link href="/" className="flex items-center gap-3 md:gap-4">
            <div style={{ perspective: '1000px' }} className="w-9 h-9 md:w-11 md:h-11 flex-shrink-0">
              <svg
                className="coin-spin w-full h-full"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <radialGradient id="coinGradNav" cx="35%" cy="30%" r="65%">
                    <stop offset="0%" stopColor="#fde68a"/>
                    <stop offset="60%" stopColor="#f59e0b"/>
                    <stop offset="100%" stopColor="#b45309"/>
                  </radialGradient>
                </defs>
                <circle cx="24" cy="24" r="23" fill="url(#coinGradNav)" stroke="#b45309" strokeWidth="1.5"/>
                <circle cx="24" cy="24" r="19" fill="none" stroke="#fcd34d" strokeWidth="0.75" strokeDasharray="3 2" opacity="0.6"/>
                <ellipse cx="24" cy="24" rx="10" ry="14" fill="#92400e" stroke="#b45309" strokeWidth="1"/>
                <line x1="24" y1="13" x2="24" y2="35" stroke="#fcd34d" strokeWidth="1.2"/>
                <line x1="20" y1="19" x2="28" y2="19" stroke="#fcd34d" strokeWidth="1"/>
                <line x1="19" y1="23" x2="29" y2="23" stroke="#fcd34d" strokeWidth="1"/>
                <line x1="20" y1="27" x2="28" y2="27" stroke="#fcd34d" strokeWidth="1"/>
              </svg>
            </div>

            <span
              className="leading-none font-bold"
              style={{
                fontSize: 'clamp(1.4rem, 4vw, 2.1rem)',
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: '0.02em',
              }}
            >
              <span style={{
                background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 40%, #3b82f6 70%, #1d4ed8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>NFLTossStats</span>
              <span style={{ color: '#475569' }}>.com</span>
            </span>
          </Link>

          {/* RIGHT: Nav links */}
          <nav className="flex gap-1.5 md:gap-2">
            {navLinks.map(({ href, label, icon }) => {
              const isActive = pathname === href || pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  className={`rounded-lg font-semibold tracking-wide transition-all duration-200 flex items-center gap-1.5
                    px-2 py-2 md:px-4 md:py-2 text-base md:text-sm
                    ${isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                      : 'bg-[#1a1f3a] text-gray-400 hover:text-white hover:bg-[#252d4a] border border-gray-700/50'
                    }`}
                >
                  <span>{icon}</span>
                  <span className="hidden md:inline">{label}</span>
                </Link>
              );
            })}
          </nav>

        </div>
      </div>
    </header>
  );
}
