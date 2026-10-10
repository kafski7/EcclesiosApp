import {
  HomeTransferResponseSchema,
  JoinResponseSchema,
  type MeResponse,
  type MyMembership,
} from "@ecclesios/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./query";

/**
 * Your churches on the social platform (docs/social.md §6.3, §9.13, D-049): join, leave, follow,
 * and move your home church. The API has had join/leave/follow since D-015; the home transfer
 * endpoints are new (D-049).
 */

/** Where the signed-in person stands with one church — drives the church page's button. */
export type ChurchStanding = "home" | "member" | "pending" | "none";

export function standingWith(me: MeResponse | undefined, churchId: string): ChurchStanding {
  const m = me?.memberships.find((x) => x.church.id === churchId);
  if (!m) return "none";
  if (m.status === "PENDING") return "pending";
  return m.isHome ? "home" : "member";
}

export interface ChurchRow {
  m: MyMembership;
  /** A transfer to this church is waiting. */
  transferWaiting: boolean;
  /** "Make this my home church" can be offered. */
  canMakeHome: boolean;
}

/**
 * The person's churches for "Your churches": home first, then active, then pending, each by name.
 * Moving home is offered for active, non-home churches while no transfer is waiting.
 */
export function churchRows(me: MeResponse | undefined): ChurchRow[] {
  if (!me) return [];
  const rank = (m: MyMembership) => (m.isHome && m.status === "ACTIVE" ? 0 : m.status === "ACTIVE" ? 1 : 2);
  const open = me.homeTransfer;
  return [...me.memberships]
    .sort((a, b) => rank(a) - rank(b) || a.church.name.localeCompare(b.church.name))
    .map((m) => ({
      m,
      transferWaiting: open?.to.id === m.church.id,
      canMakeHome: !open && m.status === "ACTIVE" && !m.isHome,
    }));
}

/** Churches followed without being a member (members already follow their churches). */
export function followOnly(me: MeResponse | undefined) {
  if (!me) return [];
  const mine = new Set(me.memberships.map((m) => m.church.id));
  return me.follows.filter((f) => !mine.has(f.id));
}

export const ROLE_LABEL: Record<MyMembership["role"], string> = {
  ADMINISTRATOR: "Administrator",
  MANAGER: "Manager",
  SOCIETY_LEADER: "Society leader",
  PARISHIONER: "Parishioner",
};

// ------------------------------------------------------------------ mutations

function useRefreshMe() {
  const qc = useQueryClient();
  return (churchId?: string) => {
    void qc.invalidateQueries({ queryKey: ["me"] });
    if (churchId) void qc.invalidateQueries({ queryKey: ["explore", "church", churchId] });
  };
}

export function useMembershipActions() {
  const refresh = useRefreshMe();
  return {
    join: useMutation({
      mutationFn: (churchId: string) => api.post(`/groups/${churchId}/join`, {}, JoinResponseSchema),
      onSuccess: (_r, churchId) => refresh(churchId),
    }),
    /** Leave a church, or cancel a pending request (same endpoint). */
    leave: useMutation({
      mutationFn: (churchId: string) => api.delVoid(`/groups/${churchId}/membership`),
      onSuccess: (_r, churchId) => refresh(churchId),
    }),
    unfollow: useMutation({
      mutationFn: (churchId: string) => api.delVoid(`/groups/${churchId}/follow`),
      onSuccess: (_r, churchId) => refresh(churchId),
    }),
    requestHome: useMutation({
      mutationFn: (b: { toGroupId: string; reason?: string }) =>
        api.post("/me/home-transfer", b, HomeTransferResponseSchema),
      onSuccess: () => refresh(),
    }),
    cancelHome: useMutation({
      mutationFn: () => api.delVoid("/me/home-transfer"),
      onSuccess: () => refresh(),
    }),
  };
}
