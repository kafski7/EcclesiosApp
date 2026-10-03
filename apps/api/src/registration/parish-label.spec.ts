import { describe, expect, it } from "vitest";
import { ancestorIds, describeChurch, describeParish, type NamedNode } from "./parish-label";

const nodes = new Map<string, NamedNode>([
  ["p", { id: "p", name: "Province", level: "PROVINCE" }],
  ["a", { id: "a", name: "Metropolitan Archdiocese", level: "ARCHDIOCESE" }],
  ["d", { id: "d", name: "Suffragan Diocese", level: "DIOCESE" }],
  ["dn", { id: "dn", name: "St Joseph Deanery", level: "DEANERY" }],
  ["ad", { id: "ad", name: "Cathedral Deanery", level: "DEANERY" }],
  ["x", { id: "x", name: "St Theresa Parish", level: "PARISH" }],
]);

describe("describeParish", () => {
  it("names the deanery and the nearest diocese for a suffragan parish", () => {
    expect(describeParish("/p/a/d/dn/x/", nodes)).toEqual({
      deanery: "St Joseph Deanery",
      diocese: "Suffragan Diocese",
    });
  });
  it("uses the archdiocese for the archdiocese's own parishes", () => {
    expect(describeParish("/p/a/ad/y/", nodes)).toEqual({
      deanery: "Cathedral Deanery",
      diocese: "Metropolitan Archdiocese",
    });
  });
  it("tolerates missing ancestors", () => {
    expect(describeParish("/zz/y/", nodes)).toEqual({ deanery: null, diocese: null });
  });
  it("collects unique ancestor ids", () => {
    expect(ancestorIds(["/p/a/d/dn/x/", "/p/a/ad/y/"]).sort()).toEqual(["a", "ad", "d", "dn", "p"]);
  });
});

describe("describeChurch", () => {
  it("adds the overseeing parish for an outstation", () => {
    expect(describeChurch("/p/a/d/dn/x/o/", "OUTSTATION", nodes)).toEqual({
      parish: "St Theresa Parish",
      deanery: "St Joseph Deanery",
      diocese: "Suffragan Diocese",
    });
  });
  it("has no parish line for a parish", () => {
    expect(describeChurch("/p/a/d/dn/x/", "PARISH", nodes).parish).toBe(null);
  });
});
