"use client";

import { useState } from "react";
import { getFirstRumourToConfirm } from "@/app/actions/rumour";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestConfirmPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await getFirstRumourToConfirm();
      setResult(res);
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen py-8">
      <div className="mx-auto max-w-md px-4">
        <Card>
          <CardHeader>
            <CardTitle>Confirm First Rumour</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Bezig..." : "Confirm Rumour"}
            </Button>

            {result && (
              <div className="p-4 rounded-lg bg-muted">
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
