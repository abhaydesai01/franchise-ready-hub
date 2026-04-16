export function SkeletonCard() {
  return (
    <div className="rounded-[10px] border border-brand-border bg-white p-[14px] space-y-3 animate-shimmer"
      style={{ backgroundImage: 'linear-gradient(90deg, #F0EFEB 25%, #E8E6E0 50%, #F0EFEB 75%)', backgroundSize: '200% 100%' }}>
      <div className="flex justify-between">
        <div className="h-4 w-28 rounded bg-brand-border" />
        <div className="h-5 w-10 rounded-full bg-brand-border" />
      </div>
      <div className="h-3 w-32 rounded bg-brand-border" />
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-full bg-brand-border" />
        <div className="h-5 w-20 rounded-full bg-brand-border" />
      </div>
      <div className="flex justify-between">
        <div className="h-3 w-24 rounded bg-brand-border" />
        <div className="h-3 w-12 rounded bg-brand-border" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <div className="h-10 rounded bg-brand-surface animate-shimmer"
        style={{ backgroundImage: 'linear-gradient(90deg, #F0EFEB 25%, #E8E6E0 50%, #F0EFEB 75%)', backgroundSize: '200% 100%' }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded bg-white animate-shimmer"
          style={{ backgroundImage: 'linear-gradient(90deg, #F0EFEB 25%, #E8E6E0 50%, #F0EFEB 75%)', backgroundSize: '200% 100%' }} />
      ))}
    </div>
  );
}
