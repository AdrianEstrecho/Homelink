export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="card">
      <Skeleton className="w-full h-48 rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function ServiceCardSkeleton() {
  return (
    <div className="card">
      <Skeleton className="w-full h-40 rounded-none" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-9 w-full rounded-lg mt-2" />
      </div>
    </div>
  );
}

export function ReviewCardSkeleton() {
  return (
    <div className="card p-6 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex items-center gap-3 pt-2">
        <Skeleton className="w-9 h-9 rounded-full" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export function CategorySkeleton() {
  return (
    <div className="card p-6 flex flex-col items-center gap-3">
      <Skeleton className="w-14 h-14 rounded-2xl" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function GallerySkeleton() {
  return (
    <div>
      <Skeleton className="w-full h-56 rounded-lg" />
      <div className="pt-3 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
