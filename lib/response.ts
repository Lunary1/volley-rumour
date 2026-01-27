/**
 * Standardized response format for server actions
 * All server actions should return responses in this format
 */

export type ActionResponse<T = void> = 
  | { success: true; data: T }
  | { success: false; error: string };

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
export function extractErrorMessage(error: unknown, fallback = "Er ging iets mis. Probeer het later opnieuw."): string {
  if (!error) return fallback;
  
  if (typeof error === "string") return error;
  
  if (error instanceof Error) {
    // Check for Supabase specific error properties
    const err = error as any;
    if (err.message) return err.message;
    if (err.code) {
      // Map common Supabase error codes
      const codeMap: Record<string, string> = {
        "PGRST116": "Gegevens niet gevonden",
        "23505": "Dit item bestaat al",
        "23503": "Gerelateerde gegevens niet gevonden",
        "42P01": "Tabel niet gevonden (database fout)",
        "42703": "Kolom niet gevonden (database fout)",
      };
      return codeMap[err.code] || fallback;
    }
  }
  
  if (typeof error === "object" && error !== null) {
    const err = error as any;
    if (err.message) return err.message;
    if (err.error_description) return err.error_description;
  }
  
  return fallback;
}
