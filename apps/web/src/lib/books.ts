import {
  BookListSchema,
  BookSchema,
  CheckoutResponseSchema,
  LibrarySchema,
  OrderSchema,
  ReadUrlSchema,
  type BookCategory,
} from "@ecclesios/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "./query";
import { useSession } from "@/stores/session";

export { BOOK_CATEGORIES, BOOK_CATEGORY_LABEL, formatPrice } from "@ecclesios/shared/domain";

export interface BookFilters {
  q: string;
  category: BookCategory | null;
  price: "free" | "paid" | null;
}

export const bookParams = (f: BookFilters, page: number) => {
  const p = new URLSearchParams({ page: String(page) });
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.category) p.set("category", f.category);
  if (f.price) p.set("price", f.price);
  return p.toString();
};

export function useBooks(f: BookFilters) {
  const principal = useSession((s) => s.principal);
  return useInfiniteQuery({
    queryKey: ["books", "list", f.q.trim(), f.category, f.price, principal?.id ?? null],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get(`/public/books?${bookParams(f, pageParam)}`, BookListSchema),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 60_000,
  });
}

export function useBook(slug: string | undefined) {
  const principal = useSession((s) => s.principal);
  return useQuery({
    queryKey: ["books", "one", slug, principal?.id ?? null],
    queryFn: () => api.get(`/public/books/${slug}`, BookSchema),
    enabled: !!slug,
  });
}

export function useLibrary() {
  const principal = useSession((s) => s.principal);
  return useQuery({ queryKey: ["books", "library", principal?.id], queryFn: () => api.get("/books/library", LibrarySchema), enabled: principal?.kind === "member" });
}

export const readUrl = (slug: string, preview: boolean) =>
  api.get(preview ? `/public/books/${slug}/preview` : `/books/${slug}/read`, ReadUrlSchema);

export const saveProgress = (slug: string, locator: string | null, percent: number) => api.putVoid(`/books/${slug}/progress`, { locator, percent });

export function useBookActions(slug: string) {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: ["books"] });
  return {
    /** Paid: go to Hubtel (or the test checkout in development). */
    checkout: useMutation({
      mutationFn: () => api.post(`/books/${slug}/checkout`, {}, CheckoutResponseSchema),
      onSuccess: (r) => window.location.assign(r.checkoutUrl),
    }),
    addFree: useMutation({ mutationFn: () => api.putVoid(`/books/${slug}/library`), onSuccess: done }),
    removeFree: useMutation({ mutationFn: () => api.delVoid(`/books/${slug}/library`), onSuccess: done }),
    refund: useMutation({ mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) => api.postVoid(`/books/orders/${orderId}/refund`, { reason }), onSuccess: done }),
  };
}

/** Order page after paying: polls until the payment is settled. */
export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["books", "order", id],
    queryFn: () => api.get(`/books/orders/${id}`, OrderSchema),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === "PENDING" ? 3000 : false),
  });
}

// development test checkout (D-036)
const TestSettleSchema = z.object({ orderId: z.string().uuid(), status: z.string() });
export const testOrder = (ref: string) => api.get(`/public/payments/test/${ref}`, OrderSchema);
export const testSettle = (ref: string, outcome: "paid" | "failed") => api.post(`/public/payments/test/${ref}`, { outcome }, TestSettleSchema);

/** Throttle progress saves: at most one every `ms`, always the latest value. */
export function throttleLatest<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;
  const run = () => {
    timer = null;
    last = Date.now();
    if (pending) fn(...pending);
    pending = null;
  };
  const call = (...a: A) => {
    pending = a;
    const wait = ms - (Date.now() - last);
    if (wait <= 0 && !timer) run();
    else if (!timer) timer = setTimeout(run, Math.max(0, wait));
  };
  call.flush = () => {
    if (timer) clearTimeout(timer);
    run();
  };
  return call;
}
