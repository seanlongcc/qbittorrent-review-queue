import type { LocalSettings, ReviewTorrent, VideoCandidate } from "../domain/types";

export type ArmedAction = "keep" | "reject" | null;
export type ToastTone = "info" | "success" | "error";

export type ReviewToast = {
  id: number;
  message: string;
  tone: ToastTone;
};

export type ReviewState = {
  torrents: ReviewTorrent[];
  attentionTorrents: ReviewTorrent[];
  detailsByHash: Record<string, ReviewTorrent>;
  activeTorrentHash: string | null;
  activeCandidateIndex: number;
  markedByTorrent: Record<string, number[]>;
  movedByTorrent: Record<string, number[]>;
  armedAction: ArmedAction;
  settingsOpen: boolean;
  settings: LocalSettings;
  folderCountFloor: { sessionFolder: string; count: number } | null;
  notice: string;
  loadingQueue: boolean;
  loadingDetail: boolean;
  actionBusy: boolean;
  toast: ReviewToast | null;
  toastId: number;
};

export type ReviewAction =
  | { type: "queueLoading"; toast?: string }
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
  | { type: "openFolder" }
  | { type: "actionStarted"; label: string }
  | { type: "actionFinished"; notice: string }
  | { type: "actionFailed"; message: string }
  | { type: "folderCountIncremented"; count: number }
  | { type: "folderCountSet"; count: number }
  | { type: "candidatesMoved"; hash: string; fileIndexes: number[]; folderCount: number }
  | { type: "torrentRemoved"; hash: string; nextHash: string | null }
  | { type: "toastDismissed" }
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
      reviewable.flatMap((torrent) => {
        const marked = defaultMarkedFileIndexes(torrent);
        return marked.length ? [[torrent.hash, marked]] : [];
      }),
    ),
    movedByTorrent: {},
    armedAction: null,
    settingsOpen: false,
    settings,
    folderCountFloor: null,
    notice: reviewable[0] ? "Queue ready." : "Loading qBittorrent queue.",
    loadingQueue: false,
    loadingDetail: false,
    actionBusy: false,
    toast: null,
    toastId: 0,
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

export function getMovedCandidateIndexes(state: ReviewState, hash?: string): number[] {
  const torrentHash = hash ?? state.activeTorrentHash;
  if (!torrentHash) {
    return [];
  }
  return state.movedByTorrent[torrentHash] ?? [];
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

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "queueLoading":
      return action.toast
        ? withToast({ ...state, loadingQueue: true, notice: "Refreshing qBittorrent queue" }, action.toast, "info")
        : { ...state, loadingQueue: true, notice: "Refreshing qBittorrent queue" };
    case "queueLoaded": {
      const detailsByHash = { ...state.detailsByHash };
      for (const torrent of action.torrents) {
        detailsByHash[torrent.hash] = { ...detailsByHash[torrent.hash], ...torrent };
      }
      const folderCountFloor = folderCountFloorForRefresh(state, action.settings);
      const settings = folderCountFloor
        ? { ...action.settings, folderCount: folderCountFloor.count }
        : action.settings;
      const activeStillExists = action.torrents.some((torrent) => torrent.hash === state.activeTorrentHash);
      const activeTorrentHash = state.activeTorrentHash;
      const activeMissing = Boolean(state.activeTorrentHash && !activeStillExists && detailsByHash[state.activeTorrentHash]);
      const nextState = {
        ...state,
        torrents: action.torrents,
        attentionTorrents: action.attentionTorrents,
        detailsByHash,
        activeTorrentHash,
        activeCandidateIndex: activeStillExists || activeMissing ? state.activeCandidateIndex : 0,
        settings,
        folderCountFloor,
        loadingQueue: false,
        armedAction: null,
        notice: activeMissing
          ? "Selected torrent no longer in qBittorrent. Choose Next or Refresh."
          : action.torrents.length ? "Queue ready." : "No completed torrents are ready.",
      };
      return state.toast?.message === "Refreshing qBittorrent queue"
        ? withToast(nextState, "Queue refreshed", "success")
        : nextState;
    }
    case "queueFailed":
      return withToast({ ...state, loadingQueue: false, notice: action.message }, action.message, "error");
    case "detailLoading":
      return { ...state, loadingDetail: true };
    case "detailLoaded": {
      const markedByTorrent = { ...state.markedByTorrent };
      if (!(action.torrent.hash in markedByTorrent)) {
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
        return { ...state, notice: "Mark at least one video before Keep", armedAction: null };
      }
      if (wouldExceedFolderLimit(state)) {
        return { ...state, notice: "Session folder is full. Choose the next folder", armedAction: null };
      }
      if (state.armedAction !== "keep") {
        return { ...state, armedAction: "keep", notice: "Keep will move marked files to the session folder" };
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
        return { ...state, armedAction: "reject", notice: "Delete will remove torrent files with deleteFiles=true" };
      }
      return state;
    case "openExternal": {
      const candidate = getActiveCandidate(state);
      return { ...state, notice: candidate ? `Opening ${candidate.name}` : "No video candidate selected" };
    }
    case "openFolder": {
      const torrent = getActiveTorrent(state);
      return { ...state, notice: torrent ? `Opening folder for ${torrent.name}` : "No torrent selected" };
    }
    case "actionStarted":
      return { ...state, actionBusy: true, notice: action.label };
    case "actionFinished":
      return withToast({ ...state, actionBusy: false, armedAction: null, notice: action.notice }, action.notice, "success");
    case "actionFailed":
      return withToast({ ...state, actionBusy: false, notice: action.message }, action.message, "error");
    case "folderCountIncremented":
      return {
        ...state,
        settings: {
          ...state.settings,
          folderCount: state.settings.folderCount + action.count,
        },
        folderCountFloor: {
          sessionFolder: state.settings.sessionFolder,
          count: state.settings.folderCount + action.count,
        },
      };
    case "folderCountSet":
      return {
        ...state,
        settings: {
          ...state.settings,
          folderCount: action.count,
        },
        folderCountFloor: {
          sessionFolder: state.settings.sessionFolder,
          count: action.count,
        },
      };
    case "candidatesMoved":
      return candidatesMoved(state, action.hash, action.fileIndexes, action.folderCount);
    case "torrentRemoved":
      return removeTorrent(state, action.hash, action.nextHash);
    case "toastDismissed":
      return { ...state, toast: null };
    case "cancel":
      return { ...state, armedAction: null, notice: "Action cancelled" };
    case "toggleSettings":
      return { ...state, settingsOpen: !state.settingsOpen, armedAction: null };
    case "settingsUpdated":
      return withToast(
        { ...state, settings: action.settings, folderCountFloor: null, settingsOpen: false, notice: "Settings saved" },
        "Settings saved",
        "success",
      );
    default:
      return state;
  }
}

