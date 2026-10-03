import {
  CmsContextsResponseSchema,
  CmsDashboardSchema,
  PlansResponseSchema,
  PlatformOverviewSchema,
  PlatformSubscriptionListSchema,
  SubscriptionSummarySchema,
  type CmsContext,
  type GrantSubscriptionRequest,
  type PlanCode,
} from "@ecclesios/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";
import { api } from "./query";
import { useSession } from "@/stores/session";

export const keys = {
  contexts: (personId?: string) => ["cms", "contexts", personId] as const,
  dashboard: (groupId: string) => ["cms", "dashboard", groupId] as const,
  plans: ["plans"] as const,
  overview: ["platform", "overview"] as const,
  subscriptions: ["platform", "subscriptions"] as const,
};

export function useContexts() {
  const principal = useSession((s) => s.principal);
  return useQuery({
    queryKey: keys.contexts(principal?.id),
    queryFn: () => api.get("/cms/contexts", CmsContextsResponseSchema),
    enabled: principal?.kind === "member",
  });
}

/** The selected church, provided by CmsLayout to every CMS page. */
export const useCurrent = () => useOutletContext<CmsContext>();

export function useDashboard(groupId: string, enabled = true) {
  return useQuery({
    queryKey: keys.dashboard(groupId),
    queryFn: () => api.get(`/cms/groups/${groupId}/dashboard`, CmsDashboardSchema),
    enabled,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: keys.plans,
    queryFn: () => api.get("/public/plans", PlansResponseSchema),
    staleTime: 10 * 60_000,
  });
}

export function useStartTrial(parishId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planCode: PlanCode) =>
      api.post(`/groups/${parishId}/subscription/trial`, { planCode }, SubscriptionSummarySchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cms"] }),
  });
}

export function useOverview() {
  return useQuery({
    queryKey: keys.overview,
    queryFn: () => api.get("/platform/overview", PlatformOverviewSchema),
  });
}

export function usePlatformSubscriptions() {
  return useQuery({
    queryKey: keys.subscriptions,
    queryFn: () => api.get("/platform/subscriptions", PlatformSubscriptionListSchema),
  });
}

export function useGrantSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GrantSubscriptionRequest) =>
      api.post("/platform/subscriptions", body, SubscriptionSummarySchema),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform"] }),
  });
}

export const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export const formatMoney = (amount: string, currency: string) =>
  Number(amount) === 0
    ? "Free"
    : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(Number(amount));

export const LEVEL_LABEL: Record<string, string> = {
  PROVINCE: "Province",
  ARCHDIOCESE: "Archdiocese",
  DIOCESE: "Diocese",
  DEANERY: "Deanery",
  PARISH: "Parish",
  OUTSTATION: "Outstation",
};

export const ROLE_LABEL: Record<string, string> = {
  ADMINISTRATOR: "Administrator",
  MANAGER: "Manager",
  SOCIETY_LEADER: "Society-Leader",
  PARISHIONER: "Parishioner",
  SUPER_ADMIN: "Super-Admin",
  CREATOR: "Creator",
};
