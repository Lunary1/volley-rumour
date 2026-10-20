"use server";

import { z } from "zod";
import { cleanPath, isMonitoringOn, recordError } from "@/lib/error-monitoring";
import { successResponse, type ActionResponse } from "@/lib/response";

// Browser errors from the error pages (#186, D-041). Anyone can report one,
// logged in or not, so the input is capped here and the database caps how
// many new errors and alerts an hour can bring.
const clientErrorSchema = z.object({
  message: z.string().max(2000),
  path: z.string().max(2000),
});

export async function reportClientError(
  input: z.infer<typeof clientErrorSchema>,
): Promise<ActionResponse<null>> {
  const parsed = clientErrorSchema.safeParse(input);
  if (parsed.success && isMonitoringOn()) {
    await recordError({
      source: "client",
      kind: "client",
      route: cleanPath(parsed.data.path),
      message: parsed.data.message,
    });
  }
  // The visitor already sees the error page; nothing to tell them.
  return successResponse(null);
}
