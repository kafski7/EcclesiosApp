import {
  ChurchSettingsSchema,
  NotificationListSchema,
  OwnProfileSchema,
  PresignedUploadSchema,
  StaffListSchema,
  UnreadCountSchema,
  type OwnProfile,
  type UpdateChurchSettings,
  type UpdateOwnProfile,
} from "@ecclesios/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./query";
import { useSession } from "@/stores/session";

/** Own account, notifications, Users & Roles, Settings (functionality §4.6, §4.8–4.10, D-039). */

// ------------------------------------------------------------------ notifications

export function useUnread() {
  const principal = useSession((s) => s.principal);
  return useQuery({
    queryKey: ["notifications", "unread", principal?.id],
    queryFn: () => api.get("/me/notifications/unread", UnreadCountSchema),
    enabled: !!principal,
    refetchInterval: 60_000,
  });
}

export const useNotifications = (opts: { unread: boolean; church?: string; page: number }) =>
  useQuery({
    queryKey: ["notifications", "list", opts],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(opts.page) });
      if (opts.unread) p.set("unread", "1");
      if (opts.church) p.set("church", opts.church);
      return api.get(`/me/notifications?${p}`, NotificationListSchema);
    },
    placeholderData: keepPreviousData,
  });

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { ids?: string[]; church?: string }) =>
      api.post("/me/notifications/read", b, UnreadCountSchema),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["cms", "dashboard"] });
    },
  });
}

// ------------------------------------------------------------------ own profile

export const useOwnProfile = (enabled = true) =>
  useQuery({
    queryKey: ["me", "profile"],
    queryFn: () => api.get("/me/profile", OwnProfileSchema),
    enabled,
  });

function useProfileMutation<V>(fn: (v: V) => Promise<OwnProfile>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (p) => qc.setQueryData(["me", "profile"], p) });
}
export const useSaveOwnProfile = () =>
  useProfileMutation((b: UpdateOwnProfile) => api.put("/me/profile", b, OwnProfileSchema));
export const useOwnPhoto = () =>
  useProfileMutation(async (file: File | null) => {
    if (!file) return api.put("/me/photo", { key: null }, OwnProfileSchema);
    const signed = await api.post(
      "/me/photo-upload",
      { contentType: file.type, bytes: file.size },
      PresignedUploadSchema,
    );
    const r = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: file });
    if (!r.ok) throw new Error(`Upload failed (${r.status})`);
    return api.put("/me/photo", { key: signed.key }, OwnProfileSchema);
  });

// ------------------------------------------------------------------ Users & Roles, Settings

export const useStaff = (groupId: string) =>
  useQuery({
    queryKey: ["church", groupId, "staff"],
    queryFn: () => api.get(`/cms/groups/${groupId}/staff`, StaffListSchema),
  });

export const useChurchSettings = (groupId: string) =>
  useQuery({
    queryKey: ["church", groupId, "settings"],
    queryFn: () => api.get(`/cms/groups/${groupId}/settings`, ChurchSettingsSchema),
  });

export function useSaveChurchSettings(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: UpdateChurchSettings) =>
      api.put(`/cms/groups/${groupId}/settings`, b, ChurchSettingsSchema),
    onSuccess: (s) => qc.setQueryData(["church", groupId, "settings"], s),
  });
}
