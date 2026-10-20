import { useEffect } from "react";
import { reportClientError } from "@/app/actions/errors";

/**
 * Reports an error that reached an error page (#186). An error with a digest
 * came from the server, which recorded it already (instrumentation.ts); the
 * browser only sees a redacted message for those.
 */
export function useReportError(error: Error & { digest?: string }) {
  useEffect(() => {
    console.error(error);
    if (error.digest) return;
    reportClientError({
      message: error.message,
      path: window.location.pathname,
    }).catch(() => {});
  }, [error]);
}
