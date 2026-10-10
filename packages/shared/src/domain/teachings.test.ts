import { describe, expect, it } from "vitest";
import {
  lessonReferences,
  lessonText,
  lintLesson,
  parseInline,
  parseLesson,
  readingMinutes,
} from "./teachings.js";

describe("parseInline (D-030)", () => {
  it("bold, italic and plain text", () => {
    expect(parseInline("A **sacrament** is *visible*.")).toEqual([
      { t: "text", v: "A " },
      { t: "strong", v: "sacrament" },
      { t: "text", v: " is " },
      { t: "em", v: "visible" },
      { t: "text", v: "." },
    ]);
  });
  it("Bible, Catechism and teaching references", () => {
    expect(
      parseInline("See [[John 6:51]], [[CCC 1324]] and [[teaching:baptism|Baptism]]."),
    ).toEqual([
      { t: "text", v: "See " },
      { t: "bible", ref: "John 6:51" },
      { t: "text", v: ", " },
      { t: "ccc", n: 1324 },
      { t: "text", v: " and " },
      { t: "teaching", slug: "baptism", label: "Baptism" },
      { t: "text", v: "." },
    ]);
  });
  it("leaves unknown references as typed and never produces markup", () => {
    expect(parseInline("[[CCC 9999]] <b>x</b>")).toEqual([
      { t: "text", v: "[[CCC 9999]] <b>x</b>" },
    ]);
  });
});

describe("parseLesson", () => {
  const src = [
    "## What is a sacrament?",
    "",
    "A sacrament is an **efficacious sign** of grace [[CCC 1131]].",
    "",
    "> This is my body, which is given for you.",
    "> — Luke 22:19",
    "",
    "- Baptism",
    "- Confirmation",
    "",
    "1. First",
    "2. Second",
  ].join("\n");
  const blocks = parseLesson(src);

  it("reads headings, paragraphs, quotes and lists", () => {
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "quote", "list", "list"]);
    expect(blocks[2]).toMatchObject({ type: "quote", cite: "Luke 22:19" });
    expect(blocks[3]).toMatchObject({ ordered: false });
    expect(blocks[4]).toMatchObject({ ordered: true });
  });
  it("collects references and plain text", () => {
    expect(
      lessonReferences(parseLesson("[[CCC 1324]] [[John 6:51]] [[CCC 1131]] [[CCC 1324]]")),
    ).toEqual({
      bible: ["John 6:51"],
      ccc: [1131, 1324],
      teachings: [],
    });
    expect(lessonText(blocks)).toContain("efficacious sign of grace CCC 1131");
  });
  it("reading time", () => {
    expect(readingMinutes(parseLesson("word ".repeat(450)))).toBe(3);
    expect(readingMinutes(parseLesson("short"))).toBe(1);
  });
});

describe("lintLesson", () => {
  it("reports bad references and unknown teachings", () => {
    expect(lintLesson("[[CCC 1131]] [[teaching:baptism]]", new Set(["baptism"]))).toEqual([]);
    const p = lintLesson("[[Hezekiah 1:1]] [[teaching:nope]]", new Set(["baptism"]));
    expect(p.length).toBe(2);
    expect(lintLesson("   ")).toEqual(["The lesson is empty"]);
  });
});
