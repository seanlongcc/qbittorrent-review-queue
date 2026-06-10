import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CandidateTable, MediaStage, QueueSidebar, ReviewCommandBar } from "./Workbench";

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
    expect(video).toHaveAttribute("preload", "metadata");
    expect(video).toHaveAttribute("src", "/media/abc/7");
  });

  it("toggles global preview mute from the control before Open External", () => {
    const onToggleMuted = vi.fn();

    render(
      <MediaStage
        loading={false}
        muted
        onToggleMuted={onToggleMuted}
        onOpenExternal={() => undefined}
        onOpenFolder={() => undefined}
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

    const buttons = screen.getAllByRole("button");
    const labels = buttons.map((button) => button.getAttribute("aria-label") ?? button.textContent);

    expect((screen.getByLabelText("Autoplay video preview") as HTMLVideoElement).muted).toBe(true);
    expect(labels.indexOf("Unmute preview audio, M")).toBeLessThan(labels.indexOf("Open external, T"));
    expect(labels.indexOf("Open external, T")).toBeLessThan(labels.indexOf("Open folder, G"));
    expect(screen.getByRole("button", { name: "Unmute preview audio, M" })).toHaveTextContent("M");
    expect(screen.getByRole("button", { name: "Unmute preview audio, M" }).parentElement).toHaveClass("preview-actions");
    expect(screen.getByRole("button", { name: "Open external, T" }).parentElement).toHaveClass("preview-actions");
    expect(screen.getByRole("button", { name: "Open folder, G" }).parentElement).toHaveClass("preview-actions");
    expect(screen.getByRole("button", { name: "Open external, T" }).parentElement).not.toHaveClass("preview-title");

    fireEvent.click(screen.getByRole("button", { name: "Unmute preview audio, M" }));

    expect(onToggleMuted).toHaveBeenCalledTimes(1);
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

  it("opens the selected torrent folder from the preview action row", () => {
    const onOpenFolder = vi.fn();

    render(
      <MediaStage
        loading={false}
        onOpenFolder={onOpenFolder}
        torrent={{
          hash: "abc",
          name: "Done Torrent",
          status: "completed",
          progress: 1,
          totalSizeBytes: 1200,
          savePath: "C:\\Downloads\\Done Torrent",
        }}
        candidate={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open folder, G" }));

    expect(onOpenFolder).toHaveBeenCalledTimes(1);
  });
});

describe("ReviewCommandBar", () => {
  it("orders review buttons around the split key cells", () => {
    render(
      <ReviewCommandBar
        markedCount={1}
        folderCount={16}
        folderLimit={40}
        armedAction={null}
        busy={false}
        activeMissing={false}
        keepBlocked={false}
        hasTorrent
        onCommand={() => undefined}
      />,
    );

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Q",
      "W",
      "S",
      "A",
      "FMark",
      "EKeep",
      "DDelete",
    ]);
    expect(screen.getByRole("button", { name: "Previous torrent, Q" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next torrent, A" })).toBeInTheDocument();
    expect(screen.getByText("16 / 40")).toBeInTheDocument();
    expect(screen.getByText("in use")).toBeInTheDocument();
  });
});

describe("CandidateTable", () => {
  it("marks moved candidates with a distinct row state and disabled mark control", () => {
    const onToggleMark = vi.fn();

    render(
      <CandidateTable
        torrent={{
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
        }}
        activeCandidate={null}
        markedIndexes={[]}
        movedIndexes={[0]}
        armedAction={null}
        busy={false}
        activeMissing={false}
        onSelectCandidate={() => undefined}
        onToggleMark={onToggleMark}
        onCommand={() => undefined}
      />,
    );

    const movedRow = screen.getByText("main.mp4").closest(".candidate-row");
    const movedButton = screen.getByRole("button", { name: "Moved candidate" });

    expect(movedRow).toHaveClass("moved");
    expect(screen.getByText("moved")).toBeInTheDocument();
    expect(movedButton).toBeDisabled();

    fireEvent.click(movedButton);

    expect(onToggleMark).not.toHaveBeenCalled();
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
        busy={false}
        loading={false}
        onRefresh={() => undefined}
        onSelect={() => undefined}
        onSortChange={() => undefined}
        sort={{ field: "added", direction: "desc" }}
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
        busy={false}
        loading={false}
        onRefresh={() => undefined}
        onSelect={() => undefined}
        onSortChange={() => undefined}
        sort={{ field: "added", direction: "desc" }}
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
