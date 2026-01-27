// Fast loading skeleton for header - renders immediately while auth completes
export function HeaderSkeleton() {
  return (
    <header className="border-b border-border bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="hidden lg:flex gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 w-20 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <div className="h-10 w-10 bg-muted rounded-full animate-pulse" />
      </div>
    </header>
  );
}
