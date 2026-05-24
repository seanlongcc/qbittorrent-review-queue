import type { LocalSettings, ReviewTorrent, VideoCandidate } from "../domain/types";

export type ArmedAction = "keep" | "reject" | null;

export type ReviewState = {
  torrents: ReviewTorrent[];
  attentionTorrents: ReviewTorrent[];
  detailsByHash: Record<string, ReviewTorrent>;
  activeTorrentHash: string | null;
  activeCandidateIndex: number;
  markedByTorrent: Record<string, number[]>;
  armedAction: ArmedAction;
  settingsOpen: boolean;
  settings: LocalSettings;
  notice: string;
  loadingQueue: boolean;
  loadingDetail: boolean;
  actionBusy: boolean;
};

export type ReviewAction =
  | { type: "queueLoading" }
  | { type: "queueLoaded"; torrents: ReviewTorrent[]; attentionTorrents: ReviewTorrent[]; settings: LocalSettings }
  | { type: "queueFailed"; message: string }
  | { type: "detailLoading" }
  | { type: "detailLoaded"; torrent: ReviewTorrent }
  | { type: "detailFailed"; message: string }
  | { type: "previousTorrent" }
  | { type: "nextTorrent" }
  | { type: "selectTorrent"; hash: string }
  | { type: "previousCandidate" }
  | { type: "nextCandidate" }
  | { type: "selectCandidate"; index: number }
  | { type: "toggleMark"; fileIndex?: number }
  | { type: "keep" }
  | { type: "reject" }
  | { type: "openExternal" }
  | { type: "actionStarted"; label: string }
  | { type: "actionFinished"; notice: string }
  | { type: "actionFailed"; message: string }
  | { type: "cancel" }
  | { type: "toggleSettings" }
  | { type: "settingsUpdated"; settings: LocalSettings };

export const defaultSettings: LocalSettings = {
  qbtBaseUrl: "http://localhost:8080",
  qbtUsername: "admin",
  passwordConfigured: false,
  windowsDownloadRoot: "C:\\Downloads",
  wslDownloadRoot: "/mnt/c/Downloads",
  sessionFolder: "",
  sessionFolderLimit: 40,
  folderCount: 0,
  connected: false,
};

export function createInitialState(
  torrents: ReviewTorrent[] = [],
  settings: LocalSettings = defaultSettings,
): ReviewState {
  const reviewable = torrents.filter((torrent) => torrent.status === "completed");
  return {
    torrents: reviewable,
    attentionTorrents: torrents.filter((torrent) => torrent.status === "attention"),
    detailsByHash: Object.fromEntries(reviewable.map((torrent) => [torrent.hash, torrent])),
    activeTorrentHash: reviewable[0]?.hash ?? null,
    activeCandidateIndex: 0,
    markedByTorrent: Object.fromEntries(
      reviewable.map((torrent) => [torrent.hash, defaultMarkedFileIndexes(torrent)]),
    ),
    armedAction: null,
    settingsOpen: false,
    settings,
    notice: reviewable[0] ? "Queue ready." : "Loading qBittorrent queue.",
    loadingQueue: false,
    loadingDetail: false,
    actionBusy: false,
  };
}

export function getReviewableTorrents(state: ReviewState): ReviewTorrent[] {
  return state.torrents;
}

export function getAttentionTorrents(state: ReviewState): ReviewTorrent[] {
  return state.attentionTorrents;
}

export function getActiveTorrent(state: ReviewState): ReviewTorrent | null {
  if (!state.activeTorrentHash) {
    return null;
  }
  return state.detailsByHash[state.activeTorrentHash] ?? state.torrents.find((torrent) => torrent.hash === state.activeTorrentHash) ?? null;
}

export function isActiveTorrentMissing(state: ReviewState): boolean {
  return Boolean(
    state.activeTorrentHash &&
      state.detailsByHash[state.activeTorrentHash] &&
      !state.torrents.some((torrent) => torrent.hash === state.activeTorrentHash),
  );
}

export function getActiveCandidate(state: ReviewState): VideoCandidate | null {
  const torrent = getActiveTorrent(state);
  return torrent?.candidates?.[state.activeCandidateIndex] ?? null;
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
  if (!torrent?.candidates) {
    return [];
  }
  const marked = new Set(getMarkedCandidateIndexes(state, torrent.hash));
  return torrent.candidates.filter((candidate) => marked.has(candidate.fileIndex));
}

export function wouldExceedFolderLimit(state: ReviewState): boolean {
  return state.settings.folderCount + getMarkedCandidates(state).length > state.settings.sessionFolderLimit;
}

