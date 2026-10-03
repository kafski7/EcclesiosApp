import { describe, expect, it } from "vitest";
import { cmsNav, CREATOR_NAV, PLATFORM_NAV } from "./nav";

const labels = (n: ReturnType<typeof cmsNav>) => [...n.main, ...n.footer].map((i) => i.label);

describe("CMS sidebar per role × level (blueprint §3.3)", () => {
  it("parish Administrator sees everything, Billing included", () => {
    expect(labels(cmsNav("ADMINISTRATOR", "PARISH"))).toEqual([
      "Dashboard",
      "Members",
      "Birthdays",
      "Societies",
      "Committees",
      "Notifications",
      "Messages",
      "Users & Roles",
      "Settings",
      "Billing",
    ]);
  });
  it("outstation and deanery Administrators have no Billing (the parish holds it / not gated)", () => {
    expect(labels(cmsNav("ADMINISTRATOR", "OUTSTATION"))).not.toContain("Billing");
    expect(labels(cmsNav("ADMINISTRATOR", "DEANERY"))).not.toContain("Billing");
  });
  it("Managers: no Users, Settings or Billing", () => {
    const l = labels(cmsNav("MANAGER", "PARISH"));
    expect(l).toContain("Messages");
    for (const x of ["Users & Roles", "Settings", "Billing"]) expect(l).not.toContain(x);
  });
  it("Society-Leaders: rosters only, no Messages", () => {
    expect(labels(cmsNav("SOCIETY_LEADER", "PARISH"))).toEqual([
      "Dashboard",
      "Members",
      "Birthdays",
      "Societies",
      "Committees",
      "Notifications",
    ]);
  });
  it("Parishioners get nothing", () => {
    expect(labels(cmsNav("PARISHIONER", "PARISH"))).toEqual([]);
  });
  it("creators only see their studio", () => {
    expect(CREATOR_NAV.map((i) => i.label)).toEqual(["Podcasts", "Explore posts"]);
  });
  it("platform nav routes are unique", () => {
    expect(new Set(PLATFORM_NAV.map((i) => i.to)).size).toBe(PLATFORM_NAV.length);
  });
});
