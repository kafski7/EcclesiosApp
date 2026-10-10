import { describe, expect, it } from "vitest";
import {
  canManagePost,
  canPostAsChurch,
  canPostAsSelf,
  InvalidPostTransition,
  nextPostStatus,
  postProblems,
  submitSkipsQueue,
  type ExploreActor,
} from "./explore.js";
import { makeTree } from "./fixture.js";

const { g } = makeTree();
const priest: ExploreActor & { id: string } = {
  id: "m1",
  kind: "member",
  privileges: [],
  memberships: [{ group: g("parA1"), role: "ADMINISTRATOR", status: "ACTIVE" }],
};
const curate: ExploreActor & { id: string } = { ...priest, id: "m9" }; // second Administrator of the same parish
const creator: ExploreActor & { id: string } = {
  id: "m2",
  kind: "member",
  privileges: ["AUTHOR_EXPLORE"],
  memberships: [],
};
const admin: ExploreActor & { id: string } = {
  id: "u1",
  kind: "user",
  role: "SUPER_ADMIN",
  privileges: [],
};

describe("post workflow (D-031)", () => {
  it("draft → pending → approved → removed", () => {
    expect(nextPostStatus("DRAFT", "submit")).toBe("PENDING");
    expect(nextPostStatus("PENDING", "approve")).toBe("APPROVED");
    expect(nextPostStatus("PENDING", "reject")).toBe("REJECTED");
    expect(nextPostStatus("APPROVED", "remove")).toBe("REMOVED");
  });
  it("editing goes back to draft; removed is final", () => {
    for (const s of ["PENDING", "APPROVED", "REJECTED"] as const)
      expect(nextPostStatus(s, "edit")).toBe("DRAFT");
    expect(() => nextPostStatus("REMOVED", "edit")).toThrow(InvalidPostTransition);
    expect(() => nextPostStatus("DRAFT", "approve")).toThrow(InvalidPostTransition);
  });
  it("only Super-Admins skip the queue", () => {
    expect([admin, priest, creator].map(submitSkipsQueue)).toEqual([true, false, false]);
  });
});

describe("who manages a post", () => {
  const churchPost = { authorUserId: null, authorMemberId: "m1", churchId: g("parA1").id };
  const ownPost = { authorUserId: null, authorMemberId: "m2", churchId: null };
  it("church posts belong to the church's Administrators", () => {
    expect(canPostAsChurch(priest, g("parA1").id)).toBe(true);
    expect(canManagePost(curate, churchPost)).toBe(true);
    expect(canManagePost(creator, churchPost)).toBe(false);
  });
  it("personal posts belong to their author; Super-Admins manage all", () => {
    expect(canManagePost(creator, ownPost)).toBe(true);
    expect(canManagePost(priest, ownPost)).toBe(false);
    expect(canManagePost(admin, ownPost)).toBe(true);
    expect(canPostAsSelf(priest)).toBe(false);
  });
});

describe("postProblems", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 10, h));
  it("events need a start and a place, and must end after they start", () => {
    expect(postProblems("EVENT", "x", { startsAt: null, endsAt: null, place: "" })).toHaveLength(2);
    expect(postProblems("EVENT", "x", { startsAt: at(10), endsAt: at(9), place: "Hall" })).toEqual([
      "The event must end after it starts.",
    ]);
    expect(postProblems("EVENT", "x", { startsAt: at(10), endsAt: at(12), place: "Hall" })).toEqual(
      [],
    );
  });
  it("articles only need a body", () => {
    expect(
      postProblems("ARTICLE", "  ", { startsAt: null, endsAt: null, place: null }),
    ).toHaveLength(1);
  });
});
