import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn("skeleton rounded-lg", className)} />
);

export const SongCardSkeleton = () => (
  <div className="flex-shrink-0 w-40 md:w-44">
    <Skeleton className="aspect-square rounded-xl mb-3" />
    <Skeleton className="h-4 w-3/4 mb-1.5" />
    <Skeleton className="h-3 w-1/2" />
  </div>
);

export const SongRowSkeleton = () => (
  <div className="flex items-center gap-3 p-3">
    <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <Skeleton className="h-4 w-3/4 mb-1.5" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  </div>
);

export const SectionSkeleton = () => (
  <div className="px-4 lg:px-6 py-6">
    <Skeleton className="h-6 w-40 mb-4" />
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <SongCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const EmptyState = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-muted-foreground/50" />
    </div>
    <p className="text-sm font-medium text-foreground mb-1">{title}</p>
    {description && (
      <p className="text-xs text-muted-foreground max-w-[240px]">{description}</p>
    )}
  </div>
);
