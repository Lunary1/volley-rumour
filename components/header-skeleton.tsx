// Shown while the header checks who is logged in. Same box as HeaderClient
// (h-16 plus the border), so the page doesn't move when it's replaced (#211).
export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex lg:flex-1 lg:basis-0">
            <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          </div>
          <div className="hidden gap-8 lg:flex">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-4 w-20 animate-pulse rounded bg-muted"
              />
            ))}
          </div>
          <div className="flex lg:flex-1 lg:basis-0 lg:justify-end">
            <div className="size-10 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      </div>
    </header>
  );
}
