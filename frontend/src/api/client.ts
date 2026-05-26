import type {
  CleanupRetryPayload,
  FolderPickPayload,
  FolderPickResponse,
  KeepPayload,
  KeepResponse,
  QueueResponse,
  RejectPayload,
  ReviewTorrent,
  SettingsUpdate,
} from "../domain/types";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = init ? await fetch(path, init) : await fetch(path);
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {
      // Keep original HTTP detail.
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

function jsonInit(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function getQueue(): Promise<QueueResponse> {
  return apiRequest<QueueResponse>("/api/queue");
}

export function getTorrentDetail(hash: string): Promise<ReviewTorrent> {
  return apiRequest<ReviewTorrent>(`/api/torrents/${encodeURIComponent(hash)}`);
}

export function keepTorrent(hash: string, payload: KeepPayload): Promise<KeepResponse> {
  return apiRequest<KeepResponse>(`/api/torrents/${encodeURIComponent(hash)}/keep`, jsonInit(payload));
}

export function rejectTorrent(hash: string, payload: RejectPayload): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/api/torrents/${encodeURIComponent(hash)}/reject`, jsonInit(payload));
}

export function cleanupRetryTorrent(hash: string, payload: CleanupRetryPayload): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(
    `/api/torrents/${encodeURIComponent(hash)}/cleanup-retry`,
    jsonInit(payload),
  );
}

export function openTorrentFile(hash: string, fileIndex: number): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(
    `/api/torrents/${encodeURIComponent(hash)}/open`,
    jsonInit({ fileIndex }),
  );
}

export function updateSettings(payload: SettingsUpdate): Promise<QueueResponse["settings"]> {
  return apiRequest<QueueResponse["settings"]>("/api/settings", jsonInit(payload));
}

export function pickFolder(payload: FolderPickPayload): Promise<FolderPickResponse> {
  return apiRequest<FolderPickResponse>("/api/system/pick-folder", jsonInit(payload));
}
