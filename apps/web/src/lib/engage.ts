import {
  EngageStateListSchema,
  EngageStateSchema,
  SavedListSchema,
  type EngageState,
} from "@ecclesios/shared";
import { engageKey, type EngageKind } from "@ecclesios/shared/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./query";
import { useSession } from "@/stores/session";

/**
 * Batches like/save lookups (D-035): every card asks for its own key; requests made in the same
 * tick are sent as one GET /public/engage?items=… (≤100 keys).
 */
type Pending = { key: string; resolve: (s: EngageState) => void; reject: (e: unknown) => void };

export function createBatcher(fetchMany: (keys: string[]) => Promise<EngageState[]>, max = 100) {
  let q: Pending[] = [];
  let pending = false;
  return (key: string) =>
    new Promise<EngageState>((resolve, reject) => {
      q.push({ key, resolve, reject });
      if (pending) return;
      pending = true;
      queueMicrotask(async () => {
        const batch = q;
        q = [];
        pending = false;
        const keys = [...new Set(batch.map((b) => b.key))];
        for (let i = 0; i < keys.length; i += max) {
          const part = keys.slice(i, i + max);
          try {
            const got = await fetchMany(part);
            for (const b of batch.filter((x) => part.includes(x.key)))
              b.resolve(
                got.find((g) => g.key === b.key) ?? {
                  key: b.key,
                  likes: 0,
                  liked: false,
                  saved: false,
                },
              );
          } catch (e) {
            for (const b of batch.filter((x) => part.includes(x.key))) b.reject(e);
          }
        }
      });
    });
}

const load = createBatcher(
  async (keys) =>
    (await api.get(`/public/engage?items=${keys.join(",")}`, EngageStateListSchema)).items,
);

export function useEngage(kind: EngageKind, id: string) {
  const principal = useSession((s) => s.principal);
  const key = engageKey(kind, id);
  return useQuery({
    queryKey: ["engage", key, principal?.id ?? null],
    queryFn: () => load(key),
    staleTime: 60_000,
  });
}

/** The optimistic state after a like/save tap (D-035). Repeating the current state is a no-op. */
export function applyToggle(prev: EngageState, type: "like" | "save", on: boolean): EngageState {
  if (type === "save") return { ...prev, saved: on };
  if (on === prev.liked) return prev;
  return { ...prev, liked: on, likes: Math.max(0, prev.likes + (on ? 1 : -1)) };
}

/** Short status text after Share, or null when the share sheet handled it (D-043). */
export function shareNote(r: "shared" | "copied" | "failed"): string | null {
  return r === "copied"
    ? "Link copied"
    : r === "failed"
      ? "Couldn't share — copy the address instead"
      : null;
}

export function useEngageToggle(kind: EngageKind, id: string) {
  const qc = useQueryClient();
  const principal = useSession((s) => s.principal);
  const key = engageKey(kind, id);
  const cacheKey = ["engage", key, principal?.id ?? null];
  return useMutation({
    mutationFn: ({ type, on }: { type: "like" | "save"; on: boolean }) =>
      on
        ? api.put(`/engage/${kind}/${id}/${type}`, undefined, EngageStateSchema)
        : api.del(`/engage/${kind}/${id}/${type}`, EngageStateSchema),
    // Optimistic: flip at once, roll back on error.
    onMutate: async ({ type, on }) => {
      await qc.cancelQueries({ queryKey: cacheKey });
      const prev = qc.getQueryData<EngageState>(cacheKey);
      if (prev) qc.setQueryData<EngageState>(cacheKey, applyToggle(prev, type, on));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(cacheKey, ctx.prev),
    onSuccess: (s, { type }) => {
      qc.setQueryData(cacheKey, s);
      if (type === "save") void qc.invalidateQueries({ queryKey: ["engage", "saved"] });
    },
  });
}

export function useSaved() {
  const principal = useSession((s) => s.principal);
  return useQuery({
    queryKey: ["engage", "saved", principal?.id],
    queryFn: () => api.get("/engage/saved", SavedListSchema),
    enabled: principal?.kind === "member",
  });
}

/** Phone share sheet when available, else copy the link. Returns what happened. */
export async function shareLink(
  title: string,
  path: string,
): Promise<"shared" | "copied" | "failed"> {
  const url = new URL(path, window.location.origin).toString();
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return "shared";
    }
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch (e) {
    // The person closed the share sheet: not an error.
    if (e instanceof DOMException && e.name === "AbortError") return "shared";
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      return "failed";
    }
  }
}
