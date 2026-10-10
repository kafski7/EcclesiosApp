import type { ChurchOption, ChurchRef, MeResponse } from "@ecclesios/shared";
import { useQuery } from "@tanstack/react-query";
import { searchChurches } from "./auth";

/**
 * Churches on Explore (docs/social.md §9.4 "parish and broader Church content", D-044):
 * the member's own churches as shortcuts, and a public search to find any parish or outstation.
 */

export interface MyChurch {
  id: string;
  name: string;
  /** Why it's listed: home church, another membership, or followed. */
  why: "home" | "member" | "follow";
}

/** Home church first, then other live memberships, then follows — each church once. */
export function myChurches(me: MeResponse | undefined): MyChurch[] {
  if (!me) return [];
  const seen = new Set<string>();
  const out: MyChurch[] = [];
  const add = (c: ChurchRef, why: MyChurch["why"]) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    out.push({ id: c.id, name: c.name, why });
  };
  const live = me.memberships.filter((m) => m.status === "ACTIVE" || m.status === "PENDING");
  for (const m of live) if (m.isHome) add(m.church, "home");
  for (const m of live) add(m.church, "member");
  for (const f of me.follows) add(f, "follow");
  return out;
}

/** "St Paul's parish · Tema Deanery · Archdiocese of Accra" — where a church sits. */
export function churchPlace(c: ChurchOption): string {
  const parts = [
    c.level === "OUTSTATION" && c.parish
      ? `Outstation of ${c.parish}`
      : c.level === "PARISH"
        ? "Parish"
        : null,
    c.deanery,
    c.diocese,
  ];
  return parts.filter(Boolean).join(" · ");
}

export const CHURCH_SEARCH_MIN = 2;

export function useChurchSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ["churches", "search", term],
    queryFn: () => searchChurches(term),
    enabled: term.length >= CHURCH_SEARCH_MIN,
    staleTime: 5 * 60_000,
  });
}
