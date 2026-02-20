import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center px-4">
      <div className="text-center max-w-md">

        {/* 404 number */}
        <div
          className="font-bold leading-none mb-6 select-none"
          style={{
            fontSize: 'clamp(6rem, 20vw, 10rem)',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #1e3a5f 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          404
        </div>

        {/* Coin icon */}
        <div className="flex justify-center mb-6" aria-hidden="true">
          <svg className="w-16 h-16 opacity-30" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="23" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />
            <circle cx="24" cy="24" r="19" fill="none" stroke="#fcd34d" strokeWidth="0.75" strokeDasharray="3 2" opacity="0.6" />
            <ellipse cx="24" cy="24" rx="10" ry="14" fill="#92400e" stroke="#b45309" strokeWidth="1" />
            <line x1="24" y1="13" x2="24" y2="35" stroke="#fcd34d" strokeWidth="1.2" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Page Not Found</h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          That page doesn&apos;t exist. The coin may have landed on its edge.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Go Home
          </Link>
          <Link
            href="/analytics"
            className="px-6 py-3 bg-[#1a1f3a] text-gray-300 rounded-lg hover:bg-[#252d4a] border border-gray-700 transition font-medium"
          >
            Team Analytics
          </Link>
        </div>

      </div>
    </div>
  );
}
