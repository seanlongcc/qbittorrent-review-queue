import { describe, expect, it } from "vitest";
import type { ReviewTorrent } from "../domain/types";
import { sortReviewableTorrents, sortDescription } from "./queueSort";

describe("queue sort", () => {
  it("sorts Added on descending by qBittorrent added_on seconds", () => {
    expect(
      sortReviewableTorrents(
        [
          torrent({ hash: "older", name: "Older", addedOnSeconds: 100 }),
          torrent({ hash: "newer", name: "Newer", addedOnSeconds: 300 }),
          torrent({ hash: "middle", name: "Middle", addedOnSeconds: 200 }),
        ],
        { field: "added", direction: "desc" },
      ).map((item) => item.hash),
    ).toEqual(["newer", "middle", "older"]);
  });

  it("sorts Added on ascending by qBittorrent added_on seconds", () => {
    expect(
      sortReviewableTorrents(
        [
          torrent({ hash: "older", name: "Older", addedOnSeconds: 100 }),
          torrent({ hash: "newer", name: "Newer", addedOnSeconds: 300 }),
          torrent({ hash: "middle", name: "Middle", addedOnSeconds: 200 }),
        ],
        { field: "added", direction: "asc" },
      ).map((item) => item.hash),
    ).toEqual(["older", "middle", "newer"]);
  });

  it("falls back to API result order when qBittorrent added_on is missing", () => {
    const apiOrder = [
      torrent({ hash: "first", name: "First" }),
      torrent({ hash: "second", name: "Second" }),
      torrent({ hash: "third", name: "Third" }),
    ];

    expect(sortReviewableTorrents(apiOrder, { field: "added", direction: "desc" }).map((item) => item.hash)).toEqual([
      "third",
      "second",
      "first",
    ]);
    expect(sortReviewableTorrents(apiOrder, { field: "added", direction: "asc" }).map((item) => item.hash)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("describes Added on using qBittorrent timestamps", () => {
    expect(sortDescription({ field: "added", direction: "desc" })).toBe("Newest added first");
    expect(sortDescription({ field: "added", direction: "asc" })).toBe("Oldest added first");
  });
});

function torrent({
  hash,
  name,
  addedOnSeconds,
}: {
  hash: string;
  name: string;
  addedOnSeconds?: number;
}): ReviewTorrent {
  return {
    hash,
    name,
    addedOnSeconds,
    status: "completed",
    progress: 1,
    totalSizeBytes: 1000,
    savePath: `C:\\Downloads\\${name}`,
  };
}
