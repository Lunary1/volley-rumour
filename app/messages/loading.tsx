import { Card } from "@/components/ui/card";

export default function MessagesLoading() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-3xl font-bold">Berichten</h1>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card
              key={i}
              className="h-24 border-l-4 border-l-primary/20 bg-muted/50 animate-pulse"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
