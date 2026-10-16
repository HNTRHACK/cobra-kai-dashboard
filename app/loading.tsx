import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="pt-32">
      <span className="sr-only">Loading dashboard…</span>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-6 h-24 w-3/4" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
      <Skeleton className="mt-6 h-[420px]" />
    </div>
  );
}
