import { describe, expect, it } from "vitest";
import { makeTree } from "./fixture.js";
import {
  BROADCAST_LEVELS,
  birthdayDigestLine,
  broadcastLevelsFor,
  canBroadcast,
  estimateSegments,
  finalMessageStatus,
  inBroadcastReach,
  isDelivered,
  isMutableType,
  localIsoDate,
  personalize,
  smsEncoding,
  smsLength,
  smsRefund,
  smsSegments,
} from "./messaging.js";

describe("SMS parts (D-051)", () => {
  it("GSM-7: 160 in one part, then 153 per part", () => {
    expect(smsSegments("")).toBe(0);
    expect(smsSegments("a".repeat(160))).toBe(1);
    expect(smsSegments("a".repeat(161))).toBe(2);
    expect(smsSegments("a".repeat(306))).toBe(2);
    expect(smsSegments("a".repeat(307))).toBe(3);
  });
  it("extension characters count twice", () => {
    expect(smsEncoding("Price: €5 [ok]")).toBe("GSM7");
    expect(smsLength("€")).toBe(2);
    expect(smsSegments("€".repeat(80))).toBe(1);
    expect(smsSegments("€".repeat(81))).toBe(2);
  });
  it("anything outside GSM-7 switches to UCS-2: 70, then 67 per part", () => {
    expect(smsEncoding("Akwaaba 🙏")).toBe("UCS2");
    expect(smsEncoding("Ɔdɔ")).toBe("UCS2");
    expect(smsSegments("ɔ".repeat(70))).toBe(1);
    expect(smsSegments("ɔ".repeat(71))).toBe(2);
    expect(smsSegments("ɔ".repeat(134))).toBe(2);
    expect(smsSegments("ɔ".repeat(135))).toBe(3);
  });
  it("personalising fills both placeholders; estimates err high", () => {
    expect(personalize("Dear {firstName}, {church} greets you.", { firstName: "Ama", church: "St Theresa" })).toBe(
      "Dear Ama, St Theresa greets you.",
    );
    expect(personalize("{other} stays", { firstName: "x", church: "y" })).toBe("{other} stays");
    const t = `${"a".repeat(150)}{firstName}`;
    expect(estimateSegments(t, "X")).toBe(2);
    expect(smsSegments(personalize(t, { firstName: "Ama", church: "X" }))).toBe(1);
  });
  it("refunds what failed", () => {
    expect(smsRefund([1, 2, 1])).toBe(4);
    expect(smsRefund([])).toBe(0);
  });
  it("final status from counts", () => {
    expect(finalMessageStatus(3, 0)).toBe("SENT");
    expect(finalMessageStatus(3, 1)).toBe("PARTIAL");
    expect(finalMessageStatus(0, 2)).toBe("FAILED");
    expect(finalMessageStatus(0, 0)).toBe("FAILED");
  });
});

describe("broadcast reach (blueprint §3.3)", () => {
  const { g, lookup } = makeTree();
  const reach = (from: string, to: string, levels = BROADCAST_LEVELS[g(from).level]) =>
    inBroadcastReach(g(from), g(to), levels, lookup);

  it("parish → its own outstations only", () => {
    expect(reach("parA1", "outA1a")).toBe(true);
    expect(reach("parA1", "outA2a")).toBe(false);
    expect(reach("parA1", "parA1")).toBe(false);
  });
  it("deanery → its parishes and their outstations, not the neighbour deanery", () => {
    expect(reach("deanA", "parA1")).toBe(true);
    expect(reach("deanA", "outA1b")).toBe(true);
    expect(reach("deanA", "parB1")).toBe(false);
    expect(reach("deanA", "outA1a", ["PARISH"])).toBe(false);
  });
  it("diocese → everything under it", () => {
    expect(reach("dio", "deanB")).toBe(true);
    expect(reach("dio", "outA2a")).toBe(true);
    expect(reach("dio", "archPar")).toBe(false);
  });
  it("metropolitan archdiocese → its own territory, never into a suffragan", () => {
    expect(reach("arch", "archPar")).toBe(true);
    expect(reach("arch", "dio")).toBe(false);
    expect(reach("arch", "parA1")).toBe(false);
    const detailed = makeTree("detailed");
    expect(inBroadcastReach(detailed.g("arch"), detailed.g("parA1"), ["PARISH"], detailed.lookup)).toBe(false);
  });
  it("province → the nation, suffragans included", () => {
    expect(reach("prov", "parA1")).toBe(true);
    expect(reach("prov", "dio")).toBe(true);
  });
  it("outstations and upward targets are never reached", () => {
    expect(canBroadcast("OUTSTATION")).toBe(false);
    expect(reach("parA1", "deanA")).toBe(false);
    expect(reach("outA1a", "parA1")).toBe(false);
  });
  it("offers only levels that exist below", () => {
    expect(broadcastLevelsFor("DEANERY", ["PARISH"])).toEqual(["PARISH"]);
    expect(broadcastLevelsFor("PARISH", [])).toEqual([]);
  });
});

describe("notification preferences (D-052)", () => {
  it("no saved row = on; saved off = off", () => {
    expect(isDelivered("CHURCH_POST", "IN_APP", [])).toBe(true);
    expect(
      isDelivered("CHURCH_POST", "IN_APP", [{ code: "CHURCH_POST", channel: "IN_APP", enabled: false }]),
    ).toBe(false);
    expect(
      isDelivered("CHURCH_POST", "IN_APP", [{ code: "CHURCH_POST", channel: "EMAIL", enabled: false }]),
    ).toBe(true);
  });
  it("always-on types ignore saved rows", () => {
    expect(isMutableType("SYSTEM")).toBe(false);
    expect(isDelivered("SYSTEM", "IN_APP", [{ code: "SYSTEM", channel: "IN_APP", enabled: false }])).toBe(true);
    expect(isMutableType("NOT_A_TYPE")).toBe(false);
  });
});

describe("birthday digest", () => {
  it("local calendar day", () => {
    expect(localIsoDate(new Date("2026-10-08T23:30:00Z"), "Africa/Accra")).toBe("2026-10-08");
    expect(localIsoDate(new Date("2026-10-08T23:30:00Z"), "Africa/Lagos")).toBe("2026-10-09");
  });
  it("names at most three, then counts", () => {
    expect(birthdayDigestLine([{ name: "Ama", turning: 30 }])).toBe("Ama (30)");
    expect(
      birthdayDigestLine([
        { name: "Ama", turning: 30 },
        { name: "Kofi", turning: null },
      ]),
    ).toBe("Ama (30) and Kofi");
    expect(
      birthdayDigestLine(
        ["A", "B", "C", "D", "E"].map((name) => ({ name, turning: null })),
      ),
    ).toBe("A, B, C and 2 others");
  });
});
