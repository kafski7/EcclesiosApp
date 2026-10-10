import {
  NotificationListSchema,
  NotificationPreferencesSchema,
  type UpdateNotificationPreferences,
  OwnProfileSchema,
  PresignedUploadSchema,
  UnreadCountSchema,
  type OwnProfile,
  type UpdateOwnProfile,
} from "@ecclesios/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./query";
import { useSession } from "@/stores/session";

/** Notifications and own account in the app (functionality §4.6, §4.9, D-039). */

export function useUnread() {
  const principal = useSession((s) => s.principal);
  return useQuery({
    queryKey: ["notifications", "unread", principal?.id],
    queryFn: () => api.get("/me/notifications/unread", UnreadCountSchema),
    enabled: !!principal,
    refetchInterval: 60_000,
  });
}

export function useNotifications(unread: boolean) {
  const principal = useSession((s) => s.principal);
  return useInfiniteQuery({
    queryKey: ["notifications", "list", principal?.id, unread],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get(
        `/me/notifications?page=${pageParam}${unread ? "&unread=1" : ""}`,
        NotificationListSchema,
      ),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!principal,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) =>
      api.post("/me/notifications/read", ids ? { ids } : {}, UnreadCountSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

/** CMS links (/admin/…) belong to the Church Management app, not this one. */
export const isCmsLink = (link: string | null) => !!link && link.startsWith("/admin");

export const useOwnProfile = () => {
  const principal = useSession((s) => s.principal);
  return useQuery({
    queryKey: ["me", "profile"],
    queryFn: () => api.get("/me/profile", OwnProfileSchema),
    enabled: principal?.kind === "member",
  });
};

function useProfileMutation<V>(fn: (v: V) => Promise<OwnProfile>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (p) => qc.setQueryData(["me", "profile"], p) });
}
export const useSaveOwnProfile = () =>
  useProfileMutation((b: UpdateOwnProfile) => api.put("/me/profile", b, OwnProfileSchema));
export const useOwnPhoto = () =>
  useProfileMutation(async (file: File) => {
    const signed = await api.post(
      "/me/photo-upload",
      { contentType: file.type, bytes: file.size },
      PresignedUploadSchema,
    );
    const r = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: file });
    if (!r.ok) throw new Error(`Upload failed (${r.status})`);
    return api.put("/me/photo", { key: signed.key }, OwnProfileSchema);
  });

/** Which notifications you get (D-052). */
export const useNotificationPreferences = () => {
  const principal = useSession((s) => s.principal);
  return useQuery({
    queryKey: ["me", "notification-preferences"],
    queryFn: () => api.get("/me/notification-preferences", NotificationPreferencesSchema),
    enabled: principal?.kind === "member",
  });
};

export function useSaveNotificationPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: UpdateNotificationPreferences) =>
      api.put("/me/notification-preferences", b, NotificationPreferencesSchema),
    onSuccess: (d) => qc.setQueryData(["me", "notification-preferences"], d),
  });
}
