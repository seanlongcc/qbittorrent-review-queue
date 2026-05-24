import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaStage, QueueSidebar } from "./Workbench";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MediaStage", () => {
  it("renders playable videos as reliable autoplay previews", () => {
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
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("preload", "auto");
    expect(video).toHaveAttribute("src", "/media/abc/7");
  });
});

describe("QueueSidebar", () => {
  it("keeps the active torrent visible in the scroll rail", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(
      <QueueSidebar
        activeHash="torrent-24"
        attentionTorrents={[]}
        busy={false}
        onCleanupRetry={() => undefined}
        onSelect={() => undefined}
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
  });
});
