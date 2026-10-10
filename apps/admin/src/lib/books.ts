import {
  BookSettingsSchema,
  PresignedUploadSchema,
  RefundListSchema,
  SellerListSchema,
  SellerStatementSchema,
  StudioBookListSchema,
  StudioBookSchema,
  type BookDecision,
  type BookStatus,
  type StudioBook,
  type UpsertBook,
} from "@ecclesios/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "./query";

export {
  BOOK_CATEGORIES,
  BOOK_CATEGORY_LABEL,
  formatPrice,
  parsePrice,
} from "@ecclesios/shared/domain";

const studio = "/studio/books";
const platform = "/platform/books";

// ------------------------------------------------------------------ seller studio

export const useMyBooks = () =>
  useQuery({ queryKey: ["books", "mine"], queryFn: () => api.get(studio, StudioBookListSchema) });
export const useMyBook = (slug: string | undefined) =>
  useQuery({
    queryKey: ["books", "one", slug],
    queryFn: () => api.get(`${studio}/${slug}`, StudioBookSchema),
    enabled: !!slug,
  });
export const useStatement = () =>
  useQuery({
    queryKey: ["books", "statement"],
    queryFn: () => api.get(`${studio}/statement`, SellerStatementSchema),
  });

function useBookMutation<V>(fn: (v: V) => Promise<StudioBook>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (b) => {
      qc.setQueryData(["books", "one", b.slug], b);
      void qc.invalidateQueries({ queryKey: ["books"], predicate: (q) => q.queryKey[1] !== "one" });
    },
  });
}

export const useSaveBook = (slug: string | undefined) =>
  useBookMutation((b: UpsertBook) =>
    slug
      ? api.put(`${studio}/${slug}`, b, StudioBookSchema)
      : api.post(studio, b, StudioBookSchema),
  );
export const useSetPrice = (slug: string) =>
  useBookMutation((priceMinor: number) =>
    api.put(`${studio}/${slug}/price`, { priceMinor }, StudioBookSchema),
  );
export const useBookStep = (slug: string) =>
  useBookMutation((step: "submit" | "unlist") =>
    api.post(`${studio}/${slug}/${step}`, {}, StudioBookSchema),
  );

export type BookPart = "file" | "preview" | "cover";

/** EPUB files often arrive without a MIME type: fall back on the extension. */
export function bookFileType(f: { type: string; name: string }): string {
  if (f.type) return f.type;
  const ext = f.name.split(".").pop()?.toLowerCase();
  return ext === "epub"
    ? "application/epub+zip"
    : ext === "pdf"
      ? "application/pdf"
      : "application/octet-stream";
}

/** Browser → storage (presigned PUT), then attach the key. */
export const useUploadBookPart = (slug: string) =>
  useBookMutation(async ({ part, file }: { part: BookPart; file: File | null }) => {
    if (!file) return api.put(`${studio}/${slug}/files`, { part, key: null }, StudioBookSchema);
    const contentType = bookFileType(file);
    const signed = await api.post(
      `${studio}/${slug}/upload`,
      { part, contentType, bytes: file.size },
      PresignedUploadSchema,
    );
    const res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: file });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return api.put(`${studio}/${slug}/files`, { part, key: signed.key }, StudioBookSchema);
  });

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.delVoid(`${studio}/${slug}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["books"] }),
  });
}

// ------------------------------------------------------------------ Super-Admin

export const useAllBooks = (status: BookStatus | null) =>
  useQuery({
    queryKey: ["books", "all", status],
    queryFn: () => api.get(`${platform}${status ? `?status=${status}` : ""}`, StudioBookListSchema),
  });

export const useDecideBook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, d }: { slug: string; d: BookDecision }) =>
      api.post(`${platform}/${slug}/decision`, d, StudioBookSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["books"] }),
  });
};

export const useBookSettings = () =>
  useQuery({
    queryKey: ["books", "settings"],
    queryFn: () => api.get(`${platform}/settings`, BookSettingsSchema),
  });
export function useSaveBookSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commissionBps: number) =>
      api.put(`${platform}/settings`, { commissionBps }, BookSettingsSchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["books"] }),
  });
}

export const useSellers = () =>
  useQuery({
    queryKey: ["books", "sellers"],
    queryFn: () => api.get(`${platform}/sellers`, SellerListSchema),
  });
export function useSellerActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["books"] });
  return {
    terms: useMutation({
      mutationFn: ({
        key,
        commissionBps,
        payoutTo,
      }: {
        key: string;
        commissionBps: number | null;
        payoutTo: string | null;
      }) => api.put(`${platform}/sellers/${key}`, { commissionBps, payoutTo }, SellerListSchema),
      onSuccess: done,
    }),
    payout: useMutation({
      mutationFn: ({
        key,
        amountMinor,
        reference,
      }: {
        key: string;
        amountMinor: number;
        reference: string;
      }) =>
        api.post(
          `${platform}/sellers/${key}/payouts`,
          { amountMinor, reference },
          SellerStatementSchema,
        ),
      onSuccess: done,
    }),
  };
}

export const useRefunds = () =>
  useQuery({
    queryKey: ["books", "refunds"],
    queryFn: () => api.get(`${platform}/refunds`, RefundListSchema),
  });
export function useRefundDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: "approve" | "decline";
      note: string;
    }) => api.post(`${platform}/refunds/${id}/decision`, { decision, note }, z.unknown()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["books"] }),
  });
}

/** 2000 → "20%", 1750 → "17.5%". */
export const bpsLabel = (bps: number) => `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
export const STATUS_COLOR = {
  DRAFT: "secondary",
  PENDING: "info",
  PUBLISHED: "success",
  REJECTED: "danger",
  UNLISTED: "warning",
} as const;
