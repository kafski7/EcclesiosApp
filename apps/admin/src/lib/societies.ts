import {
  CandidateListSchema,
  SocietyListSchema,
  SocietySchema,
  type CreateSociety,
  type Society,
  type UpsertSociety,
} from "@ecclesios/shared";
import type { SocietyKind } from "@ecclesios/shared/domain";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "./api";
import { env } from "./env";
import { api } from "./query";
import { useSession } from "@/stores/session";

export { SUGGESTED_POSITIONS } from "@ecclesios/shared/domain";

/** Societies & committees (functionality §4.4–4.5, D-038). */
const base = (groupId: string) => `/cms/groups/${groupId}/societies`;

export const KIND_TEXT: Record<SocietyKind, { one: string; many: string; path: string }> = {
  SOCIETY: { one: "society", many: "Societies", path: "/admin/societies" },
  COMMITTEE: { one: "committee", many: "Committees", path: "/admin/committees" },
};

export const useSocieties = (groupId: string, kind: SocietyKind, archived: boolean) =>
  useQuery({
    queryKey: ["societies", groupId, kind, archived],
    queryFn: () =>
      api.get(`${base(groupId)}?kind=${kind}${archived ? "&archived=1" : ""}`, SocietyListSchema),
    placeholderData: keepPreviousData,
  });

export const useSociety = (groupId: string, id: string | undefined) =>
  useQuery({
    queryKey: ["societies", groupId, "one", id],
    queryFn: () => api.get(`${base(groupId)}/${id}`, SocietySchema),
    enabled: !!id,
  });

export const useCandidates = (groupId: string, id: string, q: string, enabled: boolean) =>
  useQuery({
    queryKey: ["societies", groupId, "candidates", id, q],
    queryFn: () =>
      api.get(`${base(groupId)}/${id}/candidates?q=${encodeURIComponent(q)}`, CandidateListSchema),
    enabled,
    placeholderData: keepPreviousData,
  });

function useSocietyMutation<V>(groupId: string, fn: (v: V) => Promise<Society>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (s) => {
      qc.setQueryData(["societies", groupId, "one", s.id], s);
      void qc.invalidateQueries({
        queryKey: ["societies", groupId],
        predicate: (q) => q.queryKey[2] !== "one",
      });
      void qc.invalidateQueries({ queryKey: ["cms", "dashboard", groupId] });
      void qc.invalidateQueries({ queryKey: ["register", groupId] }); // a leader may have been promoted
    },
  });
}

export const useCreateSociety = (groupId: string) =>
  useSocietyMutation(groupId, (b: CreateSociety) => api.post(base(groupId), b, SocietySchema));
export const useSaveSociety = (groupId: string, id: string) =>
  useSocietyMutation(groupId, (b: UpsertSociety) =>
    api.put(`${base(groupId)}/${id}`, b, SocietySchema),
  );
export const useArchive = (groupId: string, id: string) =>
  useSocietyMutation(groupId, (archive: boolean) =>
    api.post(`${base(groupId)}/${id}/${archive ? "archive" : "restore"}`, {}, SocietySchema),
  );
export const useAddToRoster = (groupId: string, id: string) =>
  useSocietyMutation(groupId, (b: { personId: string; position: string | null }) =>
    api.post(`${base(groupId)}/${id}/roster`, b, SocietySchema),
  );
export const useSetPosition = (groupId: string, id: string) =>
  useSocietyMutation(groupId, (b: { personId: string; position: string | null }) =>
    api.put(`${base(groupId)}/${id}/roster/${b.personId}`, { position: b.position }, SocietySchema),
  );
export const useRemoveFromRoster = (groupId: string, id: string) =>
  useSocietyMutation(groupId, (personId: string) =>
    api.del(`${base(groupId)}/${id}/roster/${personId}`, SocietySchema),
  );

export function useDeleteSociety(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delVoid(`${base(groupId)}/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["societies", groupId] });
      void qc.invalidateQueries({ queryKey: ["cms", "dashboard", groupId] });
    },
  });
}

/** The CSV needs the Bearer token, so it can't be a plain link. */
export async function downloadRoster(groupId: string, id: string, fileName: string) {
  const token = useSession.getState().accessToken;
  const res = await fetch(`${env.VITE_API_URL}${base(groupId)}/${id}/roster.csv`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok)
    throw new ApiClientError(res.status, `HTTP_${res.status}`, "The export could not be created.");
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement("a"), { href: url, download: fileName }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "St Theresa Parish" + "Catholic Youth Organisation" → "st-theresa-parish-catholic-youth-organisation.csv" */
export const rosterFileName = (church: string, society: string) =>
  `${`${church} ${society}`
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()}.csv`;
