import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupRetryTorrent, getHistory, getQueue, getTorrentDetail, keepTorrent, pickFolder, rejectTorrent } from "./client";

describe("api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches queue and torrent detail from FastAPI endpoints", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/queue") {
        return Response.json({ torrents: [], attentionTorrents: [], settings: {} });
      }
      if (url === "/api/torrents/abc") {
        return Response.json({ hash: "abc", candidates: [], junkFiles: [] });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await getQueue();
    await getTorrentDetail("abc");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/queue");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/torrents/abc");
  });

  it("sends confirmed destructive payloads explicitly", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await keepTorrent("abc", { fileIndexes: [7], confirmed: true });
    await rejectTorrent("abc", { confirmed: true });
    await cleanupRetryTorrent("abc", { confirmed: true });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/torrents/abc/keep",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ fileIndexes: [7], confirmed: true }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/torrents/abc/reject",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ confirmed: true }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/torrents/abc/cleanup-retry",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ confirmed: true }),
      }),
    );
  });

  it("requests a Windows folder picker with an initial path", async () => {
    const fetchMock = vi.fn(async () => Response.json({ path: "C:\\Selected", cancelled: false }));
    vi.stubGlobal("fetch", fetchMock);

    await pickFolder({ title: "Choose output", initialPath: "C:\\Users\\seanl\\Desktop" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/system/pick-folder",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Choose output", initialPath: "C:\\Users\\seanl\\Desktop" }),
      }),
    );
  });

  it("fetches execution history from FastAPI", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        items: [
          {
            id: "event-1",
            timestamp: "2026-05-26T20:00:00Z",
            action: "keep",
            status: "success",
            torrentHash: "abc",
            torrentName: "Done Torrent",
            summary: "Kept 1 video",
            files: [{ destinationPath: "/mnt/c/Review/main.mp4", name: "main.mp4" }],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const history = await getHistory();

    expect(fetchMock).toHaveBeenCalledWith("/api/history");
    expect(history.items[0].summary).toBe("Kept 1 video");
  });
});
