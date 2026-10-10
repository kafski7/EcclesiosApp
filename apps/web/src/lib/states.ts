import { ApiClientError } from "./api";

/**
 * Text for an error state (D-043): offline, rate-limited, the API's own message for a 4xx
 * (those are written for people), else the page's fallback. 5xx details are never shown.
 */
export function errorText(
  error: unknown,
  fallback: string,
  online: boolean = typeof navigator === "undefined" || navigator.onLine !== false,
): string {
  if (!online) return "You're offline. Check your connection.";
  if (error instanceof ApiClientError) {
    if (error.status === 429) return "Too many requests — wait a moment.";
    if (error.status >= 400 && error.status < 500 && error.message) return error.message;
  }
  return fallback;
}
