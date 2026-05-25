import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CandidateTabs, MediaStage, QueueSidebar } from "./Workbench";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MediaStage", () => {
  it("renders playable videos with sound enabled by default", () => {
    render(
      <MediaStage
        loading={false}
        torrent={{
          hash: "abc",
          name: "Done Torrent",
          status: "completed",
          progress: 1,
          totalSizeBytes: 1200,
          savePath: "C:\\Downloads\\Done Torrent",
        }}
        candidate={{
          fileIndex: 7,
          name: "main.mp4",
          extension: "mp4",
          sizeBytes: 1000,
          path: "/mnt/c/Downloads/Done Torrent/main.mp4",
          playable: true,
        }}
      />,
    );

    const video = screen.getByLabelText("Autoplay video preview") as HTMLVideoElement;

    expect(video).toHaveAttribute("autoplay");
    expect(video.muted).toBe(false);
    expect(video).not.toHaveAttribute("muted");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("preload", "auto");
    expect(video).toHaveAttribute("src", "/media/abc/7");
  });

  it("renders the empty stage without instructional placeholder text", () => {
    render(<MediaStage loading={false} torrent={null} candidate={null} />);

    expect(screen.queryByText("Select a completed torrent")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Empty media preview")).toHaveClass("empty");
  });

  it("pauses browser playback before opening the selected video externally", () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const onOpenExternal = vi.fn();

    render(
      <MediaStage
        loading={false}
        onOpenExternal={onOpenExternal}
        torrent={{
          hash: "abc",
          name: "Done Torrent",
          status: "completed",
          progress: 1,
          totalSizeBytes: 1200,
          savePath: "C:\\Downloads\\Done Torrent",
        }}
        candidate={{
          fileIndex: 7,
          name: "main.mp4",
          extension: "mp4",
          sizeBytes: 1000,
          path: "/mnt/c/Downloads/Done Torrent/main.mp4",
          playable: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Open external/ }));

    expect(pause).toHaveBeenCalledTimes(1);
    expect(onOpenExternal).toHaveBeenCalledTimes(1);
  });
});

describe("CandidateTabs", () => {
  it("orders review navigation buttons by torrent, video, then mark", () => {
    render(<CandidateTabs onCommand={() => undefined} />);

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "QPrev torrent",
      "ANext torrent",
      "WPrev video",
      "SNext video",
      "FMark selected",
    ]);
  });
});

describe("QueueSidebar", () => {
  it("keeps the active torrent visible in the scroll rail", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const restoreMetrics = mockTorrentRailMetrics({ scrollHeight: 1600, clientHeight: 420 });

    render(
      <QueueSidebar
        activeHash="torrent-24"
        attentionTorrents={[]}
        busy={false}
        loading={false}
        onRefresh={() => undefined}
        onSelect={() => undefined}
        onSortChange={() => undefined}
        sort={{ field: "added", direction: "desc" }}
        settings={{
          qbtBaseUrl: "http://localhost:8080",
          qbtUsername: "admin",
          passwordConfigured: true,
          windowsDownloadRoot: "C:\\Downloads",
          wslDownloadRoot: "/mnt/c/Downloads",
          sessionFolder: "C:\\Review",
          sessionFolderLimit: 40,
          folderCount: 2,
          connected: true,
        }}
        torrents={Array.from({ length: 30 }, (_, index) => ({
          hash: `torrent-${index}`,
          name: `Torrent ${index}`,
          status: "completed",
          progress: 1,
          totalSizeBytes: (index + 1) * 1000,
          savePath: `C:\\Downloads\\Torrent ${index}`,
        }))}
      />,
    );

    expect(screen.getByRole("button", { name: /Torrent 24/ })).toHaveAttribute("aria-current", "true");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
    restoreMetrics();
  });

  it("does not scroll the page when the torrent rail is not scrollable", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const restoreMetrics = mockTorrentRailMetrics({ scrollHeight: 420, clientHeight: 420 });

    render(
      <QueueSidebar
        activeHash="torrent-1"
        attentionTorrents={[]}
        busy={false}
        loading={false}
        onRefresh={() => undefined}
        onSelect={() => undefined}
        onSortChange={() => undefined}
        sort={{ field: "added", direction: "desc" }}
        settings={{
          qbtBaseUrl: "http://localhost:8080",
          qbtUsername: "admin",
          passwordConfigured: true,
          windowsDownloadRoot: "C:\\Downloads",
          wslDownloadRoot: "/mnt/c/Downloads",
          sessionFolder: "C:\\Review",
          sessionFolderLimit: 40,
          folderCount: 2,
          connected: true,
        }}
        torrents={Array.from({ length: 3 }, (_, index) => ({
          hash: `torrent-${index}`,
          name: `Torrent ${index}`,
          status: "completed",
          progress: 1,
          totalSizeBytes: (index + 1) * 1000,
          savePath: `C:\\Downloads\\Torrent ${index}`,
        }))}
      />,
    );

    expect(screen.getByRole("button", { name: /Torrent 1/ })).toHaveAttribute("aria-current", "true");
    expect(scrollIntoView).not.toHaveBeenCalled();
    restoreMetrics();
  });
});

function mockTorrentRailMetrics({
  scrollHeight,
  clientHeight,
}: {
  scrollHeight: number;
  clientHeight: number;
}) {
  const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
  const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");

  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return this.classList.contains("torrent-list") ? scrollHeight : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return this.classList.contains("torrent-list") ? clientHeight : 0;
    },
  });

  return () => {
    if (scrollHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeightDescriptor);
    } else {
      delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
    }
    if (clientHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
    } else {
      delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
    }
  };
}
