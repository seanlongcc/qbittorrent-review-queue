import { useEffect, useMemo, useReducer } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  ExternalLink,
  FolderOpen,
  HardDrive,
  ListVideo,
  Play,
  RefreshCw,
  Settings,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { mockSettings, mockTorrents } from "./api/mockData";
import type { LocalSettings, ReviewTorrent, VideoCandidate } from "./domain/types";
import { formatBytes, shortHash } from "./review/format";
import { commandFromKey } from "./review/keyboard";
import {
  createInitialState,
  getActiveCandidate,
  getActiveTorrent,
  getAttentionTorrents,
  getMarkedCandidateIndexes,
  getMarkedCandidates,
  getReviewableTorrents,
  needsKeepConfirmation,
  reviewReducer,
  wouldExceedFolderLimit,
} from "./review/reviewState";

export function App() {
  const [state, dispatch] = useReducer(
    reviewReducer,
    undefined,
    () => createInitialState(mockTorrents, mockSettings),
  );

  const reviewableTorrents = getReviewableTorrents(state);
  const attentionTorrents = getAttentionTorrents(state);
  const activeTorrent = getActiveTorrent(state);
  const activeCandidate = getActiveCandidate(state);
  const markedCandidates = getMarkedCandidates(state);
  const folderRemaining = Math.max(0, state.settings.sessionFolderLimit - state.settings.folderCount);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = commandFromKey(event);
      if (!command) {
        return;
      }

      event.preventDefault();
      dispatch({ type: command });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const keepBlocked = markedCandidates.length === 0 || wouldExceedFolderLimit(state);
  const keepTone = state.armedAction === "keep" ? "warning" : "primary";
  const rejectTone = state.armedAction === "reject" ? "danger-confirm" : "danger";

  return (
    <main className="review-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Local qBittorrent</p>
          <h1>Review Queue</h1>
        </div>
        <div className="top-bar__meta" aria-label="Queue summary">
          <StatusPill connected={state.settings.connected} />
          <span className="mono-pill">{reviewableTorrents.length} ready</span>
          <span className="mono-pill">{folderRemaining} folder slots</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Refresh queue"
            title="Refresh queue"
            onClick={() => dispatch({ type: "cancel" })}
          >
            <RefreshCw size={17} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Open settings"
            title="Open settings"
            onClick={() => dispatch({ type: "toggleSettings" })}
          >
            <Settings size={17} />
          </button>
        </div>
      </header>

      <section className="workbench" aria-label="Review workbench">
        <QueueRail
          torrents={reviewableTorrents}
          attentionTorrents={attentionTorrents}
          activeHash={state.activeTorrentHash}
          onSelect={(hash) => dispatch({ type: "selectTorrent", hash })}
        />

        <section className="stage-column" aria-label="Selected video">
          <MediaStage torrent={activeTorrent} candidate={activeCandidate} />
          <ActionBar
            activeTorrent={activeTorrent}
            activeCandidate={activeCandidate}
            markedCount={markedCandidates.length}
            keepBlocked={keepBlocked}
            keepTone={keepTone}
            rejectTone={rejectTone}
            needsKeepConfirmation={needsKeepConfirmation(state)}
            armedAction={state.armedAction}
            notice={state.notice}
            onPreviousTorrent={() => dispatch({ type: "previousTorrent" })}
            onNextTorrent={() => dispatch({ type: "nextTorrent" })}
            onPreviousCandidate={() => dispatch({ type: "previousCandidate" })}
            onNextCandidate={() => dispatch({ type: "nextCandidate" })}
            onOpenExternal={() => dispatch({ type: "openExternal" })}
            onKeep={() => dispatch({ type: "keep" })}
            onReject={() => dispatch({ type: "reject" })}
            onCancel={() => dispatch({ type: "cancel" })}
          />
        </section>

        <CandidateRail
          torrent={activeTorrent}
          activeCandidateIndex={state.activeCandidateIndex}
          markedIndexes={getMarkedCandidateIndexes(state)}
          settings={state.settings}
          settingsOpen={state.settingsOpen}
          onSelectCandidate={(index) => dispatch({ type: "selectCandidate", index })}
          onToggleMark={(index) => dispatch({ type: "toggleMark", index })}
          onToggleSettings={() => dispatch({ type: "toggleSettings" })}
          onUpdateSettings={(settings) => dispatch({ type: "updateSettings", settings })}
        />
      </section>
    </main>
  );
}

function StatusPill({ connected }: { connected: boolean }) {
  return (
    <span className={connected ? "status-pill status-pill--ok" : "status-pill status-pill--off"}>
      {connected ? <Check size={14} /> : <WifiOff size={14} />}
      {connected ? "Connected" : "Sample data"}
    </span>
  );
}

