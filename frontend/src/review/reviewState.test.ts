import { describe, expect, it } from "vitest";
import { mockSettings, mockTorrents } from "../api/mockData";
import {
  createInitialState,
  getActiveCandidate,
  getActiveTorrent,
  getMarkedCandidateIndexes,
  needsKeepConfirmation,
  reviewReducer,
  wouldExceedFolderLimit,
} from "./reviewState";

describe("review state", () => {
  it("defaults to the first completed torrent and marks its largest candidate", () => {
    const state = createInitialState(mockTorrents, mockSettings);

    expect(getActiveTorrent(state)?.name).toBe("Workshop footage - camera A");
    expect(getActiveCandidate(state)?.name).toBe("camera-a-main-2160p.mkv");
    expect(getMarkedCandidateIndexes(state)).toEqual([0]);
  });

  it("moves between torrents with wraparound", () => {
    const state = createInitialState(mockTorrents, mockSettings);

    const previous = reviewReducer(state, { type: "previousTorrent" });
    expect(getActiveTorrent(previous)?.name).toBe("Training session exports");

    const next = reviewReducer(previous, { type: "nextTorrent" });
    expect(getActiveTorrent(next)?.name).toBe("Workshop footage - camera A");
  });

  it("requires Keep confirmation when unmarked videos would be deleted", () => {
    const state = createInitialState(mockTorrents, mockSettings);

    expect(needsKeepConfirmation(state)).toBe(true);

    const armed = reviewReducer(state, { type: "keep" });
    expect(armed.armedAction).toBe("keep");
  });

  it("blocks Keep when the session folder would exceed capacity", () => {
    const state = createInitialState(mockTorrents, {
      ...mockSettings,
      folderCount: 40,
    });

    expect(wouldExceedFolderLimit(state)).toBe(true);

    const afterKeep = reviewReducer(state, { type: "keep" });
    expect(afterKeep.torrents).toHaveLength(mockTorrents.length);
    expect(afterKeep.notice).toMatch(/folder is full/i);
  });

  it("rejects only after arming confirmation", () => {
    const state = createInitialState(mockTorrents, mockSettings);

    const armed = reviewReducer(state, { type: "reject" });
    expect(armed.armedAction).toBe("reject");
    expect(armed.torrents).toHaveLength(mockTorrents.length);

    const rejected = reviewReducer(armed, { type: "reject" });
    expect(rejected.torrents).toHaveLength(mockTorrents.length - 1);
    expect(rejected.armedAction).toBeNull();
  });
});
