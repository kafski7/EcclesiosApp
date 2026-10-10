import {
  CollectionListSchema,
  FinanceSummarySchema,
  GroupListSchema,
  type CreateGroup,
  type RecordCollection,
  type UpdateGroup,
} from "@ecclesios/shared";
import type { CollectionStatus } from "@ecclesios/shared/domain";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "./query";

/** Groups, collections and the accounting link (functionality §4.12–4.13, D-041). */

const g = (groupId: string) => `/cms/groups/${groupId}`;

// ------------------------------------------------------------------ groups

export const useGroups = (groupId: string) =>
  useQuery({
    queryKey: ["groups", groupId],
    queryFn: () => api.get(`${g(groupId)}/children`, GroupListSchema),
  });

function useGroupMutation<V>(groupId: string, fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["groups", groupId] });
      void qc.invalidateQueries({ queryKey: ["cms"] });
    },
  });
}

export const useCreateGroup = (groupId: string) =>
  useGroupMutation(groupId, (b: CreateGroup) =>
    api.post(`${g(groupId)}/children`, b, GroupListSchema),
  );
export const useUpdateGroup = (groupId: string) =>
  useGroupMutation(groupId, ({ id, body }: { id: string; body: UpdateGroup }) =>
    api.put(`${g(groupId)}/children/${id}`, body, GroupListSchema),
  );
export const useGroupStatus = (groupId: string) =>
  useGroupMutation(groupId, ({ id, isActive }: { id: string; isActive: boolean }) =>
    api.post(`${g(groupId)}/children/${id}/status`, { isActive }, GroupListSchema),
  );

// ------------------------------------------------------------------ collections

export const useCollections = (groupId: string, status: CollectionStatus | null, page: number) =>
  useQuery({
    queryKey: ["collections", groupId, status, page],
    queryFn: () =>
      api.get(
        `${g(groupId)}/collections?page=${page}${status ? `&status=${status}` : ""}`,
        CollectionListSchema,
      ),
    placeholderData: keepPreviousData,
  });

export const useFinance = (groupId: string, enabled = true) =>
  useQuery({
    queryKey: ["collections", groupId, "finance"],
    queryFn: () => api.get(`${g(groupId)}/finance`, FinanceSummarySchema),
    enabled,
  });

function useCollectionMutation<V>(groupId: string, fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["collections", groupId] }),
  });
}

export const useRecordCollection = (groupId: string) =>
  useCollectionMutation(groupId, (b: RecordCollection) =>
    api.post(`${g(groupId)}/collections`, b, z.object({ id: z.string() })),
  );
export const useEditCollection = (groupId: string) =>
  useCollectionMutation(groupId, ({ id, body }: { id: string; body: RecordCollection }) =>
    api.putVoid(`${g(groupId)}/collections/${id}`, body),
  );
export const useDeleteCollection = (groupId: string) =>
  useCollectionMutation(groupId, (id: string) => api.delVoid(`${g(groupId)}/collections/${id}`));
export const useReviewCollection = (groupId: string) =>
  useCollectionMutation(
    groupId,
    ({ id, decision, note }: { id: string; decision: "approve" | "reject"; note?: string }) =>
      api.postVoid(`${g(groupId)}/collections/${id}/review`, { decision, note }),
  );
export const useRetryCollection = (groupId: string) =>
  useCollectionMutation(groupId, (id: string) =>
    api.postVoid(`${g(groupId)}/collections/${id}/retry`, {}),
  );

export const STATUS_TEXT: Record<CollectionStatus, { label: string; color: string }> = {
  PENDING: { label: "Waiting for the parish", color: "warning" },
  APPROVED: { label: "Approved — not yet in accounts", color: "info" },
  SYNCED: { label: "In accounts", color: "success" },
  SYNC_FAILED: { label: "Couldn't reach accounts", color: "danger" },
  REJECTED: { label: "Not approved", color: "secondary" },
};

/** "GHS", "1234.5" → "GH₵ 1,234.50" style without floats for the integer part. */
export function money(currency: string, amount: string) {
  const [whole = "0", cents = "00"] = amount.split(".");
  const symbol = currency === "GHS" ? "GH₵" : currency;
  return `${symbol} ${Number(whole).toLocaleString("en-GB")}.${cents.padEnd(2, "0").slice(0, 2)}`;
}
