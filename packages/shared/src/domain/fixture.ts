/** Test fixture mirroring the dev seed tree (packages/db seed). */
import type { GroupNode, GroupLookup } from "./access";
import type { HierarchyLevel, MetropolitanVisibility } from "./levels";
import { buildPath } from "./path";

export function makeTree(suffraganVisibility: MetropolitanVisibility = "aggregates") {
  const nodes = new Map<string, GroupNode>();
  const add = (id: string, level: HierarchyLevel, parent: string | null) => {
    const parentPath = parent ? nodes.get(parent)!.path : null;
    const node: GroupNode = { id, level, path: buildPath(parentPath, id) };
    if (level === "DIOCESE") node.metropolitanVisibility = suffraganVisibility;
    nodes.set(id, node);
    return node;
  };
  add("prov", "PROVINCE", null);
  add("arch", "ARCHDIOCESE", "prov");
  add("archDean", "DEANERY", "arch"); //   archdiocese's own deanery
  add("archPar", "PARISH", "archDean");
  add("dio", "DIOCESE", "arch"); //         suffragan
  add("deanA", "DEANERY", "dio");
  add("deanB", "DEANERY", "dio");
  add("parA1", "PARISH", "deanA");
  add("parA2", "PARISH", "deanA");
  add("parB1", "PARISH", "deanB");
  add("outA1a", "OUTSTATION", "parA1");
  add("outA1b", "OUTSTATION", "parA1");
  add("outA2a", "OUTSTATION", "parA2");
  const lookup: GroupLookup = (id) => nodes.get(id);
  const g = (id: string) => nodes.get(id)!;
  return { nodes, lookup, g };
}
