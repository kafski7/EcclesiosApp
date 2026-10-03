import { describe, expect, it } from "vitest";
import { audioType, handoutLabel, isCoverType } from "./podcasts";

describe("studio uploads", () => {
  it("guesses audio types from the extension", () => {
    expect(audioType({ type: "", name: "ep1.MP3" })).toBe("audio/mpeg");
    expect(audioType({ type: "audio/mp4", name: "x" })).toBe("audio/mp4");
  });
  it("accepts only image covers", () => {
    expect(isCoverType("image/webp")).toBe(true);
    expect(isCoverType("image/gif")).toBe(false);
  });
});


describe("handouts (D-029)", () => {
  it("labels from file names", () => {
    expect(handoutLabel("Week_3-notes.PDF")).toBe("Week 3 notes");
    expect(handoutLabel(".pdf")).toBe("Handout");
  });
});
