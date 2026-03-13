"use client";

import { useEffect } from "react";

export function DatadogRumProvider() {
  useEffect(() => {
    // Dynamically import to ensure this only runs in the browser
    import("@datadog/browser-rum").then(({ datadogRum }) => {
      import("@datadog/browser-rum-react").then(({ reactPlugin }) => {
        datadogRum.init({
          applicationId: "8b685d1a-3a6a-431a-8e4f-14920e8c36f0",
          clientToken: "pube11a373d1902b15309209dff89858dab",
          site: "datadoghq.eu",
          service: "volley-rumour",
          env: process.env.NODE_ENV,
          version: "0.1.0",
          sessionSampleRate: 100,
          sessionReplaySampleRate: 20,
          trackResources: true,
          trackUserInteractions: true,
          trackLongTasks: true,
          plugins: [reactPlugin({ router: false })],
        });
      });
    });
  }, []);

  return null;
}
