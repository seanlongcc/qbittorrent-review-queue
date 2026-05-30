import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  getHistory,
  getQueue,
  getTorrentDetail,
  keepTorrent,
  openTorrentFile,
  openTorrentFolder,
  rejectTorrent,
} from "./api/client";
import type { ExecutionHistoryItem, QueueResponse } from "./domain/types";
import {
  MediaStage,
  QueueSidebar,
  ReviewCommandBar,
  SettingsPanel,
  TitleBar,
  ToastViewport,
} from "./review/Workbench";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReviewPanelTabs } from "./review/ReviewPanelTabs";
import { commandFromKey, type ReviewCommand } from "./review/keyboard";
import { sortReviewableTorrents, type QueueSort } from "./review/queueSort";
import {
  createInitialState,
  getActiveCandidate,
  getActiveTorrent,
  getMarkedCandidateIndexes,
  getMarkedCandidates,
  getMovedCandidateIndexes,
  getReviewableTorrents,
  isActiveTorrentMissing,
  reviewReducer,
  wouldExceedFolderLimit,
} from "./review/reviewState";

export function App() {
  const [state, dispatch] = useReducer(reviewReducer, undefined, () => createInitialState());
  const [queueSort, setQueueSort] = useState<QueueSort>({ field: "added", direction: "desc" });
  const [previewMuted, setPreviewMuted] = useState(false);
  const [historyItems, setHistoryItems] = useState<ExecutionHistoryItem[]>([]);
  const reviewableTorrents = getReviewableTorrents(state);
  const sortedReviewableTorrents = useMemo(
    () => sortReviewableTorrents(reviewableTorrents, queueSort),
    [queueSort, reviewableTorrents],
  );
  const activeTorrent = getActiveTorrent(state);
  const activeCandidate = getActiveCandidate(state);
  const markedCandidates = getMarkedCandidates(state);
  const markedIndexes = getMarkedCandidateIndexes(state);
  const movedIndexes = getMovedCandidateIndexes(state);
  const activeMissing = isActiveTorrentMissing(state);

  const refreshQueue = useCallback(async (options: { toast?: boolean } = {}): Promise<QueueResponse | null> => {
    dispatch({ type: "queueLoading", toast: options.toast ? "Refreshing qBittorrent queue" : undefined });
    try {
      const response = await getQueue();
      dispatch({
        type: "queueLoaded",
        torrents: response.torrents,
        attentionTorrents: response.attentionTorrents,
        settings: response.settings,
      });
      return response;
    } catch (error) {
      dispatch({ type: "queueFailed", message: errorMessage(error) });
      return null;
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const response = await getHistory();
      setHistoryItems(response.items);
    } catch {
      // History is supporting context. Review actions keep their own busy/error state.
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const topTorrent = sortedReviewableTorrents[0];
    if (!state.activeTorrentHash && topTorrent) {
      dispatch({ type: "selectTorrent", hash: topTorrent.hash });
    }
  }, [sortedReviewableTorrents, state.activeTorrentHash]);

  useEffect(() => {
    if (!state.settings.connected) {
      return;
    }
    const interval = window.setInterval(() => {
      if (document.hidden || state.actionBusy || state.settingsOpen) {
        return;
      }
      void refreshQueue();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [refreshQueue, state.actionBusy, state.settings.connected, state.settingsOpen]);

  useEffect(() => {
    if (!state.activeTorrentHash) {
      return;
    }
    const detail = state.detailsByHash[state.activeTorrentHash];
    if (detail?.candidates) {
      return;
    }
    let active = true;
    dispatch({ type: "detailLoading" });
    getTorrentDetail(state.activeTorrentHash)
      .then((torrent) => {
        if (active) {
          dispatch({ type: "detailLoaded", torrent });
        }
      })
      .catch((error) => {
        if (active) {
          dispatch({ type: "detailFailed", message: errorMessage(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [state.activeTorrentHash, state.detailsByHash]);

  const runKeep = useCallback(async () => {
    const torrent = getActiveTorrent(state);
    const marked = getMarkedCandidates(state);
    if (isActiveTorrentMissing(state)) {
      dispatch({ type: "keep" });
      return;
    }
    if (!torrent || marked.length === 0 || wouldExceedFolderLimit(state)) {
      dispatch({ type: "keep" });
      return;
    }
    if (state.armedAction !== "keep") {
      dispatch({ type: "keep" });
      return;
    }
    dispatch({ type: "actionStarted", label: "Keeping marked files" });
    try {
      const result = await keepTorrent(torrent.hash, {
        fileIndexes: marked.map((candidate) => candidate.fileIndex),
        confirmed: true,
      });
      dispatch({
        type: "candidatesMoved",
        hash: torrent.hash,
        fileIndexes: marked.map((candidate) => candidate.fileIndex),
        folderCount: result.folderCount,
      });
      dispatch({ type: "actionFinished", notice: `Kept ${marked.length} video${marked.length === 1 ? "" : "s"}` });
      await refreshHistory();
      await refreshQueue();
    } catch (error) {
      dispatch({ type: "actionFailed", message: errorMessage(error) });
    }
  }, [refreshHistory, refreshQueue, state]);

  const runReject = useCallback(async () => {
    const torrent = getActiveTorrent(state);
    if (isActiveTorrentMissing(state)) {
      dispatch({ type: "reject" });
      return;
    }
    if (!torrent) {
      return;
    }
    if (state.armedAction !== "reject") {
      dispatch({ type: "reject" });
      return;
    }
    dispatch({ type: "actionStarted", label: "Deleting torrent with deleteFiles=true" });
    try {
      const nextHash = nextSortedTorrentHash(sortedReviewableTorrents, torrent.hash, 1);
      await rejectTorrent(torrent.hash, { confirmed: true });
      dispatch({ type: "actionFinished", notice: "Deleted torrent and files" });
      dispatch({ type: "torrentRemoved", hash: torrent.hash, nextHash });
      await refreshHistory();
      await refreshQueue();
    } catch (error) {
      dispatch({ type: "actionFailed", message: errorMessage(error) });
    }
  }, [refreshHistory, refreshQueue, sortedReviewableTorrents, state]);

  const runOpenExternal = useCallback(async () => {
    const torrent = getActiveTorrent(state);
    const candidate = getActiveCandidate(state);
    if (isActiveTorrentMissing(state)) {
      dispatch({ type: "actionFailed", message: "Selected torrent no longer in qBittorrent. Choose Next or Refresh" });
      return;
    }
    if (!torrent || !candidate) {
      dispatch({ type: "openExternal" });
      return;
    }
    dispatch({ type: "actionStarted", label: `Opening ${candidate.name}` });
    try {
      await openTorrentFile(torrent.hash, candidate.fileIndex);
      dispatch({ type: "actionFinished", notice: `Opened ${candidate.name}` });
      await refreshHistory();
    } catch (error) {
      dispatch({ type: "actionFailed", message: errorMessage(error) });
    }
  }, [refreshHistory, state]);

  const runOpenFolder = useCallback(async () => {
    const torrent = getActiveTorrent(state);
    if (isActiveTorrentMissing(state)) {
      dispatch({ type: "actionFailed", message: "Selected torrent no longer in qBittorrent. Choose Next or Refresh" });
      return;
    }
    if (!torrent) {
      dispatch({ type: "openFolder" });
      return;
    }
    dispatch({ type: "actionStarted", label: `Opening folder for ${torrent.name}` });
    try {
      await openTorrentFolder(torrent.hash);
      dispatch({ type: "actionFinished", notice: `Opened folder for ${torrent.name}` });
    } catch (error) {
      dispatch({ type: "actionFailed", message: errorMessage(error) });
    }
  }, [state]);

  const handleCommand = useCallback(
    (command: ReviewCommand) => {
      if (command === "previousTorrent" || command === "nextTorrent") {
        const hash = nextSortedTorrentHash(
          sortedReviewableTorrents,
          state.activeTorrentHash,
          command === "nextTorrent" ? 1 : -1,
        );
        if (hash) {
          dispatch({ type: "selectTorrent", hash });
        }
        return;
      }
      if (command === "keep") {
        void runKeep();
        return;
      }
      if (command === "reject") {
        void runReject();
        return;
      }
      if (command === "openExternal") {
        void runOpenExternal();
        return;
      }
      if (command === "openFolder") {
        void runOpenFolder();
        return;
      }
      if (command === "toggleMute") {
        setPreviewMuted((muted) => !muted);
        return;
      }
      dispatch({ type: command });
    },
    [runKeep, runOpenExternal, runOpenFolder, runReject, sortedReviewableTorrents, state.activeTorrentHash],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = commandFromKey(event);
      if (!command) {
        return;
      }
      event.preventDefault();
      handleCommand(command);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [handleCommand]);

  useEffect(() => {
    if (!state.armedAction) {
      return;
    }
    const timeout = window.setTimeout(() => {
      dispatch({ type: "cancel" });
    }, 8_000);
    return () => window.clearTimeout(timeout);
  }, [state.activeTorrentHash, state.armedAction, markedIndexes]);

  return (
    <TooltipProvider>
      <main className="qbt-shell">
        <TitleBar
          settings={state.settings}
          busy={state.loadingQueue || state.actionBusy}
          refreshing={state.loadingQueue}
          onSettings={() => dispatch({ type: "toggleSettings" })}
        />
        <section className="qbt-main" aria-label="Review workbench">
          <QueueSidebar
            torrents={sortedReviewableTorrents}
            activeHash={state.activeTorrentHash}
            busy={state.actionBusy}
            loading={state.loadingQueue}
            sort={queueSort}
            onSelect={(hash) => dispatch({ type: "selectTorrent", hash })}
            onRefresh={() => void refreshQueue({ toast: true })}
            onSortChange={setQueueSort}
          />
          <section className="qbt-center">
            <MediaStage
              torrent={activeTorrent}
              candidate={activeCandidate}
              loading={state.loadingDetail}
              busy={state.actionBusy}
              muted={previewMuted}
              onToggleMuted={() => setPreviewMuted((muted) => !muted)}
              onOpenExternal={() => handleCommand("openExternal")}
              onOpenFolder={() => handleCommand("openFolder")}
            />
            <ReviewCommandBar
              markedCount={markedIndexes.length}
              folderCount={state.settings.folderCount}
              folderLimit={state.settings.sessionFolderLimit}
              armedAction={state.armedAction}
              busy={state.actionBusy}
              activeMissing={activeMissing}
              keepBlocked={activeMissing || markedCandidates.length === 0 || wouldExceedFolderLimit(state)}
              hasTorrent={Boolean(activeTorrent)}
              onCommand={handleCommand}
            />
            <ReviewPanelTabs
              torrent={activeTorrent}
              activeCandidate={activeCandidate}
              markedIndexes={markedIndexes}
              movedIndexes={movedIndexes}
              armedAction={state.armedAction}
              busy={state.actionBusy}
              activeMissing={activeMissing}
              historyItems={historyItems}
              onSelectCandidate={(index) => dispatch({ type: "selectCandidate", index })}
              onToggleMark={(fileIndex) => dispatch({ type: "toggleMark", fileIndex })}
              onCommand={handleCommand}
            />
          </section>
        </section>
        {state.settingsOpen ? (
          <SettingsPanel
            settings={state.settings}
            onClose={() => dispatch({ type: "toggleSettings" })}
            onSaved={(settings) => {
              dispatch({ type: "settingsUpdated", settings });
              void refreshQueue();
            }}
          />
        ) : null}
        <ToastViewport toast={state.toast} onDismiss={() => dispatch({ type: "toastDismissed" })} />
      </main>
    </TooltipProvider>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function nextSortedTorrentHash(
  torrents: ReturnType<typeof getReviewableTorrents>,
  activeHash: string | null,
  offset: number,
): string | null {
  if (!torrents.length) {
    return null;
  }
  const currentIndex = torrents.findIndex((torrent) => torrent.hash === activeHash);
  const nextIndex = currentIndex === -1
    ? (offset > 0 ? 0 : torrents.length - 1)
    : (currentIndex + offset + torrents.length) % torrents.length;
  return torrents[nextIndex].hash;
}
