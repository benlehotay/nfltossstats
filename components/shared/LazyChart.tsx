'use client';

import { useState, useEffect, useRef, memo } from 'react';

interface LazyChartProps {
  children: React.ReactNode;
  fallbackHeight?: string;
}

const LazyChart = memo(function LazyChart({ children, fallbackHeight = '400px' }: LazyChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Only load once
        }
      },
      { rootMargin: '100px' } // Start loading 100px before visible
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  if (!isVisible) {
    return (
      <div
        ref={ref}
        style={{ height: fallbackHeight }}
        className="flex items-center justify-center bg-[#1a1f3a] rounded-xl border border-gray-800"
      >
        <div className="text-gray-500 text-sm">Loading chart...</div>
      </div>
    );
  }

  return <div ref={ref}>{children}</div>;
});

LazyChart.displayName = 'LazyChart';

export default LazyChart;
