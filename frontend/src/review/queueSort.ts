import type { ReviewTorrent } from "../domain/types";

export type QueueSortField = "added" | "name" | "size";
export type SortDirection = "asc" | "desc";

export type QueueSort = {
  field: QueueSortField;
  direction: SortDirection;
};

export function sortReviewableTorrents<T extends ReviewTorrent>(torrents: T[], sort: QueueSort): T[] {
  const direction = sort.direction === "asc" ? 1 : -1;
  return torrents
    .map((torrent, index) => ({ torrent, index }))
    .sort((left, right) => {
      if (sort.field === "name") {
        const compared = left.torrent.name.localeCompare(right.torrent.name, undefined, { sensitivity: "base" });
        return tieBreak(compared * direction, left.index, right.index);
      }
      if (sort.field === "size") {
        const compared = left.torrent.totalSizeBytes - right.torrent.totalSizeBytes;
        return tieBreak(compared * direction, left.index, right.index);
      }
      const leftAdded = addedOnSeconds(left.torrent);
      const rightAdded = addedOnSeconds(right.torrent);
      if (leftAdded === null && rightAdded === null) {
        return (left.index - right.index) * direction;
      }
      const compared = (leftAdded ?? -1) - (rightAdded ?? -1);
      return tieBreak(compared * direction, left.index, right.index);
    })
    .map(({ torrent }) => torrent);
}

export function sortDescription(sort: QueueSort): string {
  if (sort.field === "name") {
    return sort.direction === "asc" ? "A to Z" : "Z to A";
  }
  if (sort.field === "size") {
    return sort.direction === "asc" ? "Smallest first" : "Largest first";
  }
  return sort.direction === "asc" ? "Oldest added first" : "Newest added first";
}

function tieBreak(compared: number, leftIndex: number, rightIndex: number): number {
  return compared === 0 ? leftIndex - rightIndex : compared;
}

function addedOnSeconds(torrent: ReviewTorrent): number | null {
  return torrent.addedOnSeconds && torrent.addedOnSeconds > 0 ? torrent.addedOnSeconds : null;
}
