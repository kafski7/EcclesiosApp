import { QueryClient } from "@tanstack/react-query";
import { ApiClientError, createApiClient } from "./api";
import { env } from "./env";
import { useSession } from "@/stores/session";

export const api = createApiClient({
  baseUrl: env.VITE_API_URL,
  getToken: () => useSession.getState().accessToken,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Retry network failures and 5xx only; a 4xx won't change on retry.
      retry: (count, err) =>
        count < 2 && !(err instanceof ApiClientError && err.status >= 400 && err.status < 500),
      refetchOnWindowFocus: false,
    },
  },
});
