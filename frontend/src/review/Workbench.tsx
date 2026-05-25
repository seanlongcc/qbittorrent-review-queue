import { useEffect, useRef, useState, type ComponentProps, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  ExternalLink,
  Film,
  FolderCheck,
  FolderOpen,
  RefreshCw,
  Settings,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { pickFolder, updateSettings } from "@/api/client";
import { Button } from "@/components/ui/button";
import type { LocalSettings, ReviewTorrent, SettingsUpdate, VideoCandidate } from "@/domain/types";
import { formatBytes } from "./format";
import type { ReviewCommand } from "./keyboard";
import { sortDescription, type QueueSort, type QueueSortField } from "./queueSort";
import type { ReviewToast } from "./reviewState";

export function TitleBar({
  settings,
  busy,
  refreshing,
  onSettings,
}: {
  settings: LocalSettings;
  busy: boolean;
  refreshing: boolean;
  onSettings: () => void;
}) {
  const apiLabel = settings.connected
    ? (refreshing ? "API refreshing" : "API connected")
    : "API disconnected";
  return (
    <header className="qbt-titlebar">
      <div className="qbt-brand">
        <span>qBittorrent Review Queue</span>
      </div>
      <div className="qbt-title-actions">
        <span className="qbt-url-pill">{settings.qbtBaseUrl}</span>
        <span className={settings.connected ? "api-pill" : "api-pill offline"} role="status">
          <span className="api-dot" aria-hidden="true" />
          {apiLabel}
        </span>
        <Button className="btn" type="button" disabled={busy} onClick={onSettings}>
          <Settings size={15} />
          <span>Settings</span>
        </Button>
      </div>
    </header>
  );
}

export function QueueSidebar({
  torrents,
  activeHash,
  busy,
  loading,
  sort,
  onSelect,
  onRefresh,
  onSortChange,
}: {
  torrents: ReviewTorrent[];
  activeHash: string | null;
  busy: boolean;
  loading: boolean;
  sort: QueueSort;
  onSelect: (hash: string) => void;
  onRefresh: () => void;
  onSortChange: (sort: QueueSort) => void;
}) {
  const activeTorrentRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!activeHash) {
      return;
    }
    const activeTorrent = activeTorrentRef.current;
    const torrentRail = activeTorrent?.closest(".torrent-list");
    if (
      activeTorrent &&
      torrentRail instanceof HTMLElement &&
      torrentRail.scrollHeight > torrentRail.clientHeight
    ) {
      activeTorrent.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }
  }, [activeHash]);

  return (
    <aside className="qbt-sidebar" aria-label="Review queue">
      <div className="queue-top">
        <div className="queue-head">
          <div>
            <h2>Queue</h2>
          </div>
          <Button
            aria-label="Refresh queue"
            className="btn icon-btn"
            title="Refresh queue"
            type="button"
            disabled={busy || loading}
            onClick={onRefresh}
          >
            <RefreshCw size={15} />
          </Button>
        </div>
      </div>
      <div className="sort-box" aria-label="Queue sort">
        <div className="sort-row">
          <label htmlFor="queue-sort">Sort</label>
          <select
            id="queue-sort"
            value={sort.field}
            onChange={(event) => onSortChange({ ...sort, field: event.target.value as QueueSortField })}
          >
            <option value="added">Added on</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
          </select>
          <button
            className="sort-direction"
            type="button"
            aria-label={sort.direction === "desc" ? "Switch to ascending sort" : "Switch to descending sort"}
            title={sort.direction === "desc" ? "Descending" : "Ascending"}
            onClick={() => onSortChange({ ...sort, direction: sort.direction === "desc" ? "asc" : "desc" })}
          >
            {sort.direction === "desc" ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
          </button>
        </div>
        <span>{sortDescription(sort)}</span>
      </div>
      <div className="side-head"><span>Torrents <span className="count-pill">{torrents.length}</span></span><span>Size</span></div>
      <div className="torrent-list">
        {torrents.map((torrent) => {
          const active = torrent.hash === activeHash;
          const candidateCount = torrent.candidates?.length ?? 0;
          return (
            <button
              aria-current={active ? "true" : undefined}
              className={active ? "torrent active" : "torrent"}
              key={torrent.hash}
              ref={active ? activeTorrentRef : undefined}
              type="button"
              onClick={() => onSelect(torrent.hash)}
            >
              <span className="torrent-line">
                <span className="name">{torrent.name}</span>
                <span className="meta">{formatBytes(torrent.totalSizeBytes)}</span>
              </span>
              {candidateCount ? (
                <span className="meta">{candidateCount} video{candidateCount === 1 ? "" : "s"}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export function MediaStage({
  torrent,
  candidate,
  loading,
  busy = false,
  muted = false,
  onToggleMuted,
  onOpenExternal,
}: {
  torrent: ReviewTorrent | null;
  candidate: VideoCandidate | null;
  loading: boolean;
  busy?: boolean;
  muted?: boolean;
  onToggleMuted?: () => void;
  onOpenExternal?: () => void;
}) {
  const mediaSrc = torrent && candidate ? `/media/${torrent.hash}/${candidate.fileIndex}` : "";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const openExternal = () => {
    videoRef.current?.pause();
    onOpenExternal?.();
  };
  return (
    <section aria-label="Media preview" className="preview-section">
      <div className="preview-head">
        <div>
          <strong>{candidate?.name ?? torrent?.name ?? "No torrent selected"}</strong>
          <p className="path">{candidate?.path ?? torrent?.savePath ?? "Queue empty or disconnected."}</p>
        </div>
        {onToggleMuted ? (
          <Button
            aria-label={muted ? "Unmute preview audio" : "Mute preview audio"}
            aria-pressed={muted}
            className="btn icon-btn"
            disabled={busy || !candidate?.playable}
            title={muted ? "Unmute preview audio" : "Mute preview audio"}
            type="button"
            onClick={onToggleMuted}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </Button>
        ) : null}
        {onOpenExternal ? (
          <CommandButton
            aria-label="Open external, T"
            className="icon-command"
            disabled={busy || !candidate}
            command="T"
            title="Open external"
            onClick={openExternal}
          >
            <ExternalLink size={15} />
          </CommandButton>
        ) : null}
      </div>
      <div className="preview">
        {candidate?.playable ? (
          <video
            aria-label="Autoplay video preview"
            autoPlay
            className="preview-video"
            controls
            muted={muted}
            playsInline
            preload="auto"
            ref={videoRef}
            src={mediaSrc}
          />
        ) : (
          candidate ? (
            <div className="video-placeholder">
              <Film size={28} /> Preview unavailable, use Open external
            </div>
          ) : (
            <div aria-label="Empty media preview" className="video-placeholder empty" />
          )
        )}
      </div>
    </section>
  );
}

export function ReviewCommandBar({
  markedCount,
  folderCount,
  folderLimit,
  armedAction,
  busy,
  activeMissing,
  keepBlocked,
  hasTorrent,
  onCommand,
}: {
  markedCount: number;
  folderCount: number;
  folderLimit: number;
  armedAction: "keep" | "reject" | null;
  busy: boolean;
  activeMissing: boolean;
  keepBlocked: boolean;
  hasTorrent: boolean;
  onCommand: (command: ReviewCommand) => void;
}) {
  const slotsLeft = Math.max(folderLimit - folderCount, 0);

  return (
    <div className="candidate-tabs" aria-label="Review commands">
      <div className="candidate-nav">
        <CommandButton
          aria-label="Previous torrent, Q"
          className="icon-command"
          command="Q"
          title="Previous torrent"
          onClick={() => onCommand("previousTorrent")}
        >
          <SkipBack size={15} />
        </CommandButton>
        <CommandButton
          aria-label="Previous video, W"
          className="icon-command"
          command="W"
          title="Previous video"
          onClick={() => onCommand("previousCandidate")}
        >
          <ChevronLeft size={15} />
        </CommandButton>
        <CommandButton
          aria-label="Next video, S"
          className="icon-command"
          command="S"
          title="Next video"
          onClick={() => onCommand("nextCandidate")}
        >
          <ChevronRight size={15} />
        </CommandButton>
        <CommandButton
          aria-label="Next torrent, A"
          className="icon-command"
          command="A"
          title="Next torrent"
          onClick={() => onCommand("nextTorrent")}
        >
          <SkipForward size={15} />
        </CommandButton>
      </div>
      <div className="candidate-actions">
        <span className="slot-pill" title="Session folder slots left">
          <strong>{slotsLeft}</strong>
          <span>slots left</span>
        </span>
        <span className="slot-pill">
          <strong>{markedCount}</strong>
          <span>marked</span>
        </span>
        <CommandButton className="mark-command" command="F" tone="primary" onClick={() => onCommand("toggleMark")}>
          <Check size={15} />
          <span>Mark</span>
        </CommandButton>
        <CommandButton disabled={busy || keepBlocked} command="E" tone="keep" onClick={() => onCommand("keep")}>
          <FolderCheck size={15} />
          <span>{armedAction === "keep" ? "Confirm" : "Keep"}</span>
        </CommandButton>
        <CommandButton disabled={busy || !hasTorrent || activeMissing} command="D" tone="reject" onClick={() => onCommand("reject")}>
          <Trash2 size={15} />
          <span>{armedAction === "reject" ? "Confirm" : "Delete"}</span>
        </CommandButton>
      </div>
    </div>
  );
}

export function CandidateTable({
  torrent,
  activeCandidate,
  markedIndexes,
  armedAction,
  busy,
  activeMissing,
  onSelectCandidate,
  onToggleMark,
  onCommand,
}: {
  torrent: ReviewTorrent | null;
  activeCandidate: VideoCandidate | null;
  markedIndexes: number[];
  armedAction: "keep" | "reject" | null;
  busy: boolean;
  activeMissing: boolean;
  onSelectCandidate: (index: number) => void;
  onToggleMark: (fileIndex: number) => void;
  onCommand: (command: ReviewCommand) => void;
}) {
  const candidates = torrent?.candidates ?? [];

  return (
    <section aria-label="Video candidates" className="candidate-section">
      {activeMissing ? (
        <div className="vanished-alert" role="status">
          Selected torrent no longer in qBittorrent. Keep and Delete are disabled until you choose another torrent or refresh.
        </div>
      ) : null}
      {armedAction === "keep" ? (
        <div className="confirm keep-confirm open" role="alert">
          <strong>Keep deletes unmarked torrent leftovers.</strong>
          <span className="meta">Marked videos move first; qBittorrent cleanup runs only after move verification.</span>
          <CommandButton disabled={busy} command="E" tone="keep" onClick={() => onCommand("keep")}>
            <FolderCheck size={15} />
            <span>Confirm</span>
          </CommandButton>
          <Button className="btn" type="button" onClick={() => onCommand("cancel")}><X size={15} /> <span>Cancel</span></Button>
        </div>
      ) : null}
      {armedAction === "reject" ? (
        <div className="confirm open" role="alert">
          <strong>Delete removes torrent files</strong>
          <span className="meta">Press D again or click Confirm to call qBittorrent with deleteFiles=true</span>
          <CommandButton disabled={busy} command="D" tone="reject" onClick={() => onCommand("reject")}>
            <Trash2 size={15} />
            <span>Confirm</span>
          </CommandButton>
          <Button className="btn" type="button" onClick={() => onCommand("cancel")}><X size={15} /> <span>Cancel</span></Button>
        </div>
      ) : null}
      <div className="section-head">
        <span>Candidates</span>
      </div>
      <div className="candidate-list">
        {candidates.map((candidate, index) => {
          const marked = markedIndexes.includes(candidate.fileIndex);
          const selected = activeCandidate?.fileIndex === candidate.fileIndex;
          return (
            <div
              className={["candidate-row", selected ? "selected" : "", marked ? "marked" : ""].filter(Boolean).join(" ")}
              key={candidate.fileIndex}
              role="button"
              tabIndex={0}
              onClick={() => onSelectCandidate(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectCandidate(index);
                }
              }}
            >
              <button
                className="mark-cell"
                aria-label={marked ? "Unmark candidate" : "Mark candidate"}
                aria-pressed={marked}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleMark(candidate.fileIndex);
                }}
              >
                {marked ? <CircleCheck size={16} /> : <Circle size={16} />}
              </button>
              <span className="candidate-main">
                <span className="candidate-name">{candidate.name}</span>
                <span className="candidate-meta">
                  <span>{formatBytes(candidate.sizeBytes)}</span>
                  <span>{selected ? "previewing" : marked ? "marked" : "unmarked"}</span>
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ToastViewport({
  toast,
  onDismiss,
}: {
  toast: ReviewToast | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(onDismiss, 4_000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast]);

  if (!toast) {
    return null;
  }

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      <div className={`toast ${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
        <span>{toast.message}</span>
        <Button className="toast-close" type="button" aria-label="Dismiss notification" onClick={onDismiss}>
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}

export function SettingsPanel({
  settings,
  onClose,
  onSaved,
}: {
  settings: LocalSettings;
  onClose: () => void;
  onSaved: (settings: LocalSettings) => void;
}) {
  const [values, setValues] = useState<SettingsFormValues>(() => settingsToFormValues(settings));
  const [pickerBusy, setPickerBusy] = useState<"windowsDownloadRoot" | "wslDownloadRoot" | "sessionFolder" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function updateField(field: keyof SettingsFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function browseFolder(field: "windowsDownloadRoot" | "wslDownloadRoot" | "sessionFolder", title: string) {
    setFormError(null);
    setPickerBusy(field);
    try {
      const initialPath = field === "wslDownloadRoot"
        ? (wslMountPathToWindowsPath(values.wslDownloadRoot) ?? values.wslDownloadRoot)
        : values[field];
      const result = await pickFolder({ title, initialPath });
      if (!result.cancelled && result.path) {
        const selectedPath = result.path;
        setValues((current) => {
          const nextValue = field === "wslDownloadRoot"
            ? (windowsPathToWslMountPath(selectedPath) ?? selectedPath)
            : selectedPath;
          const next = { ...current, [field]: nextValue };
          const mapped = field === "windowsDownloadRoot" ? windowsPathToWslMountPath(selectedPath) : null;
          return mapped ? { ...next, wslDownloadRoot: mapped } : next;
        });
      }
    } catch (error) {
      setFormError(messageFromUnknown(error));
    } finally {
      setPickerBusy(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const limit = Number(values.sessionFolderLimit);
    const form = new FormData(event.currentTarget);
    const update: SettingsUpdate = {
      qbtBaseUrl: values.qbtBaseUrl,
      qbtUsername: values.qbtUsername,
      qbtPassword: String(form.get("qbtPassword") ?? ""),
      windowsDownloadRoot: values.windowsDownloadRoot,
      wslDownloadRoot: values.wslDownloadRoot,
      sessionFolder: values.sessionFolder,
      sessionFolderLimit: Number.isFinite(limit) && limit >= 1 ? limit : settings.sessionFolderLimit,
    };
    if (!update.qbtPassword) {
      delete update.qbtPassword;
    }
    try {
      onSaved(await updateSettings(update));
    } catch (error) {
      setFormError(messageFromUnknown(error));
    }
  }

  return (
    <section className="settings-sheet" role="dialog" aria-modal="true" aria-label="Settings">
      <form className="settings-panel" onSubmit={submit}>
        <div className="section-head">
          <span>Settings</span>
          <Button className="btn" type="button" onClick={onClose}><X size={15} /> <span>Close</span></Button>
        </div>
        <label>qBittorrent URL<input name="qbtBaseUrl" value={values.qbtBaseUrl} onChange={(event) => updateField("qbtBaseUrl", event.target.value)} /></label>
        <label>Username<input name="qbtUsername" value={values.qbtUsername} onChange={(event) => updateField("qbtUsername", event.target.value)} /></label>
        <label>Password<input name="qbtPassword" type="password" placeholder={settings.passwordConfigured ? "Configured" : ""} /></label>
        <label>
          Windows downloads root
          <div className="path-input-row">
            <input name="windowsDownloadRoot" value={values.windowsDownloadRoot} onChange={(event) => updateField("windowsDownloadRoot", event.target.value)} />
            <Button
              aria-label="Browse Windows downloads root"
              className="btn"
              type="button"
              disabled={pickerBusy !== null}
              onClick={() => void browseFolder("windowsDownloadRoot", "Choose qBittorrent downloads folder")}
            >
              <FolderOpen size={15} /> <span>{pickerBusy === "windowsDownloadRoot" ? "Choosing" : "Browse"}</span>
            </Button>
          </div>
        </label>
        <label>
          WSL downloads root
          <div className="path-input-row">
            <input name="wslDownloadRoot" value={values.wslDownloadRoot} onChange={(event) => updateField("wslDownloadRoot", event.target.value)} />
            <Button
              aria-label="Browse WSL downloads root"
              className="btn"
              type="button"
              disabled={pickerBusy !== null}
              onClick={() => void browseFolder("wslDownloadRoot", "Choose WSL downloads folder")}
            >
              <FolderOpen size={15} /> <span>{pickerBusy === "wslDownloadRoot" ? "Choosing" : "Browse"}</span>
            </Button>
          </div>
        </label>
        <label>
          Session folder
          <div className="path-input-row">
            <input name="sessionFolder" value={values.sessionFolder} onChange={(event) => updateField("sessionFolder", event.target.value)} />
            <Button
              aria-label="Browse session folder"
              className="btn"
              type="button"
              disabled={pickerBusy !== null}
              onClick={() => void browseFolder("sessionFolder", "Choose review output folder")}
            >
              <FolderOpen size={15} /> <span>{pickerBusy === "sessionFolder" ? "Choosing" : "Browse"}</span>
            </Button>
          </div>
        </label>
        <label>Folder limit<input name="sessionFolderLimit" type="number" min={1} value={values.sessionFolderLimit} onChange={(event) => updateField("sessionFolderLimit", event.target.value)} /></label>
        {formError ? <p className="settings-error" role="alert">{formError}</p> : null}
        <Button className="btn keep" type="submit" disabled={pickerBusy !== null}><Check size={15} /> <span>Save settings</span></Button>
      </form>
    </section>
  );
}

type SettingsFormValues = {
  qbtBaseUrl: string;
  qbtUsername: string;
  windowsDownloadRoot: string;
  wslDownloadRoot: string;
  sessionFolder: string;
  sessionFolderLimit: string;
};

function settingsToFormValues(settings: LocalSettings): SettingsFormValues {
  return {
    qbtBaseUrl: settings.qbtBaseUrl,
    qbtUsername: settings.qbtUsername,
    windowsDownloadRoot: settings.windowsDownloadRoot,
    wslDownloadRoot: settings.wslDownloadRoot,
    sessionFolder: settings.sessionFolder,
    sessionFolderLimit: String(settings.sessionFolderLimit),
  };
}

function windowsPathToWslMountPath(path: string): string | null {
  const match = /^([a-zA-Z]):[\\/]*(.*)$/.exec(path.trim());
  if (!match) {
    return null;
  }
  const drive = match[1].toLowerCase();
  const rest = match[2].replace(/[\\/]+/g, "/").replace(/^\/+/, "");
  return rest ? `/mnt/${drive}/${rest}` : `/mnt/${drive}`;
}

function wslMountPathToWindowsPath(path: string): string | null {
  const match = /^\/mnt\/([a-zA-Z])(?:\/(.*))?$/.exec(path.trim());
  if (!match) {
    return null;
  }
  const drive = match[1].toUpperCase();
  const rest = (match[2] ?? "").replace(/\/+/g, "\\");
  return rest ? `${drive}:\\${rest}` : `${drive}:\\`;
}

function messageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function CommandButton({
  command,
  tone,
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  command: string;
  tone?: "primary" | "keep" | "reject";
}) {
  return (
    <Button {...props} className={["btn", "command-button", tone, className].filter(Boolean).join(" ")} type="button">
      <span className="command-key">{command}</span>
      <span className="command-body">{children}</span>
    </Button>
  );
}
