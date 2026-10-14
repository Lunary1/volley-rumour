import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * A same-site path to send the user to after logging in, or "/" when `next`
 * is missing or points elsewhere ("//evil.example" and "/\evil.example" are
 * other sites to a browser).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || /^\/[/\\]/.test(next)) return "/";
  return next;
}
