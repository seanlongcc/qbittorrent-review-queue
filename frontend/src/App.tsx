import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  cleanupRetryTorrent,
  getQueue,
  getTorrentDetail,
  keepTorrent,
  openTorrentFile,
  rejectTorrent,
} from "./api/client";
import {
  CandidateTable,
  CandidateTabs,
  MediaStage,
  QueueSidebar,
  SettingsPanel,
  TitleBar,
  type QueueSort,
} from "./review/Workbench";
import { TooltipProvider } from "@/components/ui/tooltip";
import { commandFromKey, type ReviewCommand } from "./review/keyboard";
import {
  createInitialState,
  getActiveCandidate,
  getActiveTorrent,
  getAttentionTorrents,
  getMarkedCandidateIndexes,
  getMarkedCandidates,
  getReviewableTorrents,
  isActiveTorrentMissing,
  needsKeepConfirmation,
  reviewReducer,
  wouldExceedFolderLimit,
} from "./review/reviewState";

export function App() {
  const [state, dispatch] = useReducer(reviewReducer, undefined, () => createInitialState());
  const [queueSort, setQueueSort] = useState<QueueSort>({ field: "added", direction: "desc" });
  const reviewableTorrents = getReviewableTorrents(state);
  const sortedReviewableTorrents = useMemo(
    () => sortReviewableTorrents(reviewableTorrents, queueSort),
    [queueSort, reviewableTorrents],
  );
  const attentionTorrents = getAttentionTorrents(state);
  const activeTorrent = getActiveTorrent(state);
  const activeCandidate = getActiveCandidate(state);
  const markedCandidates = getMarkedCandidates(state);
  const markedIndexes = getMarkedCandidateIndexes(state);
  const activeMissing = isActiveTorrentMissing(state);

  const refreshQueue = useCallback(async () => {
    dispatch({ type: "queueLoading" });
    try {
      const response = await getQueue();
      dispatch({
        type: "queueLoaded",
        torrents: response.torrents,
        attentionTorrents: response.attentionTorrents,
        settings: response.settings,
      });
    } catch (error) {
      dispatch({ type: "queueFailed", message: errorMessage(error) });
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

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
    const confirmationNeeded = needsKeepConfirmation(state);
    if (confirmationNeeded && state.armedAction !== "keep") {
      dispatch({ type: "keep" });
      return;
    }
    dispatch({ type: "actionStarted", label: "Keeping marked files." });
    try {
      await keepTorrent(torrent.hash, {
        fileIndexes: marked.map((candidate) => candidate.fileIndex),
        confirmed: confirmationNeeded,
      });
      dispatch({ type: "actionFinished", notice: `Kept ${marked.length} video${marked.length === 1 ? "" : "s"}.` });
      await refreshQueue();
    } catch (error) {
      dispatch({ type: "actionFailed", message: errorMessage(error) });
    }
  }, [refreshQueue, state]);

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
    dispatch({ type: "actionStarted", label: "Rejecting torrent with deleteFiles=true." });
    try {
      await rejectTorrent(torrent.hash, { confirmed: true });
      dispatch({ type: "actionFinished", notice: "Rejected torrent and files." });
      await refreshQueue();
    } catch (error) {
      dispatch({ type: "actionFailed", message: errorMessage(error) });
    }
  }, [refreshQueue, state]);

  const runOpenExternal = useCallback(async () => {
    const torrent = getActiveTorrent(state);
    const candidate = getActiveCandidate(state);
    if (isActiveTorrentMissing(state)) {
      dispatch({ type: "actionFailed", message: "Selected torrent no longer in qBittorrent. Choose Next or Refresh." });
      return;
    }
    if (!torrent || !candidate) {
      dispatch({ type: "openExternal" });
      return;
    }
    dispatch({ type: "actionStarted", label: `Opening ${candidate.name}.` });
    try {
      await openTorrentFile(torrent.hash, candidate.fileIndex);
      dispatch({ type: "actionFinished", notice: `Opened ${candidate.name}.` });
    } catch (error) {
      dispatch({ type: "actionFailed", message: errorMessage(error) });
    }
  }, [state]);

  const runCleanupRetry = useCallback(
    async (hash: string) => {
      dispatch({ type: "actionStarted", label: "Retrying qBittorrent cleanup." });
      try {
        await cleanupRetryTorrent(hash, { confirmed: true });
        dispatch({ type: "actionFinished", notice: "Cleanup retry completed." });
        await refreshQueue();
      } catch (error) {
        dispatch({ type: "actionFailed", message: errorMessage(error) });
      }
    },
    [refreshQueue],
  );

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
      dispatch({ type: command });
    },
    [runKeep, runOpenExternal, runReject, sortedReviewableTorrents, state.activeTorrentHash],
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
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
          onSettings={() => dispatch({ type: "toggleSettings" })}
        />
        <section className="qbt-main" aria-label="Review workbench">
          <QueueSidebar
            torrents={sortedReviewableTorrents}
            attentionTorrents={attentionTorrents}
            activeHash={state.activeTorrentHash}
            settings={state.settings}
            busy={state.actionBusy}
            loading={state.loadingQueue}
            sort={queueSort}
            onSelect={(hash) => dispatch({ type: "selectTorrent", hash })}
            onCleanupRetry={(hash) => void runCleanupRetry(hash)}
            onRefresh={() => void refreshQueue()}
            onSortChange={setQueueSort}
          />
          <section className="qbt-center">
            <MediaStage
              torrent={activeTorrent}
              candidate={activeCandidate}
              loading={state.loadingDetail}
              busy={state.actionBusy}
              onOpenExternal={() => handleCommand("openExternal")}
            />
            <CandidateTabs onCommand={handleCommand} />
            <CandidateTable
              torrent={activeTorrent}
              activeCandidate={activeCandidate}
              markedIndexes={markedIndexes}
              settings={state.settings}
              armedAction={state.armedAction}
              busy={state.actionBusy}
              activeMissing={activeMissing}
              keepBlocked={activeMissing || markedCandidates.length === 0 || wouldExceedFolderLimit(state)}
              notice={state.notice}
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
      </main>
    </TooltipProvider>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function sortReviewableTorrents(torrents: ReturnType<typeof getReviewableTorrents>, sort: QueueSort) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return torrents
    .map((torrent, index) => ({ torrent, index }))
    .sort((left, right) => {
      if (sort.field === "name") {
        const compared = left.torrent.name.localeCompare(right.torrent.name, undefined, { sensitivity: "base" });
        return compared === 0 ? left.index - right.index : compared * direction;
      }
      if (sort.field === "size") {
        const compared = left.torrent.totalSizeBytes - right.torrent.totalSizeBytes;
        return compared === 0 ? left.index - right.index : compared * direction;
      }
      return (left.index - right.index) * direction;
    })
    .map(({ torrent }) => torrent);
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
