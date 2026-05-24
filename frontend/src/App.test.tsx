import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("loads real queue data through the API and renders qBittorrent workbench controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return Response.json({
            torrents: [
              {
                hash: "abc",
                name: "Done Torrent",
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
          });
        }
        if (url === "/api/torrents/abc") {
          return Response.json({
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
          });
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);

    expect(await screen.findByText("Done Torrent")).toBeInTheDocument();
    expect(screen.getByLabelText("Review queue")).toBeInTheDocument();
    expect(screen.getByLabelText("Media preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Video candidates")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /E Keep/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /D Reject/ }).length).toBeGreaterThan(0);
    expect(screen.getByText(/\/ 40/)).toBeInTheDocument();
    expect(screen.getByText("slots after Keep")).toBeInTheDocument();
    expect(screen.queryByText(/Junk files/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Left-hand keys/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sample data/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("main.mp4").length).toBeGreaterThan(0);
    });
  });

  it("auto-polls the queue every 1 minute when visible", async () => {
    vi.useFakeTimers();
    let queueCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          queueCalls += 1;
          return Response.json(queueResponse("abc", "Done Torrent"));
        }
        if (url === "/api/torrents/abc") {
          return Response.json(torrentDetail("abc", "Done Torrent"));
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getAllByText("Done Torrent").length).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });

    expect(queueCalls).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(queueCalls).toBe(2);
  });

  it("refreshes the queue immediately after settings save", async () => {
    let queueCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/queue") {
          queueCalls += 1;
          return Response.json(queueResponse("abc", "Done Torrent"));
        }
        if (url === "/api/torrents/abc") {
          return Response.json(torrentDetail("abc", "Done Torrent"));
        }
        if (url === "/api/settings" && init?.method === "POST") {
          return Response.json(queueResponse("abc", "Done Torrent").settings);
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);
    expect((await screen.findAllByText("Done Torrent")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Settings$/ }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Save settings/ }));

    await waitFor(() => expect(queueCalls).toBe(2));
  });

  it("selects session folder through the local folder picker", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return Response.json(queueResponse("abc", "Done Torrent"));
        }
        if (url === "/api/torrents/abc") {
          return Response.json(torrentDetail("abc", "Done Torrent"));
        }
        if (url === "/api/system/pick-folder") {
          return Response.json({ path: "C:\\Users\\seanl\\Desktop\\picked", cancelled: false });
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);
    expect((await screen.findAllByText("Done Torrent")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Settings$/ }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Browse session folder" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Session folder")).toHaveValue("C:\\Users\\seanl\\Desktop\\picked"),
    );
  });

  it("fills the WSL downloads root after choosing a Windows downloads folder", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return Response.json(queueResponse("abc", "Done Torrent"));
        }
        if (url === "/api/torrents/abc") {
          return Response.json(torrentDetail("abc", "Done Torrent"));
        }
        if (url === "/api/system/pick-folder") {
          return Response.json({ path: "C:\\Users\\seanl\\Documents\\Torrents", cancelled: false });
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);
    expect((await screen.findAllByText("Done Torrent")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Settings$/ }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Browse Windows downloads root" }));

    await waitFor(() =>
      expect(screen.getByLabelText("WSL downloads root")).toHaveValue("/mnt/c/Users/seanl/Documents/Torrents"),
    );
  });

  it("selects the WSL downloads root through the local folder picker", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return Response.json(queueResponse("abc", "Done Torrent"));
        }
        if (url === "/api/torrents/abc") {
          return Response.json(torrentDetail("abc", "Done Torrent"));
        }
        if (url === "/api/system/pick-folder") {
          return Response.json({ path: "D:\\Torrents", cancelled: false });
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);
    expect((await screen.findAllByText("Done Torrent")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Settings$/ }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Browse WSL downloads root" }));

    await waitFor(() =>
      expect(screen.getByLabelText("WSL downloads root")).toHaveValue("/mnt/d/Torrents"),
    );
  });

  it("shows Keep confirmation for unmarked videos and expires armed confirmation after 8 seconds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return Response.json(queueResponse("abc", "Done Torrent"));
        }
        if (url === "/api/torrents/abc") {
          return Response.json({
            ...torrentDetail("abc", "Done Torrent"),
            candidates: [
              ...torrentDetail("abc", "Done Torrent").candidates,
              {
                fileIndex: 2,
                name: "bonus.mp4",
                extension: "mp4",
                sizeBytes: 500,
                path: "/mnt/c/Downloads/Done Torrent/bonus.mp4",
                playable: true,
              },
            ],
          });
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);
    expect((await screen.findAllByText("main.mp4")).length).toBeGreaterThan(0);

    vi.useFakeTimers();
    fireEvent.click(screen.getAllByRole("button", { name: /E Keep/ })[0]);

    expect(screen.getByText("Keep deletes unmarked torrent leftovers.")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });

    expect(screen.queryByText("Keep deletes unmarked torrent leftovers.")).not.toBeInTheDocument();
  });

  it("requires an explicit cleanup retry confirmation for cleanup-failed attention", async () => {
    let queueCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/queue") {
        queueCalls += 1;
        return Response.json({
          ...queueResponse("abc", "Done Torrent"),
          torrents: [],
          attentionTorrents:
            queueCalls === 1
              ? [
                  {
                    hash: "abc",
                    name: "Done Torrent",
                    status: "attention",
                    progress: 1,
                    totalSizeBytes: 0,
                    savePath: "",
                    candidates: [],
                    junkFiles: [],
                    attentionReason: "cleanup_failed",
                    attentionDetail: "cleanup delete failed",
                    movedFiles: ["/mnt/c/Review/main.mp4"],
                  },
                ]
              : [],
        });
      }
      if (url === "/api/torrents/abc/cleanup-retry" && init?.method === "POST") {
        return Response.json({ ok: true });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("cleanup delete failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry cleanup/ }));
    expect(screen.getByRole("button", { name: /Confirm retry/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirm retry/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/torrents/abc/cleanup-retry",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ confirmed: true }),
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("cleanup delete failed")).not.toBeInTheDocument());
  });
});

function queueResponse(hash: string, name: string) {
  return {
    torrents: [
      {
        hash,
        name,
        status: "completed",
        progress: 1,
        totalSizeBytes: 1200,
        savePath: `C:\\Downloads\\${name}`,
        contentPath: `C:\\Downloads\\${name}`,
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

function torrentDetail(hash: string, name: string) {
  return {
    hash,
    name,
    status: "completed",
    progress: 1,
    totalSizeBytes: 1200,
    savePath: `C:\\Downloads\\${name}`,
    candidates: [
      {
        fileIndex: 0,
        name: "main.mp4",
        extension: "mp4",
        sizeBytes: 1000,
        path: `/mnt/c/Downloads/${name}/main.mp4`,
        playable: true,
      },
    ],
    junkFiles: [{ fileIndex: 1, name: "readme.txt", sizeBytes: 200 }],
  };
}
