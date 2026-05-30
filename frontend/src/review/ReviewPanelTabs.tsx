import { useEffect, useState, type KeyboardEvent } from "react";
import type { ExecutionHistoryItem, ReviewTorrent, VideoCandidate } from "@/domain/types";
import { HistoryPanel } from "./HistoryPanel";
import { CandidateTable } from "./Workbench";
import type { ReviewCommand } from "./keyboard";

type ReviewPanelTab = "candidates" | "history";

export function ReviewPanelTabs({
  torrent,
  activeCandidate,
  markedIndexes,
  movedIndexes,
  armedAction,
  busy,
  activeMissing,
  historyItems,
  onSelectCandidate,
  onToggleMark,
  onCommand,
}: {
  torrent: ReviewTorrent | null;
  activeCandidate: VideoCandidate | null;
  markedIndexes: number[];
  movedIndexes: number[];
  armedAction: "keep" | "reject" | null;
  busy: boolean;
  activeMissing: boolean;
  historyItems: ExecutionHistoryItem[];
  onSelectCandidate: (index: number) => void;
  onToggleMark: (fileIndex: number) => void;
  onCommand: (command: ReviewCommand) => void;
}) {
  const [activeTab, setActiveTab] = useState<ReviewPanelTab>("candidates");
  const candidateCount = torrent?.candidates?.length ?? 0;

  useEffect(() => {
    if (armedAction) {
      setActiveTab("candidates");
    }
  }, [armedAction]);

  function selectByKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    setActiveTab((current) => (current === "candidates" ? "history" : "candidates"));
  }

  return (
    <section className="review-panel-tabs" aria-label="Review details">
      <div className="review-tab-list" role="tablist" aria-label="Review detail sections" onKeyDown={selectByKey}>
        <button
          aria-controls="review-panel-candidates"
          aria-selected={activeTab === "candidates"}
          className="review-tab"
          id="review-tab-candidates"
          role="tab"
          tabIndex={activeTab === "candidates" ? 0 : -1}
          type="button"
          onClick={() => setActiveTab("candidates")}
        >
          <span>Candidates</span>
          <span className="review-tab-count">{candidateCount}</span>
        </button>
        <button
          aria-controls="review-panel-history"
          aria-selected={activeTab === "history"}
          className="review-tab"
          id="review-tab-history"
          role="tab"
          tabIndex={activeTab === "history" ? 0 : -1}
          type="button"
          onClick={() => setActiveTab("history")}
        >
          <span>History</span>
          <span className="review-tab-count">{historyItems.length}</span>
        </button>
      </div>
      {activeTab === "candidates" ? (
        <div
          aria-labelledby="review-tab-candidates"
          className="review-tab-panel"
          id="review-panel-candidates"
          role="tabpanel"
        >
          <CandidateTable
            torrent={torrent}
            activeCandidate={activeCandidate}
            markedIndexes={markedIndexes}
            movedIndexes={movedIndexes}
            armedAction={armedAction}
            busy={busy}
            activeMissing={activeMissing}
            onSelectCandidate={onSelectCandidate}
            onToggleMark={onToggleMark}
            onCommand={onCommand}
          />
        </div>
      ) : (
        <div
          aria-labelledby="review-tab-history"
          className="review-tab-panel"
          id="review-panel-history"
          role="tabpanel"
        >
          <HistoryPanel items={historyItems} />
        </div>
      )}
    </section>
  );
}
