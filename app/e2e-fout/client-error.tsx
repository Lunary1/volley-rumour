"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/lib/use-is-client";

/** Throws while rendering once clicked, so app/error.tsx catches it. */
export function ClientError() {
  const isClient = useIsClient();
  const [broken, setBroken] = useState(false);
  if (broken) throw new Error("E2E-testfout in de browser");
  return (
    <main className="p-8">
      <Button disabled={!isClient} onClick={() => setBroken(true)}>
        Fout veroorzaken
      </Button>
    </main>
  );
}
