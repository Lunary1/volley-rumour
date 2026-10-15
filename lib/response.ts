import { BLOCKED_ERROR_CODE, BLOCKED_MESSAGE } from "@/lib/blocks";
import { SUSPENDED_ERROR_CODE, SUSPENDED_MESSAGE } from "@/lib/sanctions";

/**
 * Standardized response format for server actions
 * All server actions should return responses in this format
 */

export type ActionResponse<T = void> =
  { success: true; data: T } | { success: false; error: string };

/**
 * Create a success response
 */
export function successResponse<T>(data: T): ActionResponse<T> {
  return { success: true, data };
}

/**
 * Create an error response
 */
export function errorResponse(error: string): ActionResponse<never> {
  return { success: false, error };
}

/**
 * Create an error response from an error object
 */
export function errorResponseFromError(err: unknown): ActionResponse<never> {
  if (err instanceof Error) {
    return errorResponse(err.message);
  }
  if (typeof err === "string") {
    return errorResponse(err);
  }
  return errorResponse("Er ging iets mis. Probeer het later opnieuw.");
}

/**
 * Extract error message from Supabase error or other error types
 */
export function extractErrorMessage(
  error: unknown,
  fallback = "Er ging iets mis. Probeer het later opnieuw.",
): string {
  if (!error) return fallback;

  if (typeof error === "string") return error;

  // A suspended user's write, refused by the database (#80).
  if ((error as { code?: string }).code === SUSPENDED_ERROR_CODE) {
    return SUSPENDED_MESSAGE;
  }

  // A message or conversation across a block, refused by the database (#73).
  if ((error as { code?: string }).code === BLOCKED_ERROR_CODE) {
    return BLOCKED_MESSAGE;
  }

  if (error instanceof Error) {
    // Check for Supabase specific error properties
    const err = error as Error & { code?: string };
    if (err.message) return err.message;
    if (err.code) {
      // Map common Supabase error codes
      const codeMap: Record<string, string> = {
        PGRST116: "Gegevens niet gevonden",
        "23505": "Dit item bestaat al",
        "23503": "Gerelateerde gegevens niet gevonden",
        "42P01": "Tabel niet gevonden (database fout)",
        "42703": "Kolom niet gevonden (database fout)",
      };
      return codeMap[err.code] || fallback;
    }
  }

  if (typeof error === "object" && error !== null) {
    const err = error as { message?: string; error_description?: string };
    if (err.message) return err.message;
    if (err.error_description) return err.error_description;
  }

  return fallback;
}
