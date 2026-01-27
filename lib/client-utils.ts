import { toast } from "sonner";
import { ActionResponse } from "@/lib/response";

/**
 * Handle server action response and show toast
 * Returns the data if successful, or undefined if error (toast already shown)
 */
export function handleServerActionResponse<T>(
  response: ActionResponse<T>,
  {
    successMessage = "Succesvol!",
    errorMessage,
    showSuccess = true,
  }: {
    successMessage?: string;
    errorMessage?: string;
    showSuccess?: boolean;
  } = {},
): T | undefined {
  if (response.success) {
    if (showSuccess) {
      toast.success(successMessage);
    }
    return response.data;
  } else {
    toast.error(errorMessage || response.error);
    return undefined;
  }
}
