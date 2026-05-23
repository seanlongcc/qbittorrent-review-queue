import type { LocalSettings, ReviewTorrent, VideoCandidate } from "../domain/types";

export type ArmedAction = "keep" | "reject" | null;

export type ReviewState = {
  torrents: ReviewTorrent[];
  activeTorrentHash: string | null;
  activeCandidateIndex: number;
  markedByTorrent: Record<string, number[]>;
  armedAction: ArmedAction;
  settingsOpen: boolean;
  settings: LocalSettings;
  notice: string;
};

export type ReviewAction =
  | { type: "previousTorrent" }
  | { type: "nextTorrent" }
  | { type: "selectTorrent"; hash: string }
  | { type: "previousCandidate" }
  | { type: "nextCandidate" }
  | { type: "selectCandidate"; index: number }
  | { type: "toggleMark"; index?: number }
  | { type: "keep" }
  | { type: "reject" }
  | { type: "openExternal" }
  | { type: "cancel" }
  | { type: "toggleSettings" }
  | { type: "updateSettings"; settings: Partial<LocalSettings> };

export function createInitialState(
  torrents: ReviewTorrent[],
  settings: LocalSettings,
): ReviewState {
  const reviewable = torrents.filter((torrent) => torrent.status === "completed");
  return {
    torrents,
    activeTorrentHash: reviewable[0]?.hash ?? null,
    activeCandidateIndex: 0,
    markedByTorrent: Object.fromEntries(
      torrents.map((torrent) => [torrent.hash, torrent.candidates[0] ? [0] : []]),
    ),
    armedAction: null,
    settingsOpen: false,
    settings,
    notice: reviewable[0] ? "Queue ready." : "No completed torrents.",
  };
}

export function getReviewableTorrents(state: ReviewState): ReviewTorrent[] {
  return state.torrents.filter((torrent) => torrent.status === "completed");
}

export function getAttentionTorrents(state: ReviewState): ReviewTorrent[] {
  return state.torrents.filter((torrent) => torrent.status === "attention");
}

export function getActiveTorrent(state: ReviewState): ReviewTorrent | null {
  if (!state.activeTorrentHash) {
    return null;
  }

  return state.torrents.find((torrent) => torrent.hash === state.activeTorrentHash) ?? null;
}

export function getActiveCandidate(state: ReviewState): VideoCandidate | null {
  const torrent = getActiveTorrent(state);
  return torrent?.candidates[state.activeCandidateIndex] ?? null;
}

export function getMarkedCandidateIndexes(state: ReviewState, hash?: string): number[] {
  const torrentHash = hash ?? state.activeTorrentHash;
  if (!torrentHash) {
    return [];
  }

  return state.markedByTorrent[torrentHash] ?? [];
}

export function getMarkedCandidates(state: ReviewState): VideoCandidate[] {
  const torrent = getActiveTorrent(state);
  if (!torrent) {
    return [];
  }

  return getMarkedCandidateIndexes(state, torrent.hash)
    .map((index) => torrent.candidates[index])
    .filter(Boolean);
}

export function wouldExceedFolderLimit(state: ReviewState): boolean {
  return state.settings.folderCount + getMarkedCandidates(state).length > state.settings.sessionFolderLimit;
}

export function needsKeepConfirmation(state: ReviewState): boolean {
  const torrent = getActiveTorrent(state);
  if (!torrent || torrent.candidates.length <= 1) {
    return false;
  }

  return getMarkedCandidateIndexes(state, torrent.hash).length < torrent.candidates.length;
}

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "previousTorrent":
      return moveTorrent(state, -1);
    case "nextTorrent":
      return moveTorrent(state, 1);
    case "selectTorrent":
      return {
        ...state,
        activeTorrentHash: action.hash,
        activeCandidateIndex: 0,
        armedAction: null,
      };
    case "previousCandidate":
      return moveCandidate(state, -1);
    case "nextCandidate":
      return moveCandidate(state, 1);
    case "selectCandidate":
      return { ...state, activeCandidateIndex: action.index, armedAction: null };
    case "toggleMark":
      return toggleMark(state, action.index ?? state.activeCandidateIndex);
    case "keep":
      return keepTorrent(state);
    case "reject":
      return rejectTorrent(state);
    case "openExternal": {
      const candidate = getActiveCandidate(state);
      return {
        ...state,
        notice: candidate ? `Opening ${candidate.name}.` : "No video candidate selected.",
      };
    }
    case "cancel":
      return { ...state, armedAction: null, notice: "Action cancelled." };
    case "toggleSettings":
      return { ...state, settingsOpen: !state.settingsOpen };
    case "updateSettings":
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
        notice: "Settings updated locally.",
      };
    default:
      return state;
  }
}

