import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ExecutionHistoryItem } from "../domain/types";
import { HistoryPanel } from "./HistoryPanel";

afterEach(() => {
  cleanup();
});

describe("HistoryPanel", () => {
  it("renders empty history as a quiet status", () => {
    render(<HistoryPanel items={[]} />);

    expect(screen.getByLabelText("Execution history")).toBeInTheDocument();
    expect(screen.getByText("No review actions logged yet")).toBeInTheDocument();
  });

  it("renders keep and delete history with paths", () => {
    const items: ExecutionHistoryItem[] = [
      {
        id: "delete-1",
        timestamp: "2026-05-26T20:10:00Z",
        action: "delete",
        status: "success",
        torrentHash: "def",
        torrentName: "Beta Torrent",
        summary: "Deleted torrent and files",
        detail: "qBittorrent deleteFiles=true",
      },
      {
        id: "keep-1",
        timestamp: "2026-05-26T20:00:00Z",
        action: "keep",
        status: "success",
        torrentHash: "abc",
        torrentName: "Alpha Torrent",
        summary: "Kept 1 video",
        files: [
          {
            sourcePath: "/mnt/c/Downloads/Alpha/main.mp4",
            destinationPath: "/mnt/c/Review/main.mp4",
            fileIndex: 0,
            name: "main.mp4",
          },
        ],
      },
    ];

    render(<HistoryPanel items={items} />);

    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Keep")).toBeInTheDocument();
    expect(screen.getByText("Beta Torrent")).toBeInTheDocument();
    expect(screen.getByText("Alpha Torrent")).toBeInTheDocument();
    expect(screen.getByText("/mnt/c/Review/main.mp4")).toBeInTheDocument();
    expect(screen.getByText("qBittorrent deleteFiles=true")).toBeInTheDocument();
  });
});
