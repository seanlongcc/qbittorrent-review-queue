export type TorrentStatus = "completed" | "attention";

export type AttentionReason =
  | "cleanup_failed"
  | "path_missing"
  | "auth_failed"
  | "no_video_candidates";

export type VideoCandidate = {
  fileIndex: number;
  name: string;
  extension: string;
  sizeBytes: number;
  path: string;
  playable: boolean;
};

export type JunkFile = {
  fileIndex: number;
  name: string;
  sizeBytes: number;
};

export type ReviewTorrent = {
  hash: string;
  name: string;
  status: TorrentStatus;
  progress: number;
  totalSizeBytes: number;
  addedOnSeconds?: number;
  savePath: string;
  contentPath?: string;
  candidates?: VideoCandidate[];
  junkFiles?: JunkFile[];
  attentionReason?: AttentionReason;
  attentionDetail?: string;
  movedFiles?: string[];
};

export type LocalSettings = {
  qbtBaseUrl: string;
  qbtUsername: string;
  passwordConfigured: boolean;
  windowsDownloadRoot: string;
  wslDownloadRoot: string;
  sessionFolder: string;
  sessionFolderLimit: number;
  folderCount: number;
  connected: boolean;
};

export type QueueResponse = {
  torrents: ReviewTorrent[];
  attentionTorrents: ReviewTorrent[];
  settings: LocalSettings;
};

export type KeepPayload = {
  fileIndexes: number[];
  confirmed: boolean;
};

export type RejectPayload = {
  confirmed: boolean;
};

export type CleanupRetryPayload = {
  confirmed: boolean;
};

export type SettingsUpdate = Partial<
  Pick<
    LocalSettings,
    | "qbtBaseUrl"
    | "qbtUsername"
    | "windowsDownloadRoot"
    | "wslDownloadRoot"
    | "sessionFolder"
    | "sessionFolderLimit"
  >
> & { qbtPassword?: string };

export type FolderPickPayload = {
  title?: string;
  initialPath?: string;
};

export type FolderPickResponse = {
  path: string | null;
  cancelled: boolean;
};
