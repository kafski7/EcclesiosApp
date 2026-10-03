import { describe, expect, it } from "vitest";
import {
  canManageSeries,
  canPublishEpisode,
  canPublishPodcasts,
  episodeYouTubeId,
  formatEpisodeDuration,
  publishBlocker,
  type PodcastActor,
} from "./podcasts.js";

const admin: PodcastActor = { kind: "user", id: "u1", role: "SUPER_ADMIN", privileges: [] };
const creator: PodcastActor = { kind: "user", id: "u2", role: "CREATOR", privileges: ["POST_PODCASTS"] };
const writer: PodcastActor = { kind: "user", id: "u3", role: "CREATOR", privileges: ["AUTHOR_EXPLORE"] };
const member: PodcastActor = { kind: "member", id: "m1", privileges: ["POST_PODCASTS"] };
const plain: PodcastActor = { kind: "member", id: "m2", privileges: [] };

describe("who may publish (D-027)", () => {
  it("Super-Admins and POST_PODCASTS holders only", () => {
    expect([admin, creator, writer, member, plain].map(canPublishPodcasts)).toEqual([true, true, false, true, false]);
  });
  it("owners manage their own series; Super-Admins manage all", () => {
    const byCreator = { ownerUserId: "u2", ownerMemberId: null };
    const byMember = { ownerUserId: null, ownerMemberId: "m1" };
    expect(canManageSeries(admin, byMember)).toBe(true);
    expect(canManageSeries(creator, byCreator)).toBe(true);
    expect(canManageSeries(creator, byMember)).toBe(false);
    expect(canManageSeries(member, byMember)).toBe(true);
    // a member and a user can share an id space only by accident — kinds never cross
    expect(canManageSeries({ kind: "member", id: "u2", privileges: ["POST_PODCASTS"] }, byCreator)).toBe(false);
  });
  it("revoking the grant freezes the owner's series", () => {
    expect(canManageSeries({ ...creator, privileges: [] }, { ownerUserId: "u2", ownerMemberId: null })).toBe(false);
  });
});

describe("episodes", () => {
  it("need audio to go live", () => {
    expect(canPublishEpisode({ mediaKind: "AUDIO", audioKey: null, youtubeId: null })).toBe(false);
    expect(canPublishEpisode({ mediaKind: "AUDIO", audioKey: "podcasts/x/e.mp3", youtubeId: null })).toBe(true);
  });
  it("formats durations", () => {
    expect(formatEpisodeDuration(249)).toBe("4:09");
    expect(formatEpisodeDuration(3725)).toBe("1:02:05");
    expect(formatEpisodeDuration(null)).toBe("");
  });
});

describe("episode media (D-029)", () => {
  it("the primary media must be present to publish", () => {
    expect(publishBlocker({ mediaKind: "YOUTUBE", audioKey: "a.mp3", youtubeId: null })).toBe("YOUTUBE_REQUIRED");
    expect(publishBlocker({ mediaKind: "YOUTUBE", audioKey: null, youtubeId: "dQw4w9WgXcQ" })).toBe(null);
    expect(publishBlocker({ mediaKind: "AUDIO", audioKey: null, youtubeId: "dQw4w9WgXcQ" })).toBe("AUDIO_REQUIRED");
  });
  it("self-hosted video is reserved, never publishable yet", () => {
    expect(publishBlocker({ mediaKind: "VIDEO", audioKey: "a.mp3", youtubeId: "dQw4w9WgXcQ" })).toBe("VIDEO_NOT_AVAILABLE");
  });
  it("accepts YouTube and YouTube Music links", () => {
    expect(episodeYouTubeId("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(episodeYouTubeId("https://example.com/x")).toBe(null);
  });
});