function moveTorrent(state: ReviewState, offset: number): ReviewState {
  const reviewable = getReviewableTorrents(state);
  if (reviewable.length === 0) {
    return state;
  }

  const currentIndex = Math.max(
    0,
    reviewable.findIndex((torrent) => torrent.hash === state.activeTorrentHash),
  );
  const nextIndex = wrapIndex(currentIndex + offset, reviewable.length);

  return {
    ...state,
    activeTorrentHash: reviewable[nextIndex].hash,
    activeCandidateIndex: 0,
    armedAction: null,
  };
}

function moveCandidate(state: ReviewState, offset: number): ReviewState {
  const torrent = getActiveTorrent(state);
  if (!torrent || torrent.candidates.length === 0) {
    return state;
  }

  return {
    ...state,
    activeCandidateIndex: wrapIndex(state.activeCandidateIndex + offset, torrent.candidates.length),
    armedAction: null,
  };
}

function toggleMark(state: ReviewState, candidateIndex: number): ReviewState {
  const torrent = getActiveTorrent(state);
  if (!torrent || !torrent.candidates[candidateIndex]) {
    return state;
  }

  const current = new Set(getMarkedCandidateIndexes(state, torrent.hash));
  if (current.has(candidateIndex)) {
    current.delete(candidateIndex);
  } else {
    current.add(candidateIndex);
  }

  return {
    ...state,
    markedByTorrent: {
      ...state.markedByTorrent,
      [torrent.hash]: [...current].sort((left, right) => left - right),
    },
    armedAction: null,
  };
}

function keepTorrent(state: ReviewState): ReviewState {
  const torrent = getActiveTorrent(state);
  const markedCandidates = getMarkedCandidates(state);
  if (!torrent) {
    return state;
  }
  if (markedCandidates.length === 0) {
    return { ...state, notice: "Mark at least one video before Keep.", armedAction: null };
  }
  if (wouldExceedFolderLimit(state)) {
    return { ...state, notice: "Session folder is full. Choose the next folder.", armedAction: null };
  }
  if (needsKeepConfirmation(state) && state.armedAction !== "keep") {
    return { ...state, armedAction: "keep", notice: "Keep will delete unmarked leftovers." };
  }

  return removeActiveTorrent(state, {
    folderCount: state.settings.folderCount + markedCandidates.length,
    notice: `Kept ${markedCandidates.length} video${markedCandidates.length === 1 ? "" : "s"}.`,
  });
}

function rejectTorrent(state: ReviewState): ReviewState {
  const torrent = getActiveTorrent(state);
  if (!torrent) {
    return state;
  }
  if (state.armedAction !== "reject") {
    return { ...state, armedAction: "reject", notice: "Reject will delete torrent files." };
  }

  return removeActiveTorrent(state, { notice: "Rejected torrent and files." });
}

function removeActiveTorrent(
  state: ReviewState,
  changes: { folderCount?: number; notice: string },
): ReviewState {
  const activeHash = state.activeTorrentHash;
  if (!activeHash) {
    return state;
  }

  const reviewableBefore = getReviewableTorrents(state);
  const currentIndex = reviewableBefore.findIndex((torrent) => torrent.hash === activeHash);
  const torrents = state.torrents.filter((torrent) => torrent.hash !== activeHash);
  const reviewableAfter = torrents.filter((torrent) => torrent.status === "completed");
  const nextActive =
    reviewableAfter[Math.min(Math.max(currentIndex, 0), reviewableAfter.length - 1)]?.hash ?? null;

  return {
    ...state,
    torrents,
    activeTorrentHash: nextActive,
    activeCandidateIndex: 0,
    armedAction: null,
    settings: {
      ...state.settings,
      folderCount: changes.folderCount ?? state.settings.folderCount,
    },
    notice: changes.notice,
  };
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
