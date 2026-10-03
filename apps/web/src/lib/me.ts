import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "./auth";
import { useSession } from "@/stores/session";

/** The signed-in member's profile, churches and follows (null for guests and platform accounts). */
export function useMe() {
  const principal = useSession((s) => s.principal);
  return useQuery({
    queryKey: ["me", principal?.id],
    queryFn: fetchMe,
    enabled: principal?.kind === "member",
    staleTime: 60_000,
  });
}
