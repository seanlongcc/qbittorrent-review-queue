import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
        if (url === "/api/history") {
          return Response.json({ items: [] });
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
    expect(screen.getByLabelText("Review commands")).toBeInTheDocument();
    expect(screen.getByLabelText("Video candidates")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /E Keep/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /D Delete/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("16 / 40")).toBeInTheDocument();
    expect(screen.getByText("in use")).toBeInTheDocument();
    expect(screen.queryByText(/completed torrents/)).not.toBeInTheDocument();
    expect(screen.queryByText("details pending")).not.toBeInTheDocument();
    expect(screen.queryByText("Marked files and delete risk")).not.toBeInTheDocument();
    expect(screen.queryByText("Non-video leftovers")).not.toBeInTheDocument();
    expect(screen.queryByText(/Junk files/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
    expect(screen.queryByText(/Left-hand keys/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sample data/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("main.mp4").length).toBeGreaterThan(0);
    });
  });

  it("loads execution history into the workbench", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return Response.json(queueResponse("abc", "Done Torrent"));
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
          return Response.json(torrentDetail("abc", "Done Torrent"));
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);

    fireEvent.click(await screen.findByRole("tab", { name: /History 1/ }));
    expect(screen.getByLabelText("Execution history")).toBeInTheDocument();
    expect(screen.getByText("Kept 1 video")).toBeInTheDocument();
    expect(screen.getByText("/mnt/c/Review/main.mp4")).toBeInTheDocument();
  });

  it("selects the top torrent under the default newest-added sort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return Response.json({
            ...queueResponse("old", "Older Torrent"),
            torrents: [
              queueTorrent("old", "Older Torrent", 100),
              queueTorrent("new", "Newer Torrent", 200),
            ],
          });
        }
        if (url === "/api/history") {
          return Response.json({ items: [] });
        }
        if (url === "/api/torrents/old") {
          return Response.json(torrentDetail("old", "Older Torrent"));
        }
        if (url === "/api/torrents/new") {
          return Response.json(torrentDetail("new", "Newer Torrent"));
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);

    expect(await screen.findByRole("button", { name: /Newer Torrent/ })).toHaveAttribute("aria-current", "true");
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
        if (url === "/api/history") {
          return Response.json({ items: [] });
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

  it("shows a toast after manual refresh", async () => {
    let queueCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          queueCalls += 1;
          return Response.json(queueResponse("abc", "Done Torrent"));
        }
        if (url === "/api/history") {
          return Response.json({ items: [] });
        }
        if (url === "/api/torrents/abc") {
          return Response.json(torrentDetail("abc", "Done Torrent"));
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);
    expect((await screen.findAllByText("Done Torrent")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Refresh queue" }));

    await waitFor(() => expect(queueCalls).toBe(2));
    expect(await screen.findByText("Queue refreshed")).toBeInTheDocument();
    expect(screen.queryByText("Queue refreshed.")).not.toBeInTheDocument();
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
        if (url === "/api/history") {
          return Response.json({ items: [] });
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
    expect(await screen.findByText("Settings saved")).toBeInTheDocument();
  });

  it("updates moved rows and preserves slots in use when later queue refresh is stale", async () => {
    let kept = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/queue") {
        return Response.json({
          ...queueResponse("abc", "Alpha Torrent"),
          torrents: [queueTorrent("abc", "Alpha Torrent", 300), queueTorrent("def", "Beta Torrent", 200)],
          settings: {
            ...queueResponse("abc", "Alpha Torrent").settings,
            folderCount: 16,
          },
        });
      }
      if (url === "/api/history") {
        return Response.json({
          items: kept
            ? [
                {
                  id: "keep-1",
                  timestamp: "2026-05-26T20:00:00Z",
                  action: "keep",
                  status: "success",
                  torrentHash: "abc",
                  torrentName: "Alpha Torrent",
                  summary: "Kept 1 video",
                  files: [{ destinationPath: "/mnt/c/Review/main.mp4", name: "main.mp4" }],
                },
              ]
            : [],
        });
      }
      if (url === "/api/torrents/abc") {
        return Response.json(torrentDetail("abc", "Alpha Torrent"));
      }
      if (url === "/api/torrents/def") {
        return Response.json(torrentDetail("def", "Beta Torrent"));
      }
      if (url === "/api/torrents/abc/keep" && init?.method === "POST") {
        kept = true;
        return Response.json({ moved: ["/mnt/c/Review/main.mp4"], folderCount: 17 });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect((await screen.findAllByText("main.mp4")).length).toBeGreaterThan(0);
    expect(screen.getByText("16 / 40")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /E Keep/ })[0]);
    expect(screen.getAllByRole("button", { name: /E Confirm/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /E Confirm/ })[0]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/torrents/abc/keep",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ fileIndexes: [0], confirmed: true }),
        }),
      ),
    );
    await waitFor(() => expect(screen.getByText("17 / 40")).toBeInTheDocument());
    expect(screen.getByText(/moved/)).toBeInTheDocument();
    expect(screen.getByText("in use")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("tab", { name: /History 1/ }));
    expect(within(screen.getByLabelText("Execution history")).getByText("Kept 1 video")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Alpha Torrent/ })).toHaveAttribute("aria-current", "true");

    fireEvent.click(screen.getByRole("button", { name: "Next torrent, A" }));
    expect(await screen.findByRole("button", { name: /Beta Torrent/ })).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "Refresh queue" }));

    await waitFor(() => expect(screen.getByText("Queue refreshed")).toBeInTheDocument());
    expect(screen.getByText("17 / 40")).toBeInTheDocument();
  });

  it("keeps review actions busy when history refresh fails", async () => {
    let kept = false;
    let rejectHistory: (error: Error) => void = () => undefined;
    let resolveKeep: (response: Response) => void = () => undefined;
    const historyPromise = new Promise<Response>((_resolve, reject) => {
      rejectHistory = reject;
    });
    const keepPromise = new Promise<Response>((resolve) => {
      resolveKeep = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/queue") {
        return Response.json({
          ...queueResponse("abc", "Alpha Torrent"),
          settings: {
            ...queueResponse("abc", "Alpha Torrent").settings,
            folderCount: kept ? 17 : 16,
          },
        });
      }
      if (url === "/api/history") {
        return historyPromise;
      }
      if (url === "/api/torrents/abc") {
        return Response.json(torrentDetail("abc", "Alpha Torrent"));
      }
      if (url === "/api/torrents/abc/keep" && init?.method === "POST") {
        kept = true;
        return keepPromise;
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect((await screen.findAllByText("main.mp4")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /E Keep/ })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /E Confirm/ })[0]);

    const confirmButton = screen.getAllByRole("button", { name: /E Confirm/ })[0];
    expect(confirmButton).toBeDisabled();

    await act(async () => {
      rejectHistory(new Error("history unavailable"));
      await Promise.resolve();
    });
    expect(confirmButton).toBeDisabled();

    resolveKeep(Response.json({ moved: ["/mnt/c/Review/main.mp4"], folderCount: 17 }));

    expect(await screen.findByText("Kept 1 video")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("17 / 40")).toBeInTheDocument());
  });

  it("deletes the active torrent, advances to the next sorted torrent, and shows a toast", async () => {
    let deleted = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/queue") {
        return Response.json({
          ...queueResponse("abc", "Alpha Torrent"),
          torrents: deleted
            ? [queueTorrent("def", "Beta Torrent", 200)]
            : [queueTorrent("abc", "Alpha Torrent", 300), queueTorrent("def", "Beta Torrent", 200)],
        });
      }
      if (url === "/api/history") {
        return Response.json({
          items: deleted
            ? [
                {
                  id: "delete-1",
                  timestamp: "2026-05-26T20:00:00Z",
                  action: "delete",
                  status: "success",
                  torrentHash: "abc",
                  torrentName: "Alpha Torrent",
                  summary: "Deleted torrent and files",
                  detail: "qBittorrent deleteFiles=true",
                },
              ]
            : [],
        });
      }
      if (url === "/api/torrents/abc") {
        return Response.json(torrentDetail("abc", "Alpha Torrent"));
      }
      if (url === "/api/torrents/def") {
        return Response.json(torrentDetail("def", "Beta Torrent"));
      }
      if (url === "/api/torrents/abc/reject" && init?.method === "POST") {
        deleted = true;
        return Response.json({ ok: true });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByRole("button", { name: /Alpha Torrent/ })).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getAllByRole("button", { name: /D Delete/ })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /D Confirm/ })[0]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/torrents/abc/reject",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ confirmed: true }),
        }),
      ),
    );
    expect((await screen.findAllByText("Deleted torrent and files")).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByRole("tab", { name: /History 1/ }));
    expect(within(screen.getByLabelText("Execution history")).getByText("qBittorrent deleteFiles=true")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Beta Torrent/ })).toHaveAttribute("aria-current", "true"));
  });

  it("uses a toast, not the action status section, after opening externally", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/queue") {
        return Response.json(queueResponse("abc", "Done Torrent"));
      }
      if (url === "/api/history") {
        return Response.json({ items: [] });
      }
      if (url === "/api/torrents/abc") {
        return Response.json(torrentDetail("abc", "Done Torrent"));
      }
      if (url === "/api/torrents/abc/open" && init?.method === "POST") {
        return Response.json({ ok: true });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<App />);

    expect(await screen.findByLabelText("Autoplay video preview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Open external/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/torrents/abc/open",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(await screen.findByText("Opened main.mp4")).toBeInTheDocument();
    expect(screen.queryByText("Opened main.mp4.")).not.toBeInTheDocument();
    expect(container.querySelector(".decision-notice")).toBeNull();
  });

  it("opens the selected torrent folder with the G keybind", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/queue") {
        return Response.json(queueResponse("abc", "Done Torrent"));
      }
      if (url === "/api/history") {
        return Response.json({ items: [] });
      }
      if (url === "/api/torrents/abc") {
        return Response.json(torrentDetail("abc", "Done Torrent"));
      }
      if (url === "/api/torrents/abc/open-folder" && init?.method === "POST") {
        return Response.json({ ok: true });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<App />);

    const video = await screen.findByLabelText("Autoplay video preview");
    fireEvent.keyDown(video, { key: "G" });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/torrents/abc/open-folder",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(await screen.findByText("Opened folder for Done Torrent")).toBeInTheDocument();
    expect(container.querySelector(".decision-notice")).toBeNull();
  });

  it("handles review keybinds before a focused video can consume them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return Response.json(queueResponse("abc", "Done Torrent"));
        }
        if (url === "/api/history") {
          return Response.json({ items: [] });
        }
        if (url === "/api/torrents/abc") {
          return Response.json(torrentDetail("abc", "Done Torrent"));
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);

    const video = (await screen.findByLabelText("Autoplay video preview")) as HTMLVideoElement;
    video.addEventListener("keydown", (event) => event.stopPropagation());
    video.focus();

    fireEvent.keyDown(video, { key: "d" });

    expect(await screen.findByText("Delete removes torrent files")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /D Confirm/ }).length).toBeGreaterThan(0);
  });

  it("toggles preview mute with the M keybind before a focused video can consume it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return Response.json(queueResponse("abc", "Done Torrent"));
        }
        if (url === "/api/history") {
          return Response.json({ items: [] });
        }
        if (url === "/api/torrents/abc") {
          return Response.json(torrentDetail("abc", "Done Torrent"));
        }
        throw new Error(`unexpected url ${url}`);
      }),
    );

    render(<App />);

    const video = (await screen.findByLabelText("Autoplay video preview")) as HTMLVideoElement;
    video.addEventListener("keydown", (event) => event.stopPropagation());
    video.focus();

    expect(video.muted).toBe(false);

    fireEvent.keyDown(video, { key: "M" });

    await waitFor(() => expect(video.muted).toBe(true));
    expect(screen.getByRole("button", { name: "Unmute preview audio, M" })).toHaveAttribute("aria-pressed", "true");
  });

  it("selects session folder through the local folder picker", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/queue") {
          return Response.json(queueResponse("abc", "Done Torrent"));
        }
        if (url === "/api/history") {
          return Response.json({ items: [] });
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
        if (url === "/api/history") {
          return Response.json({ items: [] });
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
        if (url === "/api/history") {
          return Response.json({ items: [] });
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

  it("confirms before moving marked videos when unmarked videos remain", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/queue") {
        return Response.json(queueResponse("abc", "Done Torrent"));
      }
      if (url === "/api/history") {
        return Response.json({ items: [] });
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
      if (url === "/api/torrents/abc/keep" && init?.method === "POST") {
        return Response.json({ moved: ["/mnt/c/Review/main.mp4"], folderCount: 17 });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    expect((await screen.findAllByText("main.mp4")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /E Keep/ })[0]);

    expect(screen.getAllByRole("button", { name: /E Confirm/ }).length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/torrents/abc/keep",
      expect.anything(),
    );
    fireEvent.click(screen.getAllByRole("button", { name: /E Confirm/ })[0]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/torrents/abc/keep",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ fileIndexes: [0], confirmed: true }),
        }),
      ),
    );
  });

  it("does not render a bottom needs-attention section", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/queue") {
        return Response.json({
          ...queueResponse("abc", "Done Torrent"),
          attentionTorrents: [
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
          ],
        });
      }
      if (url === "/api/history") {
        return Response.json({ items: [] });
      }
      if (url === "/api/torrents/abc") {
        return Response.json(torrentDetail("abc", "Done Torrent"));
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("Done Torrent")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Attention/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
    expect(screen.queryByText("cleanup delete failed")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry cleanup/ })).not.toBeInTheDocument();
  });
});

function queueResponse(hash: string, name: string) {
  return {
    torrents: [queueTorrent(hash, name, 100)],
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

function queueTorrent(hash: string, name: string, addedOnSeconds: number) {
  return {
    hash,
    name,
    addedOnSeconds,
    status: "completed",
    progress: 1,
    totalSizeBytes: 1200,
    savePath: `C:\\Downloads\\${name}`,
    contentPath: `C:\\Downloads\\${name}`,
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