function QueueRail({
  torrents,
  attentionTorrents,
  activeHash,
  onSelect,
}: {
  torrents: ReviewTorrent[];
  attentionTorrents: ReviewTorrent[];
  activeHash: string | null;
  onSelect: (hash: string) => void;
}) {
  return (
    <aside className="rail queue-rail" aria-label="Review queue">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Completed</p>
          <h2>Queue</h2>
        </div>
        <span className="count-badge">{torrents.length}</span>
      </div>

      <div className="queue-list">
        {torrents.map((torrent) => (
          <button
            className={torrent.hash === activeHash ? "queue-row queue-row--active" : "queue-row"}
            key={torrent.hash}
            type="button"
            onClick={() => onSelect(torrent.hash)}
          >
            <span className="queue-row__title">{torrent.name}</span>
            <span className="queue-row__meta">
              <ListVideo size={14} />
              {torrent.candidates.length} videos
              <span>{formatBytes(torrent.totalSizeBytes)}</span>
            </span>
          </button>
        ))}
      </div>

      <details className="attention-block" open={attentionTorrents.length > 0}>
        <summary>
          <AlertTriangle size={15} />
          Needs attention
          <span>{attentionTorrents.length}</span>
        </summary>
        <div className="attention-list">
          {attentionTorrents.map((torrent) => (
            <div className="attention-row" key={torrent.hash}>
              <strong>{torrent.name}</strong>
              <span>{torrent.attentionDetail ?? torrent.attentionReason}</span>
            </div>
          ))}
        </div>
      </details>
    </aside>
  );
}

function MediaStage({
  torrent,
  candidate,
}: {
  torrent: ReviewTorrent | null;
  candidate: VideoCandidate | null;
}) {
  const mediaSrc = useMemo(() => {
    if (!torrent || !candidate) {
      return "";
    }
    return `/media/${torrent.hash}/${candidate.fileIndex}`;
  }, [candidate, torrent]);

  return (
    <section className="media-stage" aria-label="Media preview">
      {torrent && candidate ? (
        <>
          <div className="media-stage__chrome">
            <div className="media-title">
              <Play size={16} />
              <span>{candidate.name}</span>
            </div>
            <span className="mono-pill">{candidate.extension.toUpperCase()}</span>
          </div>
          <div className="preview-frame">
            {candidate.playable ? (
              <video className="preview-video" controls preload="metadata" src={mediaSrc} />
            ) : (
              <PreviewUnavailable candidate={candidate} />
            )}
          </div>
          <div className="path-strip">
            <span>{shortHash(torrent.hash)}</span>
            <span>{candidate.path}</span>
          </div>
        </>
      ) : (
        <div className="empty-stage">
          <HardDrive size={28} />
          <h2>Queue empty</h2>
          <p>No completed torrents are ready.</p>
        </div>
      )}
    </section>
  );
}

function PreviewUnavailable({ candidate }: { candidate: VideoCandidate }) {
  return (
    <div className="preview-unavailable">
      <div className="preview-grid" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div>
        <p className="eyebrow">External player</p>
        <h2>{candidate.name}</h2>
        <p>{formatBytes(candidate.sizeBytes)}</p>
      </div>
    </div>
  );
}

function ActionBar({
  activeTorrent,
  activeCandidate,
  markedCount,
  keepBlocked,
  keepTone,
  rejectTone,
  needsKeepConfirmation: keepNeedsConfirmation,
  armedAction,
  notice,
  onPreviousTorrent,
  onNextTorrent,
  onPreviousCandidate,
  onNextCandidate,
  onOpenExternal,
  onKeep,
  onReject,
  onCancel,
}: {
  activeTorrent: ReviewTorrent | null;
  activeCandidate: VideoCandidate | null;
  markedCount: number;
  keepBlocked: boolean;
  keepTone: "primary" | "warning";
  rejectTone: "danger" | "danger-confirm";
  needsKeepConfirmation: boolean;
  armedAction: "keep" | "reject" | null;
  notice: string;
  onPreviousTorrent: () => void;
  onNextTorrent: () => void;
  onPreviousCandidate: () => void;
  onNextCandidate: () => void;
  onOpenExternal: () => void;
  onKeep: () => void;
  onReject: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="action-bar" aria-label="Review actions">
      <div className="action-bar__nav">
        <button className="icon-button" type="button" aria-label="Previous torrent" onClick={onPreviousTorrent}>
          <ChevronLeft size={18} />
        </button>
        <button className="icon-button" type="button" aria-label="Previous video" onClick={onPreviousCandidate}>
          <ChevronLeft size={18} />
          <ListVideo size={15} />
        </button>
        <button className="icon-button" type="button" aria-label="Next video" onClick={onNextCandidate}>
          <ListVideo size={15} />
          <ChevronRight size={18} />
        </button>
        <button className="icon-button" type="button" aria-label="Next torrent" onClick={onNextTorrent}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="action-status" role="status">
        <span>{notice}</span>
        <span className="mono-pill">{markedCount} marked</span>
      </div>

      <div className="action-bar__commands">
        <button
          className="button button--outline"
          type="button"
          disabled={!activeCandidate}
          onClick={onOpenExternal}
        >
          <ExternalLink size={16} />
          Open
        </button>
        <button
          className={`button button--${keepTone}`}
          type="button"
          disabled={!activeTorrent || keepBlocked}
          onClick={onKeep}
        >
          <Check size={16} />
          {armedAction === "keep" && keepNeedsConfirmation ? "Confirm Keep" : "Keep"}
        </button>
        <button
          className={`button button--${rejectTone}`}
          type="button"
          disabled={!activeTorrent}
          onClick={onReject}
        >
          <Trash2 size={16} />
          {armedAction === "reject" ? "Confirm Reject" : "Reject"}
        </button>
        {armedAction ? (
          <button className="icon-button" type="button" aria-label="Cancel action" onClick={onCancel}>
            <X size={17} />
          </button>
        ) : null}
      </div>
    </section>
  );
}

