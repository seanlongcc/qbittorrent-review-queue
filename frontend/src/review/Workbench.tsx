import { useEffect, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import {
  Check,
  Circle,
  CircleCheck,
  ExternalLink,
  Film,
  FolderOpen,
  RefreshCw,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { pickFolder, updateSettings } from "@/api/client";
import { Button } from "@/components/ui/button";
import type { LocalSettings, ReviewTorrent, SettingsUpdate, VideoCandidate } from "@/domain/types";
import { formatBytes } from "./format";
import type { ReviewCommand } from "./keyboard";

export type QueueSortField = "added" | "name" | "size";
export type SortDirection = "asc" | "desc";

export type QueueSort = {
  field: QueueSortField;
  direction: SortDirection;
};

const suppressedReviewNotices = new Set([
  "Queue ready.",
  "Loading qBittorrent queue.",
  "Refreshing qBittorrent queue.",
  "No completed torrents are ready.",
]);

export function TitleBar({
  settings,
  busy,
  onSettings,
}: {
  settings: LocalSettings;
  busy: boolean;
  onSettings: () => void;
}) {
  return (
    <header className="qbt-titlebar">
      <div className="qbt-brand">
        <span>qBittorrent Review Queue</span>
      </div>
      <span className="qbt-meta">{settings.qbtBaseUrl}</span>
      <Button className="btn" type="button" disabled={busy} onClick={onSettings}>
        <Settings size={15} /> Settings
      </Button>
    </header>
  );
}

export function QueueSidebar({
  torrents,
  attentionTorrents,
  activeHash,
  settings,
  busy,
  loading,
  sort,
  onSelect,
  onCleanupRetry,
  onRefresh,
  onSortChange,
}: {
  torrents: ReviewTorrent[];
  attentionTorrents: ReviewTorrent[];
  activeHash: string | null;
  settings: LocalSettings;
  busy: boolean;
  loading: boolean;
  sort: QueueSort;
  onSelect: (hash: string) => void;
  onCleanupRetry: (hash: string) => void;
  onRefresh: () => void;
  onSortChange: (sort: QueueSort) => void;
}) {
  const [cleanupConfirmHash, setCleanupConfirmHash] = useState<string | null>(null);
  const activeTorrentRef = useRef<HTMLButtonElement | null>(null);
  const videoReadyCount = torrents.filter((torrent) => (torrent.candidates?.length ?? 0) > 0).length;
  const apiStatus = settings.connected ? (loading ? "Api connected, refreshing queue." : "Api connected, refreshed recently.") : "Api disconnected. Check settings.";

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
            <span>{torrents.length} completed torrents</span>
          </div>
          <Button className="btn primary" type="button" disabled={busy || loading} onClick={onRefresh}>
            <RefreshCw size={15} /> Refresh
          </Button>
        </div>
        <div className={settings.connected ? "sync-line" : "sync-line offline"} role="status">
          <span aria-hidden="true" />
          <span>{apiStatus}</span>
        </div>
        <div className="filter-grid" aria-label="Queue filters">
          <button className="filter-card active" type="button">
            <span>All</span>
            <strong>{torrents.length}</strong>
          </button>
          <button className="filter-card" type="button">
            <span>With video</span>
            <strong>{videoReadyCount || "-"}</strong>
          </button>
          <button className="filter-card" type="button">
            <span>Attention</span>
            <strong>{attentionTorrents.length}</strong>
          </button>
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
          <div className="sort-direction" aria-label="Sort direction">
            <button
              className={sort.direction === "desc" ? "active" : ""}
              type="button"
              onClick={() => onSortChange({ ...sort, direction: "desc" })}
            >
              Desc
            </button>
            <button
              className={sort.direction === "asc" ? "active" : ""}
              type="button"
              onClick={() => onSortChange({ ...sort, direction: "asc" })}
            >
              Asc
            </button>
          </div>
        </div>
        <span>{sortDescription(sort)}</span>
      </div>
      <div className="side-head"><span>Torrents</span><span>Size</span></div>
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
              <span className="meta">
                {candidateCount ? `${candidateCount} video${candidateCount === 1 ? "" : "s"}` : "details pending"}
              </span>
            </button>
          );
        })}
      </div>
      <details className="attention-block" open={attentionTorrents.length > 0}>
        <summary>Needs attention <span>{attentionTorrents.length}</span></summary>
        {attentionTorrents.map((torrent) => (
          <div className="attention-row" key={torrent.hash}>
            <div>
              <strong>{torrent.name}</strong>
              <span>{torrent.attentionDetail ?? torrent.attentionReason}</span>
              {torrent.movedFiles?.length ? <em>{torrent.movedFiles.length} moved file preserved.</em> : null}
            </div>
            {torrent.attentionReason === "cleanup_failed" ? (
              <div className="attention-actions">
                <Button
                  className="btn reject"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (cleanupConfirmHash === torrent.hash) {
                      onCleanupRetry(torrent.hash);
                      setCleanupConfirmHash(null);
                      return;
                    }
                    setCleanupConfirmHash(torrent.hash);
                  }}
                >
                  <Trash2 size={15} /> {cleanupConfirmHash === torrent.hash ? "Confirm retry" : "Retry cleanup"}
                </Button>
                {cleanupConfirmHash === torrent.hash ? (
                  <Button className="btn" type="button" disabled={busy} onClick={() => setCleanupConfirmHash(null)}>
                    <X size={15} /> Cancel
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </details>
    </aside>
  );
}

export function MediaStage({
  torrent,
  candidate,
  loading,
  busy = false,
  onOpenExternal,
}: {
  torrent: ReviewTorrent | null;
  candidate: VideoCandidate | null;
  loading: boolean;
  busy?: boolean;
  onOpenExternal?: () => void;
}) {
  const mediaSrc = torrent && candidate ? `/media/${torrent.hash}/${candidate.fileIndex}` : "";
  return (
    <section aria-label="Media preview" className="preview-section">
      <div className="preview-head">
        <div>
          <strong>{candidate?.name ?? torrent?.name ?? "No torrent selected"}</strong>
          <p className="path">{candidate?.path ?? torrent?.savePath ?? "Queue empty or disconnected."}</p>
        </div>
        <span className="meta">
          {loading ? "loading detail" : candidate ? `index ${candidate.fileIndex}, ${formatBytes(candidate.sizeBytes)}` : "no selected video"}
        </span>
        {onOpenExternal ? (
          <CommandButton disabled={busy || !candidate} command="T" onClick={onOpenExternal}>
            <ExternalLink size={15} /> Open external
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
            playsInline
            preload="auto"
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

export function CandidateTabs({ onCommand }: { onCommand: (command: ReviewCommand) => void }) {
  return (
    <div className="candidate-tabs">
      <Button className="tab" type="button" onClick={() => onCommand("previousTorrent")}><Keycap>Q</Keycap>Prev torrent</Button>
      <Button className="tab" type="button" onClick={() => onCommand("nextTorrent")}><Keycap>A</Keycap>Next torrent</Button>
      <Button className="tab" type="button" onClick={() => onCommand("previousCandidate")}><Keycap>W</Keycap>Prev video</Button>
      <Button className="tab" type="button" onClick={() => onCommand("nextCandidate")}><Keycap>S</Keycap>Next video</Button>
      <Button className="tab active" type="button" onClick={() => onCommand("toggleMark")}><Keycap>F</Keycap>Mark selected</Button>
    </div>
  );
}

export function CandidateTable({
  torrent,
  activeCandidate,
  markedIndexes,
  settings,
  armedAction,
  busy,
  activeMissing,
  keepBlocked,
  notice,
  onSelectCandidate,
  onToggleMark,
  onCommand,
}: {
  torrent: ReviewTorrent | null;
  activeCandidate: VideoCandidate | null;
  markedIndexes: number[];
  settings: LocalSettings;
  armedAction: "keep" | "reject" | null;
  busy: boolean;
  activeMissing: boolean;
  keepBlocked: boolean;
  notice: string;
  onSelectCandidate: (index: number) => void;
  onToggleMark: (fileIndex: number) => void;
  onCommand: (command: ReviewCommand) => void;
}) {
  const candidates = torrent?.candidates ?? [];
  const markedCount = markedIndexes.length;
  const folderCountAfterKeep = settings.folderCount + markedCount;
  const leftoverBytes = torrent ? leftoverSizeBytes(torrent, markedIndexes) : 0;
  const showNotice = Boolean(notice && !suppressedReviewNotices.has(notice));

  return (
    <section aria-label="Video candidates" className="candidate-section">
      <div className="review-dock" aria-label="Review decision">
        <div className="review-dock-main">
          <div className="review-title">
            <strong>Review</strong>
            <span>Marked files and delete risk</span>
          </div>
          <span className="review-pill">{markedCount} marked</span>
          <span className="review-pill"><strong>{folderCountAfterKeep} / {settings.sessionFolderLimit}</strong> slots after Keep</span>
          <span className="review-pill"><strong>{formatBytes(leftoverBytes)}</strong> leftovers delete</span>
          <CommandButton disabled={busy || keepBlocked} command="E" tone="keep" onClick={() => onCommand("keep")}>
            {armedAction === "keep" ? "Confirm Keep" : "Keep marked"}
          </CommandButton>
          <CommandButton disabled={busy || !torrent || activeMissing} command="D" tone="reject" onClick={() => onCommand("reject")}>
            {armedAction === "reject" ? "Confirm Reject" : "Reject torrent"}
          </CommandButton>
        </div>
        {showNotice ? <span className="decision-notice">{notice}</span> : null}
        {activeMissing ? (
          <div className="vanished-alert" role="status">
            Selected torrent no longer in qBittorrent. Keep and Reject are disabled until you choose another torrent or refresh.
          </div>
        ) : null}
        {armedAction === "keep" ? (
          <div className="confirm keep-confirm open" role="alert">
            <strong>Keep deletes unmarked torrent leftovers.</strong>
            <span className="meta">Marked videos move first; qBittorrent cleanup runs only after move verification.</span>
            <CommandButton disabled={busy} command="E" tone="keep" onClick={() => onCommand("keep")}>Confirm Keep</CommandButton>
            <Button className="btn" type="button" onClick={() => onCommand("cancel")}><X size={15} /> Cancel</Button>
          </div>
        ) : null}
        {armedAction === "reject" ? (
          <div className="confirm open" role="alert">
            <strong>Reject deletes torrent files.</strong>
            <span className="meta">Press D again or click Confirm Reject to call qBittorrent with deleteFiles=true.</span>
            <CommandButton disabled={busy} command="D" tone="reject" onClick={() => onCommand("reject")}>Confirm Reject</CommandButton>
            <Button className="btn" type="button" onClick={() => onCommand("cancel")}><X size={15} /> Cancel</Button>
          </div>
        ) : null}
      </div>
      <div className="section-head">
        <span>Candidates</span>
        <span>largest first</span>
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
              <span className="candidate-main">
                <span className="candidate-name">{candidate.name}</span>
                <span className="candidate-meta">
                  <span>{formatBytes(candidate.sizeBytes)}</span>
                  <span>index {candidate.fileIndex}</span>
                  <span>{selected ? "previewing" : marked ? "marked" : "unmarked"}</span>
                </span>
              </span>
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
            </div>
          );
        })}
      </div>
      {torrent?.junkFiles?.length ? (
        <details className="non-video-block">
          <summary>
            Non-video leftovers
            <span>{torrent.junkFiles.length} files, {formatBytes(totalJunkSizeBytes(torrent))}</span>
          </summary>
        </details>
      ) : null}
    </section>
  );
}

function leftoverSizeBytes(torrent: ReviewTorrent, markedIndexes: number[]): number {
  const marked = new Set(markedIndexes);
  const unmarkedCandidates = torrent.candidates?.filter((candidate) => !marked.has(candidate.fileIndex)) ?? [];
  return unmarkedCandidates.reduce((total, candidate) => total + candidate.sizeBytes, 0) + totalJunkSizeBytes(torrent);
}

function totalJunkSizeBytes(torrent: ReviewTorrent): number {
  return torrent.junkFiles?.reduce((total, file) => total + file.sizeBytes, 0) ?? 0;
}

function sortDescription(sort: QueueSort): string {
  if (sort.field === "name") {
    return sort.direction === "asc" ? "A to Z" : "Z to A";
  }
  if (sort.field === "size") {
    return sort.direction === "asc" ? "Smallest first" : "Largest first";
  }
  return sort.direction === "asc" ? "Oldest API result first" : "Newest API result first";
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
          <Button className="btn" type="button" onClick={onClose}><X size={15} /> Close</Button>
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
              <FolderOpen size={15} /> {pickerBusy === "windowsDownloadRoot" ? "Choosing" : "Browse"}
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
              <FolderOpen size={15} /> {pickerBusy === "wslDownloadRoot" ? "Choosing" : "Browse"}
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
              <FolderOpen size={15} /> {pickerBusy === "sessionFolder" ? "Choosing" : "Browse"}
            </Button>
          </div>
        </label>
        <label>Folder limit<input name="sessionFolderLimit" type="number" min={1} value={values.sessionFolderLimit} onChange={(event) => updateField("sessionFolderLimit", event.target.value)} /></label>
        {formError ? <p className="settings-error" role="alert">{formError}</p> : null}
        <Button className="btn keep" type="submit" disabled={pickerBusy !== null}><Check size={15} /> Save settings</Button>
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
  children,
  ...props
}: ComponentProps<typeof Button> & {
  command: string;
  tone?: "primary" | "keep" | "reject";
}) {
  return (
    <Button className={["btn", tone].filter(Boolean).join(" ")} type="button" {...props}>
      <Keycap>{command}</Keycap>
      {children}
    </Button>
  );
}

function Keycap({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}
