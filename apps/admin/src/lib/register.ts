import {
  BirthdayListSchema,
  HomeTransferRequestListSchema,
  MemberProfileSchema,
  MembershipRequestListSchema,
  PresignedUploadSchema,
  RegisterListSchema,
  type AddMember,
  type MemberProfile,
  type MembershipDecision,
  type PersonDetails,
} from "@ecclesios/shared";
import type { MemberRole } from "@ecclesios/shared/domain";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiClientError } from "./api";
import { env } from "./env";
import { api } from "./query";
import { useSession } from "@/stores/session";

/** Church register (functionality §4.2–4.3, D-037). */
export interface RegisterFilters {
  q: string;
  status: "ACTIVE" | "LEFT";
  role: MemberRole | null;
  missing: "baptism" | "communion" | "confirmation" | null;
  deceased: "include" | "only" | null;
  outstations: boolean;
}
export const EMPTY_FILTERS: RegisterFilters = {
  q: "",
  status: "ACTIVE",
  role: null,
  missing: null,
  deceased: null,
  outstations: false,
};

export function registerParams(f: RegisterFilters, page?: number) {
  const p = new URLSearchParams();
  if (page) p.set("page", String(page));
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.status !== "ACTIVE") p.set("status", f.status);
  if (f.role) p.set("role", f.role);
  if (f.missing) p.set("missing", f.missing);
  if (f.deceased) p.set("deceased", f.deceased);
  if (f.outstations) p.set("outstations", "1");
  return p.toString();
}

const g = (groupId: string) => `/cms/groups/${groupId}`;

export const useRegister = (groupId: string, f: RegisterFilters, page: number) =>
  useQuery({
    queryKey: ["register", groupId, registerParams(f, page)],
    queryFn: () => api.get(`${g(groupId)}/members?${registerParams(f, page)}`, RegisterListSchema),
    placeholderData: keepPreviousData,
  });

export const useProfile = (groupId: string, personId: string | undefined) =>
  useQuery({
    queryKey: ["register", groupId, "person", personId],
    queryFn: () => api.get(`${g(groupId)}/members/${personId}`, MemberProfileSchema),
    enabled: !!personId,
  });

function useProfileMutation<V>(groupId: string, fn: (v: V) => Promise<MemberProfile>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (p) => {
      qc.setQueryData(["register", groupId, "person", p.person.id], p);
      void qc.invalidateQueries({
        queryKey: ["register", groupId],
        predicate: (q) => q.queryKey[2] !== "person",
      });
      void qc.invalidateQueries({ queryKey: ["cms", "dashboard", groupId] });
    },
  });
}

export const useAddMember = (groupId: string) =>
  useProfileMutation(groupId, (b: AddMember) =>
    api.post(`${g(groupId)}/members`, b, MemberProfileSchema),
  );
export const useSaveMember = (groupId: string, personId: string) =>
  useProfileMutation(groupId, (b: PersonDetails) =>
    api.put(`${g(groupId)}/members/${personId}`, b, MemberProfileSchema),
  );
export const useChangeRole = (groupId: string, personId: string) =>
  useProfileMutation(groupId, (role: MemberRole) =>
    api.put(`${g(groupId)}/members/${personId}/role`, { role }, MemberProfileSchema),
  );
export const useSetPhoto = (groupId: string, personId: string) =>
  useProfileMutation(groupId, async (file: File | null) => {
    if (!file)
      return api.put(`${g(groupId)}/members/${personId}/photo`, { key: null }, MemberProfileSchema);
    const signed = await api.post(
      `${g(groupId)}/members/${personId}/photo-upload`,
      { contentType: file.type, bytes: file.size },
      PresignedUploadSchema,
    );
    const r = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: file });
    if (!r.ok) throw new Error(`Upload failed (${r.status})`);
    return api.put(
      `${g(groupId)}/members/${personId}/photo`,
      { key: signed.key },
      MemberProfileSchema,
    );
  });

export function useRemoveMember(groupId: string, personId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      api.postVoid(`${g(groupId)}/members/${personId}/remove`, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["register", groupId] });
      void qc.invalidateQueries({ queryKey: ["cms", "dashboard", groupId] });
    },
  });
}

/** The CSV needs the Bearer token, so it can't be a plain link. */
export async function downloadCsv(groupId: string, f: RegisterFilters, fileName: string) {
  const token = useSession.getState().accessToken;
  const res = await fetch(`${env.VITE_API_URL}${g(groupId)}/members.csv?${registerParams(f)}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok)
    throw new ApiClientError(res.status, `HTTP_${res.status}`, "The export could not be created.");
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ------------------------------------------------------------------ requests (Phase 3.5 API)

export const useRequests = (groupId: string) =>
  useQuery({
    queryKey: ["register", groupId, "requests"],
    queryFn: () => api.get(`/groups/${groupId}/membership-requests`, MembershipRequestListSchema),
  });

export function useDecide(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, d }: { id: string; d: MembershipDecision }) =>
      api.post(`/membership-requests/${id}/decision`, d, z.unknown()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["register", groupId] });
      void qc.invalidateQueries({ queryKey: ["cms", "dashboard", groupId] });
    },
  });
}

// ------------------------------------------------------------------ home-church transfers (D-049)

export const useHomeTransfers = (groupId: string) =>
  useQuery({
    queryKey: ["register", groupId, "home-transfers"],
    queryFn: () => api.get(`/groups/${groupId}/home-transfers`, HomeTransferRequestListSchema),
  });

export function useDecideTransfer(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, d }: { id: string; d: MembershipDecision }) =>
      api.post(`/home-transfers/${id}/decision`, d, z.unknown()),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["register", groupId] }),
  });
}

// ------------------------------------------------------------------ birthdays

/** The browser's local date (birthdays are about the viewer's "today"). */
export const localToday = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const useBirthdays = (groupId: string, days: number, outstations: boolean) =>
  useQuery({
    queryKey: ["register", groupId, "birthdays", days, outstations],
    queryFn: () =>
      api.get(
        `${g(groupId)}/birthdays?days=${days}&today=${localToday()}${outstations ? "&outstations=1" : ""}`,
        BirthdayListSchema,
      ),
  });

export const ROLE_LABEL: Record<MemberRole, string> = {
  ADMINISTRATOR: "Administrator",
  MANAGER: "Manager",
  SOCIETY_LEADER: "Society leader",
  PARISHIONER: "Parishioner",
};

export const whenLabel = (inDays: number) =>
  inDays === 0 ? "Today" : inDays === 1 ? "Tomorrow" : `In ${inDays} days`;