function CandidateRail({
  torrent,
  activeCandidateIndex,
  markedIndexes,
  settings,
  settingsOpen,
  onSelectCandidate,
  onToggleMark,
  onToggleSettings,
  onUpdateSettings,
}: {
  torrent: ReviewTorrent | null;
  activeCandidateIndex: number;
  markedIndexes: number[];
  settings: LocalSettings;
  settingsOpen: boolean;
  onSelectCandidate: (index: number) => void;
  onToggleMark: (index: number) => void;
  onToggleSettings: () => void;
  onUpdateSettings: (settings: Partial<LocalSettings>) => void;
}) {
  return (
    <aside className="rail candidate-rail" aria-label="Torrent detail">
      {settingsOpen ? (
        <SettingsPanel settings={settings} onClose={onToggleSettings} onUpdate={onUpdateSettings} />
      ) : (
        <>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Video candidates</p>
              <h2>{torrent?.candidates.length ?? 0} files</h2>
            </div>
            <FolderOpen size={18} />
          </div>
          <div className="capacity-meter" aria-label="Session folder capacity">
            <div>
              <span>{settings.folderCount}</span>
              <span>/ {settings.sessionFolderLimit}</span>
            </div>
            <meter min={0} max={settings.sessionFolderLimit} value={settings.folderCount} />
          </div>
          <div className="candidate-list" aria-label="Video candidates">
            {torrent?.candidates.map((candidate, index) => {
              const marked = markedIndexes.includes(index);
              const active = index === activeCandidateIndex;
              return (
                <div
                  className={[
                    "candidate-row",
                    active ? "candidate-row--active" : "",
                    marked ? "candidate-row--marked" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={candidate.fileIndex}
                >
                  <button
                    className="candidate-row__main"
                    type="button"
                    onClick={() => onSelectCandidate(index)}
                  >
                    <span className="candidate-row__name">{candidate.name}</span>
                    <span className="candidate-row__meta">
                      {formatBytes(candidate.sizeBytes)}
                      <span>index {candidate.fileIndex}</span>
                    </span>
                  </button>
                  <button
                    className="mark-button"
                    type="button"
                    aria-pressed={marked}
                    aria-label={marked ? "Unmark candidate" : "Mark candidate"}
                    onClick={() => onToggleMark(index)}
                  >
                    {marked ? <CircleCheck size={18} /> : <Circle size={18} />}
                  </button>
                </div>
              );
            })}
          </div>
          <details className="junk-block">
            <summary>
              Junk files
              <span>{torrent?.junkFiles.length ?? 0}</span>
            </summary>
            <div className="junk-list">
              {torrent?.junkFiles.map((file) => (
                <div className="junk-row" key={file.fileIndex}>
                  <span>{file.name}</span>
                  <span>{formatBytes(file.sizeBytes)}</span>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </aside>
  );
}

function SettingsPanel({
  settings,
  onClose,
  onUpdate,
}: {
  settings: LocalSettings;
  onClose: () => void;
  onUpdate: (settings: Partial<LocalSettings>) => void;
}) {
  return (
    <form
      className="settings-panel"
      aria-label="Settings"
      onSubmit={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Local settings</p>
          <h2>Connection</h2>
        </div>
        <button className="icon-button" type="button" aria-label="Close settings" onClick={onClose}>
          <X size={17} />
        </button>
      </div>

      <label>
        WebUI URL
        <input
          value={settings.qbtBaseUrl}
          onChange={(event) => onUpdate({ qbtBaseUrl: event.target.value })}
        />
      </label>
      <label>
        Username
        <input
          value={settings.qbtUsername}
          onChange={(event) => onUpdate({ qbtUsername: event.target.value })}
        />
      </label>
      <label>
        Session folder
        <input
          value={settings.sessionFolder}
          onChange={(event) => onUpdate({ sessionFolder: event.target.value })}
        />
      </label>
      <label>
        Folder limit
        <input
          type="number"
          min={1}
          value={settings.sessionFolderLimit}
          onChange={(event) => onUpdate({ sessionFolderLimit: Number(event.target.value) })}
        />
      </label>
      <button className="button button--primary" type="submit">
        <Check size={16} />
        Apply
      </button>
    </form>
  );
}
