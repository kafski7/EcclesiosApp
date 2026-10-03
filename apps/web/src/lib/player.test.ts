import { describe, expect, it } from "vitest";
import { clampSeek, episodeActions, formatClock, resumePosition } from "./player";

describe("episodeActions (D-029)", () => {
  it("audio-first episode", () => {
    expect(episodeActions({ mediaKind: "AUDIO", hasAudio: true, youtubeId: null, available: true })).toEqual({ listen: true, watch: false, locked: false, primary: "listen" });
  });
  it("YouTube-first episode with audio too", () => {
    expect(episodeActions({ mediaKind: "YOUTUBE", hasAudio: true, youtubeId: "dQw4w9WgXcQ", available: true }).primary).toBe("watch");
  });
  it("locked episodes offer nothing", () => {
    expect(episodeActions({ mediaKind: "AUDIO", hasAudio: true, youtubeId: null, available: false })).toMatchObject({ locked: true, listen: false });
  });
});

describe("player helpers", () => {
  it("formats the clock", () => {
    expect(formatClock(5)).toBe("0:05");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(Number.NaN)).toBe("0:00");
  });
  it("clamps seeks", () => {
    expect(clampSeek(10, -15, 600)).toBe(0);
    expect(clampSeek(590, 30, 600)).toBe(600);
  });
  it("restarts near the end", () => {
    expect(resumePosition(595, 600)).toBe(0);
    expect(resumePosition(120, 600)).toBe(120);
  });
});
