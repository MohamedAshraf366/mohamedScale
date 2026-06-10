import { cn } from "@/lib/utils";

interface ChartSkeletonProps {
  type?: 'bar' | 'pie' | 'line' | 'funnel' | 'heatmap' | 'stat';
  className?: string;
  height?: number;
}

export function ChartSkeleton({ type = 'bar', className, height = 350 }: ChartSkeletonProps) {
  return (
    <div 
      className={cn(
        "chart-container chart-skeleton p-6",
        className
      )}
      style={{ height }}
    >
      {type === 'bar' && <BarChartSkeleton />}
      {type === 'pie' && <PieChartSkeleton />}
      {type === 'line' && <LineChartSkeleton />}
      {type === 'funnel' && <FunnelChartSkeleton />}
      {type === 'heatmap' && <HeatmapSkeleton />}
      {type === 'stat' && <StatCardSkeleton />}
    </div>
  );
}

function BarChartSkeleton() {
  return (
    <div className="h-full flex flex-col">
      {/* Header skeleton */}
      <div className="mb-4 space-y-2">
        <div className="h-5 w-40 skeleton-shimmer rounded-lg" />
        <div className="h-3 w-64 skeleton-shimmer rounded-md opacity-60" />
      </div>
      
      {/* Chart area */}
      <div className="flex-1 flex items-end justify-around gap-3 pt-8 pb-4">
        {[65, 45, 80, 55, 70, 40, 85, 50].map((h, i) => (
          <div 
            key={i} 
            className="flex-1 skeleton-bar skeleton-pulse rounded-t-lg"
            style={{ 
              height: `${h}%`,
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>
      
      {/* X-axis labels */}
      <div className="flex justify-around gap-3 pt-2 border-t border-border/20">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-3 w-8 skeleton-shimmer rounded opacity-50" />
        ))}
      </div>
    </div>
  );
}

function PieChartSkeleton() {
  return (
    <div className="h-full flex flex-col">
      {/* Header skeleton */}
      <div className="mb-4 space-y-2">
        <div className="h-5 w-48 skeleton-shimmer rounded-lg" />
        <div className="h-3 w-36 skeleton-shimmer rounded-md opacity-60" />
      </div>
      
      {/* Chart area */}
      <div className="flex-1 flex items-center justify-center gap-8">
        {/* Pie */}
        <div className="relative">
          <div className="w-40 h-40 skeleton-pie skeleton-pulse rounded-full" />
          <div className="absolute inset-0 m-auto w-16 h-16 bg-background rounded-full" />
        </div>
        
        {/* Legend */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="w-3 h-3 skeleton-shimmer rounded-sm" />
              <div className="h-3 w-20 skeleton-shimmer rounded opacity-70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LineChartSkeleton() {
  return (
    <div className="h-full flex flex-col">
      {/* Header skeleton */}
      <div className="mb-4 space-y-2">
        <div className="h-5 w-44 skeleton-shimmer rounded-lg" />
        <div className="h-3 w-56 skeleton-shimmer rounded-md opacity-60" />
      </div>
      
      {/* Chart area */}
      <div className="flex-1 relative pt-8">
        {/* Y-axis lines */}
        <div className="absolute inset-0 flex flex-col justify-between">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full h-px bg-border/20" />
          ))}
        </div>
        
        {/* Simulated line path */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
          <path 
            d="M 0,70 Q 50,50 100,60 T 200,40 T 300,55 T 400,30 T 500,45 T 600,25"
            fill="none"
            stroke="hsl(var(--chart-primary) / 0.2)"
            strokeWidth="3"
            className="skeleton-pulse"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        
        {/* Data points */}
        <div className="absolute inset-0 flex items-center justify-around">
          {[30, 50, 40, 60, 35, 55, 45].map((top, i) => (
            <div 
              key={i}
              className="w-3 h-3 rounded-full skeleton-shimmer"
              style={{ 
                marginTop: `${top}%`,
                animationDelay: `${i * 0.15}s`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FunnelChartSkeleton() {
  return (
    <div className="h-full flex flex-col">
      {/* Header skeleton */}
      <div className="mb-6 space-y-2">
        <div className="h-5 w-40 skeleton-shimmer rounded-lg" />
        <div className="h-3 w-64 skeleton-shimmer rounded-md opacity-60" />
      </div>
      
      {/* Funnel stages */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        {[100, 75, 50, 30].map((width, i) => (
          <div key={i} className="w-full flex flex-col items-center gap-1">
            <div 
              className="h-14 skeleton-shimmer rounded-xl skeleton-pulse"
              style={{ 
                width: `${width}%`,
                animationDelay: `${i * 0.15}s`
              }}
            />
            {i < 3 && (
              <div className="h-4 w-4 skeleton-shimmer rounded-full opacity-40" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-48 skeleton-shimmer rounded" />
        <div className="h-6 w-20 skeleton-shimmer rounded-lg opacity-60" />
      </div>
      
      {/* Month buttons */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {[...Array(12)].map((_, i) => (
          <div 
            key={i} 
            className="h-6 w-8 skeleton-shimmer rounded opacity-50"
            style={{ animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>
      
      {/* Heatmap grid */}
      <div className="flex-1 flex gap-0.5">
        {[...Array(26)].map((_, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-0.5">
            {[...Array(7)].map((_, dayIndex) => (
              <div 
                key={dayIndex}
                className="w-[10px] h-[10px] rounded-sm skeleton-shimmer"
                style={{ 
                  animationDelay: `${(weekIndex * 7 + dayIndex) * 0.005}s`,
                  opacity: Math.random() * 0.5 + 0.2
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="h-full flex flex-col justify-center items-center p-4">
      <div className="h-8 w-24 skeleton-shimmer rounded-lg mb-2" />
      <div className="h-3 w-20 skeleton-shimmer rounded opacity-60" />
    </div>
  );
}

export function ChartSkeletonGrid({ count = 4 }: { count?: number }) {
  const types: ChartSkeletonProps['type'][] = ['bar', 'pie', 'line', 'funnel'];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[...Array(count)].map((_, i) => (
        <ChartSkeleton key={i} type={types[i % types.length]} />
      ))}
    </div>
  );
}
