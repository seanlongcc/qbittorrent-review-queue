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
  savePath: string;
  candidates: VideoCandidate[];
  junkFiles: JunkFile[];
  attentionReason?: AttentionReason;
  attentionDetail?: string;
};

export type LocalSettings = {
  qbtBaseUrl: string;
  qbtUsername: string;
  passwordConfigured: boolean;
  sessionFolder: string;
  sessionFolderLimit: number;
  folderCount: number;
  connected: boolean;
};
