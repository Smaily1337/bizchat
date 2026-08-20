export function GlassSkeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer ${className}`} />;
}

export function GlassCardSkeleton() {
  return (
    <div className="glass-panel rounded-xl p-5 border border-glass-border space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <GlassSkeleton className="h-4 w-28 rounded-md" />
        <GlassSkeleton className="h-8 w-8 rounded-lg" />
      </div>
      <GlassSkeleton className="h-8 w-20 rounded-lg mt-2" />
      <GlassSkeleton className="h-3 w-36 rounded-md mt-1" />
    </div>
  );
}

export function GlassTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass-panel rounded-xl border border-glass-border p-4 space-y-3 animate-fade-up">
      <div className="flex justify-between items-center pb-3 border-b border-white/5">
        <GlassSkeleton className="h-5 w-36 rounded-md" />
        <GlassSkeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="space-y-2.5 pt-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5"
          >
            <div className="flex items-center gap-3">
              <GlassSkeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="space-y-1.5">
                <GlassSkeleton className="h-4 w-32 rounded-md" />
                <GlassSkeleton className="h-3 w-20 rounded-md" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GlassSkeleton className="h-4 w-16 rounded-md" />
              <GlassSkeleton className="h-7 w-14 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GlassChatSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-fade-up">
      <div className="flex items-start gap-3">
        <GlassSkeleton className="w-8 h-8 rounded-full shrink-0" />
        <div className="space-y-1.5">
          <GlassSkeleton className="h-10 w-48 rounded-2xl rounded-tl-sm" />
          <GlassSkeleton className="h-3 w-16 rounded" />
        </div>
      </div>
      <div className="flex items-start justify-end gap-3">
        <div className="space-y-1.5 flex flex-col items-end">
          <GlassSkeleton className="h-12 w-60 rounded-2xl rounded-tr-sm bg-blue-500/20" />
          <GlassSkeleton className="h-3 w-14 rounded" />
        </div>
        <GlassSkeleton className="w-8 h-8 rounded-full shrink-0 bg-blue-500/20" />
      </div>
      <div className="flex items-start gap-3">
        <GlassSkeleton className="w-8 h-8 rounded-full shrink-0" />
        <div className="space-y-1.5">
          <GlassSkeleton className="h-14 w-64 rounded-2xl rounded-tl-sm" />
          <GlassSkeleton className="h-3 w-20 rounded" />
        </div>
      </div>
    </div>
  );
}
