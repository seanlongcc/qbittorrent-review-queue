import { useEffect, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import {
  Check,
  Circle,
  CircleCheck,
  ExternalLink,
  Film,
  FolderOpen,
  HardDrive,
  RefreshCw,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { pickFolder, updateSettings } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LocalSettings, ReviewTorrent, SettingsUpdate, VideoCandidate } from "@/domain/types";
import { formatBytes } from "./format";
import type { ReviewCommand } from "./keyboard";

export function TitleBar({ settings }: { settings: LocalSettings }) {
  return (
    <header className="qbt-titlebar">
      <div className="qbt-brand">
        <span className="qbt-drop" aria-hidden="true" />
        <span>qBittorrent Review Queue</span>
      </div>
      <span className="qbt-meta">{settings.qbtBaseUrl}</span>
    </header>
  );
}

export function Toolbar({
  busy,
  armedAction,
  canOpen,
  canReview,
  onCommand,
}: {
  busy: boolean;
  armedAction: "keep" | "reject" | null;
  canOpen: boolean;
  canReview: boolean;
  onCommand: (command: ReviewCommand) => void;
}) {
  return (
    <nav className="qbt-toolbar" aria-label="toolbar">
      <CommandButton tone="primary" disabled={busy} command="Q" onClick={() => onCommand("refreshQueue")}>
        <RefreshCw size={15} /> Refresh
      </CommandButton>
      <CommandButton disabled={busy || !canOpen} command="E" onClick={() => onCommand("openExternal")}>
        <ExternalLink size={15} /> Open external
      </CommandButton>
      <CommandButton tone="keep" disabled={busy || !canReview} command="F" onClick={() => onCommand("keep")}>
        <Check size={15} /> {armedAction === "keep" ? "Confirm Keep" : "Keep marked"}
      </CommandButton>
      <CommandButton tone="reject" disabled={busy || !canReview} command="R" onClick={() => onCommand("reject")}>
        <Trash2 size={15} /> {armedAction === "reject" ? "Confirm Reject" : "Reject torrent"}
      </CommandButton>
      <CommandButton disabled={busy} command="T" onClick={() => onCommand("toggleSettings")}>
        <Settings size={15} /> Settings
      </CommandButton>
    </nav>
  );
}

export function QueueSidebar({
  torrents,
  attentionTorrents,
  activeHash,
  settings,
  busy,
  onSelect,
  onCleanupRetry,
}: {
  torrents: ReviewTorrent[];
  attentionTorrents: ReviewTorrent[];
  activeHash: string | null;
  settings: LocalSettings;
  busy: boolean;
  onSelect: (hash: string) => void;
  onCleanupRetry: (hash: string) => void;
}) {
  const [cleanupConfirmHash, setCleanupConfirmHash] = useState<string | null>(null);
  const activeTorrentRef = useRef<HTMLButtonElement | null>(null);
  const videoReadyCount = torrents.filter((torrent) => (torrent.candidates?.length ?? 0) > 0).length;

  useEffect(() => {
    if (!activeHash) {
      return;
    }
    activeTorrentRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [activeHash]);

  return (
    <aside className="qbt-sidebar" aria-label="Review queue">
      <div className="rail-status" aria-label="queue and session status">
        <span><strong>{torrents.length}</strong><em>completed</em></span>
        <span><strong>{settings.folderCount} / {settings.sessionFolderLimit}</strong><em>session slots</em></span>
        <span><strong>{videoReadyCount || "..."}</strong><em>with video</em></span>
        <span>
          <strong className={settings.connected ? "status-ok" : "status-off"}>
            {settings.connected ? "API ok" : "API off"}
          </strong>
          <em>local WebUI</em>
        </span>
      </div>
      <div className="side-head"><span>Filters</span><span>{torrents.length}</span></div>
      <button className="filter active" type="button"><span>Completed</span><span>{torrents.length}</span></button>
      <button className="filter" type="button"><span>Has video</span><span>{videoReadyCount || "-"}</span></button>
      <button className="filter" type="button"><span>Needs attention</span><span>{attentionTorrents.length}</span></button>
      <div className="side-head"><span>Torrents</span><span>Size</span></div>
      <div className="torrent-list">
        {torrents.map((torrent) => {
          const active = torrent.hash === activeHash;
          return (
            <button
              aria-current={active ? "true" : undefined}
              className={active ? "torrent active" : "torrent"}
              key={torrent.hash}
              ref={active ? activeTorrentRef : undefined}
              type="button"
              onClick={() => onSelect(torrent.hash)}
            >
              <span className="name">{torrent.name}</span>
              <span className="meta">{formatBytes(torrent.totalSizeBytes)}</span>
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
}: {
  torrent: ReviewTorrent | null;
  candidate: VideoCandidate | null;
  loading: boolean;
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
      </div>
      <div className="preview">
        {candidate?.playable ? (
          <video
            aria-label="Autoplay video preview"
            autoPlay
            className="preview-video"
            controls
            muted
            playsInline
            preload="auto"
            src={mediaSrc}
          />
        ) : (
          <div className="video-placeholder">
            {candidate ? <><Film size={28} /> Preview unavailable, use Open external</> : <><HardDrive size={28} /> Select a completed torrent</>}
          </div>
        )}
      </div>
    </section>
  );
}

export function CandidateTabs({ onCommand }: { onCommand: (command: ReviewCommand) => void }) {
  return (
    <div className="candidate-tabs">
      <Button className="tab active" type="button" onClick={() => onCommand("toggleMark")}><Keycap>D</Keycap>Candidates</Button>
      <Button className="tab" type="button" onClick={() => onCommand("previousTorrent")}><Keycap>A</Keycap>Prev torrent</Button>
      <Button className="tab" type="button" onClick={() => onCommand("nextTorrent")}><Keycap>S</Keycap>Next torrent</Button>
      <Button className="tab" type="button" onClick={() => onCommand("previousCandidate")}><Keycap>Z</Keycap>Prev video</Button>
      <Button className="tab" type="button" onClick={() => onCommand("nextCandidate")}><Keycap>X</Keycap>Next video</Button>
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
  return (
    <section aria-label="Video candidates" className="candidate-section">
      <div className="section-head">
        <span>Candidates, largest first</span>
        <span>{settings.folderCount} / {settings.sessionFolderLimit} session slots</span>
      </div>
      <div className="candidate-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mark</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Index</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Path</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate, index) => {
              const marked = markedIndexes.includes(candidate.fileIndex);
              const selected = activeCandidate?.fileIndex === candidate.fileIndex;
              return (
                <TableRow
                  className={[selected ? "selected" : "", marked ? "marked" : ""].filter(Boolean).join(" ")}
                  key={candidate.fileIndex}
                  onClick={() => onSelectCandidate(index)}
                >
                  <TableCell>
                    <button
                      className="mark-cell"
                      type="button"
                      aria-label={marked ? "Unmark candidate" : "Mark candidate"}
                      aria-pressed={marked}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleMark(candidate.fileIndex);
                      }}
                    >
                      {marked ? <CircleCheck size={16} /> : <Circle size={16} />}
                    </button>
                  </TableCell>
                  <TableCell className="name">{candidate.name}</TableCell>
                  <TableCell>{formatBytes(candidate.sizeBytes)}</TableCell>
                  <TableCell>{candidate.fileIndex}</TableCell>
                  <TableCell>{selected ? "Previewing" : marked ? "Marked" : "Video"}</TableCell>
                  <TableCell className="path">{candidate.path}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {activeMissing ? (
        <div className="vanished-alert" role="status">
          Selected torrent no longer in qBittorrent. Keep and Reject are disabled until you choose another torrent or refresh.
        </div>
      ) : null}
      <div className="candidate-actions">
        <CommandButton disabled={busy || activeMissing} command="D" tone="primary" onClick={() => onCommand("toggleMark")}>Mark selected</CommandButton>
        <CommandButton disabled={busy || keepBlocked} command="F" tone="keep" onClick={() => onCommand("keep")}>
          {armedAction === "keep" ? "Confirm Keep" : "Keep"}
        </CommandButton>
        <CommandButton disabled={busy || !torrent} command="R" tone="reject" onClick={() => onCommand("reject")}>
          {armedAction === "reject" ? "Confirm Reject" : "Reject"}
        </CommandButton>
        <span className="action-note">{notice}</span>
        {armedAction === "keep" ? (
          <div className="confirm keep-confirm open" role="alert">
            <strong>Keep deletes unmarked torrent leftovers.</strong>
            <span className="meta">Marked videos move first; qBittorrent cleanup runs only after move verification.</span>
            <CommandButton disabled={busy} command="F" tone="keep" onClick={() => onCommand("keep")}>Confirm Keep</CommandButton>
            <Button className="btn" type="button" onClick={() => onCommand("cancel")}><X size={15} /> Cancel</Button>
          </div>
        ) : null}
        {armedAction === "reject" ? (
          <div className="confirm open" role="alert">
            <strong>Reject deletes torrent files.</strong>
            <span className="meta">Press R again or click Confirm Reject to call qBittorrent with deleteFiles=true.</span>
            <CommandButton disabled={busy} command="R" tone="reject" onClick={() => onCommand("reject")}>Confirm Reject</CommandButton>
            <Button className="btn" type="button" onClick={() => onCommand("cancel")}><X size={15} /> Cancel</Button>
          </div>
        ) : null}
      </div>
      <details className="junk-block">
        <summary>Junk files <span>{torrent?.junkFiles?.length ?? 0}</span></summary>
        {(torrent?.junkFiles ?? []).map((file) => (
          <div className="junk-row" key={file.fileIndex}>
            <span>{file.name}</span>
            <span>{formatBytes(file.sizeBytes)}</span>
          </div>
        ))}
      </details>
    </section>
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
  const [pickerBusy, setPickerBusy] = useState<"windowsDownloadRoot" | "sessionFolder" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function updateField(field: keyof SettingsFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function browseFolder(field: "windowsDownloadRoot" | "sessionFolder", title: string) {
    setFormError(null);
    setPickerBusy(field);
    try {
      const result = await pickFolder({ title, initialPath: values[field] });
      if (!result.cancelled && result.path) {
        const selectedPath = result.path;
        setValues((current) => {
          const next = { ...current, [field]: selectedPath };
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
    <section className="settings-sheet" aria-label="Settings">
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
        <label>WSL downloads root<input name="wslDownloadRoot" value={values.wslDownloadRoot} onChange={(event) => updateField("wslDownloadRoot", event.target.value)} /></label>
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
