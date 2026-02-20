import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'NFLTossStats.com – The Ultimate NFL Coin Toss Database';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #060a1c 0%, #0a0e27 40%, #0d1538 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Vertical yard line decorations */}
        {[8, 18, 28, 38, 48, 58, 68, 78, 88].map((pct) => (
          <div
            key={pct}
            style={{
              position: 'absolute',
              left: `${pct}%`,
              top: 0,
              bottom: 0,
              width: '1px',
              background: 'rgba(255,255,255,0.03)',
            }}
          />
        ))}

        {/* Top green accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, transparent 0%, #22c55e 50%, transparent 100%)',
          }}
        />

        {/* Gold coin circle */}
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 60%, #b45309 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 28,
            boxShadow: '0 0 48px rgba(245, 158, 11, 0.4)',
          }}
        >
          <div style={{ fontSize: 44, fontWeight: 900, color: '#78350f', lineHeight: 1 }}>T</div>
        </div>

        {/* Site name */}
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 18 }}>
          <span style={{ fontSize: 84, fontWeight: 900, color: '#60a5fa', letterSpacing: '-3px' }}>
            NFLToss
          </span>
          <span style={{ fontSize: 84, fontWeight: 900, color: '#3b82f6', letterSpacing: '-3px' }}>
            Stats
          </span>
          <span style={{ fontSize: 58, fontWeight: 700, color: '#475569', letterSpacing: '-1px' }}>
            .com
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            color: '#94a3b8',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: 40,
          }}
        >
          The Ultimate NFL Coin Toss Database
        </div>

        {/* Stat pills */}
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { label: 'Every Toss', color: '#eab308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)' },
            { label: 'Every Season', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.35)' },
            { label: '32 Teams', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.35)' },
          ].map(({ label, color, bg, border }) => (
            <div
              key={label}
              style={{
                padding: '10px 26px',
                borderRadius: 9999,
                background: bg,
                border: `1px solid ${border}`,
                color,
                fontSize: 19,
                fontWeight: 700,
                letterSpacing: '1px',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Bottom green accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, transparent 0%, #22c55e 50%, transparent 100%)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
