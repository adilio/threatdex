export function CardSkeleton() {
  return (
    <div
      className="flex flex-col items-center gap-3"
      aria-hidden="true"
      role="presentation"
    >
      {/* Card body */}
      <div
        className="w-[280px] h-[392px] rounded-xl overflow-hidden border border-blue-shadow/40"
        style={{ background: "linear-gradient(160deg, #00123F 0%, #0a1a4a 100%)" }}
      >
        {/* Header bar skeleton */}
        <div className="h-8 skeleton-shimmer" />

        {/* Hero image skeleton */}
        <div className="h-[140px] skeleton-shimmer opacity-70" />

        {/* Name skeleton */}
        <div className="px-3 pt-3 pb-2 space-y-2">
          <div className="h-4 w-3/4 rounded skeleton-shimmer" />
          <div className="h-3 w-1/2 rounded skeleton-shimmer opacity-60" />
        </div>

        {/* Stats box skeleton */}
        <div className="mx-3 rounded-lg border border-blue-shadow/30 p-3">
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-2 w-16 rounded skeleton-shimmer opacity-50" />
                <div className="h-3 w-20 rounded skeleton-shimmer opacity-70" />
              </div>
            ))}
          </div>
        </div>

        {/* Footer tags skeleton */}
        <div className="px-3 pt-3 flex gap-2">
          <div className="h-5 w-16 rounded skeleton-shimmer opacity-60" />
          <div className="h-5 w-20 rounded skeleton-shimmer opacity-50" />
        </div>
      </div>

      {/* Controls skeleton */}
      <div className="flex gap-2">
        <div className="h-7 w-24 rounded-md skeleton-shimmer opacity-60" />
        <div className="h-7 w-7 rounded-md skeleton-shimmer opacity-40" />
      </div>

      {/* Name label skeleton */}
      <div className="text-center space-y-1">
        <div className="h-4 w-40 rounded skeleton-shimmer" />
        <div className="h-3 w-24 rounded skeleton-shimmer opacity-60 mx-auto" />
      </div>
    </div>
  );
}