export function needsKeepConfirmation(state: ReviewState): boolean {
  const torrent = getActiveTorrent(state);
  if (!torrent?.candidates || torrent.candidates.length <= 1) {
    return false;
  }
  return getMarkedCandidateIndexes(state, torrent.hash).length < torrent.candidates.length;
}

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "queueLoading":
      return { ...state, loadingQueue: true, notice: "Refreshing qBittorrent queue." };
    case "queueLoaded": {
      const detailsByHash = { ...state.detailsByHash };
      for (const torrent of action.torrents) {
        detailsByHash[torrent.hash] = { ...detailsByHash[torrent.hash], ...torrent };
      }
      const activeStillExists = action.torrents.some((torrent) => torrent.hash === state.activeTorrentHash);
      const activeTorrentHash = state.activeTorrentHash ?? action.torrents[0]?.hash ?? null;
      const activeMissing = Boolean(state.activeTorrentHash && !activeStillExists && detailsByHash[state.activeTorrentHash]);
      return {
        ...state,
        torrents: action.torrents,
        attentionTorrents: action.attentionTorrents,
        detailsByHash,
        activeTorrentHash,
        activeCandidateIndex: activeStillExists || activeMissing ? state.activeCandidateIndex : 0,
        settings: action.settings,
        loadingQueue: false,
        armedAction: null,
        notice: activeMissing
          ? "Selected torrent no longer in qBittorrent. Choose Next or Refresh."
          : action.torrents.length ? "Queue ready." : "No completed torrents are ready.",
      };
    }
    case "queueFailed":
      return { ...state, loadingQueue: false, notice: action.message };
    case "detailLoading":
      return { ...state, loadingDetail: true };
    case "detailLoaded": {
      const markedByTorrent = { ...state.markedByTorrent };
      if (!markedByTorrent[action.torrent.hash]?.length) {
        markedByTorrent[action.torrent.hash] = defaultMarkedFileIndexes(action.torrent);
      }
      return {
        ...state,
        detailsByHash: { ...state.detailsByHash, [action.torrent.hash]: action.torrent },
        markedByTorrent,
        loadingDetail: false,
      };
    }
    case "detailFailed":
      return { ...state, loadingDetail: false, notice: action.message };
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
      return toggleMark(state, action.fileIndex ?? getActiveCandidate(state)?.fileIndex);
    case "keep":
      if (isActiveTorrentMissing(state)) {
        return { ...state, notice: "Selected torrent no longer in qBittorrent. Choose Next or Refresh.", armedAction: null };
      }
      if (getMarkedCandidates(state).length === 0) {
        return { ...state, notice: "Mark at least one video before Keep.", armedAction: null };
      }
      if (wouldExceedFolderLimit(state)) {
        return { ...state, notice: "Session folder is full. Choose the next folder.", armedAction: null };
      }
      if (needsKeepConfirmation(state) && state.armedAction !== "keep") {
        return { ...state, armedAction: "keep", notice: "Keep will delete unmarked torrent leftovers." };
      }
      return state;
    case "reject":
      if (isActiveTorrentMissing(state)) {
        return { ...state, notice: "Selected torrent no longer in qBittorrent. Choose Next or Refresh.", armedAction: null };
      }
      if (!getActiveTorrent(state)) {
        return state;
      }
      if (state.armedAction !== "reject") {
        return { ...state, armedAction: "reject", notice: "Reject will delete torrent files with deleteFiles=true." };
      }
      return state;
    case "openExternal": {
      const candidate = getActiveCandidate(state);
      return { ...state, notice: candidate ? `Opening ${candidate.name}.` : "No video candidate selected." };
    }
    case "actionStarted":
      return { ...state, actionBusy: true, notice: action.label };
    case "actionFinished":
      return { ...state, actionBusy: false, armedAction: null, notice: action.notice };
    case "actionFailed":
      return { ...state, actionBusy: false, notice: action.message };
    case "cancel":
      return { ...state, armedAction: null, notice: "Action cancelled." };
    case "toggleSettings":
      return { ...state, settingsOpen: !state.settingsOpen, armedAction: null };
    case "settingsUpdated":
      return { ...state, settings: action.settings, settingsOpen: false, notice: "Settings updated locally." };
    default:
      return state;
  }
}

function defaultMarkedFileIndexes(torrent: ReviewTorrent): number[] {
  return torrent.candidates?.[0] ? [torrent.candidates[0].fileIndex] : [];
}

function moveTorrent(state: ReviewState, offset: number): ReviewState {
  if (state.torrents.length === 0) {
    return state;
  }
  const currentIndex = state.torrents.findIndex((torrent) => torrent.hash === state.activeTorrentHash);
  const nextIndex = currentIndex === -1
    ? (offset > 0 ? 0 : state.torrents.length - 1)
    : wrapIndex(currentIndex + offset, state.torrents.length);
  return {
    ...state,
    activeTorrentHash: state.torrents[nextIndex].hash,
    activeCandidateIndex: 0,
    armedAction: null,
  };
}

function moveCandidate(state: ReviewState, offset: number): ReviewState {
  const torrent = getActiveTorrent(state);
  const candidates = torrent?.candidates ?? [];
  if (candidates.length === 0) {
    return state;
  }
  return {
    ...state,
    activeCandidateIndex: wrapIndex(state.activeCandidateIndex + offset, candidates.length),
    armedAction: null,
  };
}

function toggleMark(state: ReviewState, fileIndex: number | undefined): ReviewState {
  const torrent = getActiveTorrent(state);
  if (!torrent || fileIndex === undefined || !torrent.candidates?.some((candidate) => candidate.fileIndex === fileIndex)) {
    return state;
  }
  const current = new Set(getMarkedCandidateIndexes(state, torrent.hash));
  if (current.has(fileIndex)) {
    current.delete(fileIndex);
  } else {
    current.add(fileIndex);
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

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