function folderCountFloorForRefresh(
  state: ReviewState,
  settings: LocalSettings,
): ReviewState["folderCountFloor"] {
  if (!state.folderCountFloor || settings.sessionFolder !== state.folderCountFloor.sessionFolder) {
    return null;
  }
  return settings.folderCount < state.folderCountFloor.count ? state.folderCountFloor : null;
}

function withToast(state: ReviewState, message: string, tone: ToastTone): ReviewState {
  const toastId = state.toastId + 1;
  return {
    ...state,
    toastId,
    toast: { id: toastId, message: toastMessage(message), tone },
  };
}

function toastMessage(message: string): string {
  return message.trim().replace(/\.+$/, "");
}

function removeTorrent(state: ReviewState, hash: string, nextHash: string | null): ReviewState {
  const { [hash]: _removedDetail, ...detailsByHash } = state.detailsByHash;
  const { [hash]: _removedMarked, ...markedByTorrent } = state.markedByTorrent;
  const { [hash]: _removedMoved, ...movedByTorrent } = state.movedByTorrent;
  const torrents = state.torrents.filter((torrent) => torrent.hash !== hash);
  const activeTorrentHash = nextHash && torrents.some((torrent) => torrent.hash === nextHash)
    ? nextHash
    : torrents[0]?.hash ?? null;
  return {
    ...state,
    torrents,
    detailsByHash,
    markedByTorrent,
    movedByTorrent,
    activeTorrentHash,
    activeCandidateIndex: 0,
    armedAction: null,
  };
}

function candidatesMoved(
  state: ReviewState,
  hash: string,
  fileIndexes: number[],
  folderCount: number,
): ReviewState {
  const moved = new Set([...(state.movedByTorrent[hash] ?? []), ...fileIndexes]);
  const marked = new Set(state.markedByTorrent[hash] ?? []);
  for (const fileIndex of fileIndexes) {
    marked.delete(fileIndex);
  }
  return {
    ...state,
    markedByTorrent: {
      ...state.markedByTorrent,
      [hash]: [...marked].sort((left, right) => left - right),
    },
    movedByTorrent: {
      ...state.movedByTorrent,
      [hash]: [...moved].sort((left, right) => left - right),
    },
    settings: {
      ...state.settings,
      folderCount,
    },
    folderCountFloor: {
      sessionFolder: state.settings.sessionFolder,
      count: folderCount,
    },
  };
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
  if (getMovedCandidateIndexes(state, torrent.hash).includes(fileIndex)) {
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
