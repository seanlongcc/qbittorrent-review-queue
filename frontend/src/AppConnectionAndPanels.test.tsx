import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App connection and review panels", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows qBittorrent connection attempt in the title bar without a second status bar", async () => {
    let resolveQueue: (response: Response) => void = () => undefined;
    const queuePromise = new Promise<Response>((resolve) => {
      resolveQueue = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return queuePromise;
        }
        if (url === "/api/history") {
          return Response.json({ items: [] });
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);

    expect(await screen.findByText("Connecting")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:8080")).toBeInTheDocument();
    expect(screen.queryByLabelText("qBittorrent connection status")).not.toBeInTheDocument();

    resolveQueue(Response.json(queueResponse()));
  });

  it("switches between candidates and history in the review panel tabs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return Response.json(queueResponse());
        }
        if (url === "/api/history") {
          return Response.json({
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
          });
        }
        if (url === "/api/torrents/abc") {
          return Response.json(torrentDetail());
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);

    const candidatesTab = await screen.findByRole("tab", { name: /Candidates 1/ });
    const historyTab = screen.getByRole("tab", { name: /History 1/ });
    expect(candidatesTab).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByRole("tabpanel", { name: /Candidates/ })).getByText("main.mp4")).toBeInTheDocument();

    fireEvent.click(historyTab);

    await waitFor(() => expect(historyTab).toHaveAttribute("aria-selected", "true"));
    expect(within(screen.getByRole("tabpanel", { name: /History/ })).getByText("Kept 1 video")).toBeInTheDocument();
    expect(screen.queryByLabelText("Video candidates")).not.toBeInTheDocument();
  });
});

function queueResponse() {
  return {
    torrents: [
      {
        hash: "abc",
        name: "Done Torrent",
        addedOnSeconds: 100,
        status: "completed",
        progress: 1,
        totalSizeBytes: 1200,
        savePath: "C:\\Downloads\\Done Torrent",
        contentPath: "C:\\Downloads\\Done Torrent",
      },
    ],
    attentionTorrents: [],
    settings: {
      qbtBaseUrl: "http://localhost:8080",
      qbtUsername: "admin",
      passwordConfigured: true,
      windowsDownloadRoot: "C:\\Downloads",
      wslDownloadRoot: "/mnt/c/Downloads",
      sessionFolder: "/mnt/c/Review",
      sessionFolderLimit: 40,
      folderCount: 16,
      connected: true,
    },
  };
}

function torrentDetail() {
  return {
    hash: "abc",
    name: "Done Torrent",
    status: "completed",
    progress: 1,
    totalSizeBytes: 1200,
    savePath: "C:\\Downloads\\Done Torrent",
    candidates: [
      {
        fileIndex: 0,
        name: "main.mp4",
        extension: "mp4",
        sizeBytes: 1000,
        path: "/mnt/c/Downloads/Done Torrent/main.mp4",
        playable: true,
      },
    ],
    junkFiles: [{ fileIndex: 1, name: "readme.txt", sizeBytes: 200 }],
  };
}
