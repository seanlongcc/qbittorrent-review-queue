import type { ExecutionHistoryAction, ExecutionHistoryItem } from "../domain/types";

export function HistoryPanel({ items }: { items: ExecutionHistoryItem[] }) {
  return (
    <section aria-label="Execution history" className="history-section">
      <div className="section-head">
        <span>History</span>
        <span className="meta">{items.length} logged</span>
      </div>
      {items.length === 0 ? (
        <div className="history-empty">No review actions logged yet</div>
      ) : (
        <div className="history-list">
          {items.slice(0, 12).map((item) => (
            <article className={`history-row ${item.action} ${item.status}`} key={item.id}>
              <div className="history-main">
                <span className="history-action">{labelForAction(item.action)}</span>
                <span className="history-summary">{item.summary}</span>
                <span className="history-torrent">{item.torrentName ?? item.torrentHash ?? "Unknown torrent"}</span>
              </div>
              <time dateTime={item.timestamp}>{formatHistoryTime(item.timestamp)}</time>
              {item.detail ? <p className="history-detail">{item.detail}</p> : null}
              {item.files?.length ? (
                <ul className="history-files" aria-label={`${item.summary} files`}>
                  {item.files.map((file, index) => (
                    <li key={`${item.id}-${file.fileIndex ?? index}`}>
                      <span>{file.destinationPath ?? file.sourcePath ?? file.name ?? "Unknown file"}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function labelForAction(action: ExecutionHistoryAction): string {
  if (action === "keep") {
    return "Keep";
  }
  if (action === "delete") {
    return "Delete";
  }
  if (action === "open_external") {
    return "Open";
  }
  return "Failure";
}

function formatHistoryTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
