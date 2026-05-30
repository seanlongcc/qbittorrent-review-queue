import { describe, expect, it } from "vitest";
import { sampleSettings, sampleTorrents } from "../test/fixtures";
import {
  createInitialState,
  getActiveCandidate,
  getActiveTorrent,
  getMarkedCandidateIndexes,
  getMovedCandidateIndexes,
  getReviewableTorrents,
  isActiveTorrentMissing,
  reviewReducer,
  wouldExceedFolderLimit,
} from "./reviewState";

describe("review state", () => {
  it("defaults to the first completed torrent and marks its largest candidate", () => {
    const state = createInitialState(sampleTorrents, sampleSettings);

    expect(getActiveTorrent(state)?.name).toBe("Workshop footage - camera A");
    expect(getActiveCandidate(state)?.name).toBe("camera-a-main-2160p.mkv");
    expect(getMarkedCandidateIndexes(state)).toEqual([0]);
  });

  it("moves between torrents with wraparound", () => {
    const state = createInitialState(sampleTorrents, sampleSettings);

    const previous = reviewReducer(state, { type: "previousTorrent" });
    expect(getActiveTorrent(previous)?.name).toBe("Training session exports");

    const next = reviewReducer(previous, { type: "nextTorrent" });
    expect(getActiveTorrent(next)?.name).toBe("Workshop footage - camera A");
  });

  it("requires Keep confirmation before moving marked videos", () => {
    const state = createInitialState(sampleTorrents, sampleSettings);

    const afterKeep = reviewReducer(state, { type: "keep" });
    expect(afterKeep.armedAction).toBe("keep");
    expect(afterKeep.notice).toMatch(/move marked files/i);
  });

  it("records moved candidates and keeps stale queue refreshes from lowering folder count", () => {
    const state = createInitialState(sampleTorrents, sampleSettings);
    const hash = sampleTorrents[0].hash;

    const afterMove = reviewReducer(state, {
      type: "candidatesMoved",
      hash,
      fileIndexes: [0],
      folderCount: 35,
    });

    expect(getMovedCandidateIndexes(afterMove, hash)).toEqual([0]);
    expect(getMarkedCandidateIndexes(afterMove, hash)).toEqual([]);
    expect(afterMove.settings.folderCount).toBe(35);

    const staleRefresh = reviewReducer(afterMove, {
      type: "queueLoaded",
      torrents: sampleTorrents,
      attentionTorrents: [],
      settings: { ...sampleSettings, folderCount: 34 },
    });

    expect(staleRefresh.settings.folderCount).toBe(35);

    const detailReload = reviewReducer(staleRefresh, { type: "detailLoaded", torrent: sampleTorrents[0] });

    expect(getMarkedCandidateIndexes(detailReload, hash)).toEqual([]);
  });

  it("blocks Keep when the session folder would exceed capacity", () => {
    const state = createInitialState(sampleTorrents, {
      ...sampleSettings,
      folderCount: 40,
    });

    expect(wouldExceedFolderLimit(state)).toBe(true);

    const afterKeep = reviewReducer(state, { type: "keep" });
    expect(afterKeep.torrents).toHaveLength(getReviewableTorrents(state).length);
    expect(afterKeep.notice).toMatch(/folder is full/i);
  });

  it("rejects only after arming confirmation", () => {
    const state = createInitialState(sampleTorrents, sampleSettings);

    const armed = reviewReducer(state, { type: "reject" });
    expect(armed.armedAction).toBe("reject");
    expect(armed.torrents).toHaveLength(getReviewableTorrents(state).length);

    const confirmed = reviewReducer(armed, { type: "reject" });
    expect(confirmed.torrents).toHaveLength(getReviewableTorrents(state).length);
    expect(confirmed.armedAction).toBe("reject");
  });

  it("keeps a vanished active torrent selected and blocks destructive actions until user moves on", () => {
    const state = createInitialState(sampleTorrents, sampleSettings);
    const queueAfterPoll = reviewReducer(state, {
      type: "queueLoaded",
      torrents: [sampleTorrents[1]],
      attentionTorrents: [],
      settings: sampleSettings,
    });

    expect(getActiveTorrent(queueAfterPoll)?.name).toBe("Workshop footage - camera A");
    expect(isActiveTorrentMissing(queueAfterPoll)).toBe(true);

    const afterKeep = reviewReducer(queueAfterPoll, { type: "keep" });
    expect(afterKeep.armedAction).toBeNull();
    expect(afterKeep.notice).toMatch(/no longer in qBittorrent/i);

    const afterReject = reviewReducer(queueAfterPoll, { type: "reject" });
    expect(afterReject.armedAction).toBeNull();
    expect(afterReject.notice).toMatch(/no longer in qBittorrent/i);

    const next = reviewReducer(queueAfterPoll, { type: "nextTorrent" });
    expect(getActiveTorrent(next)?.name).toBe("Conference recordings pack");
    expect(isActiveTorrentMissing(next)).toBe(false);
  });
});
