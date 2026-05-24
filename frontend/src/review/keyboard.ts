export type ReviewCommand =
  | "refreshQueue"
  | "previousTorrent"
  | "nextTorrent"
  | "previousCandidate"
  | "nextCandidate"
  | "toggleMark"
  | "keep"
  | "reject"
  | "openExternal"
  | "toggleSettings"
  | "cancel";

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

export function commandFromKey(event: KeyboardEvent): ReviewCommand | null {
  if (isTypingTarget(event.target)) {
    return event.key === "Escape" ? "cancel" : null;
  }

  const key = event.key.toLowerCase();

  if (key === "q") {
    return "refreshQueue";
  }
  if (key === "e") {
    return "openExternal";
  }
  if (key === "r") {
    return "reject";
  }
  if (key === "t") {
    return "toggleSettings";
  }
  if (key === "a" || event.key === "ArrowLeft") {
    return "previousTorrent";
  }
  if (key === "s" || event.key === "ArrowRight") {
    return "nextTorrent";
  }
  if (key === "z" || event.key === "ArrowUp") {
    return "previousCandidate";
  }
  if (key === "x" || event.key === "ArrowDown") {
    return "nextCandidate";
  }
  if (key === "d" || event.code === "Space") {
    return "toggleMark";
  }
  if (key === "f") {
    return "keep";
  }
  if (key === "escape") {
    return "cancel";
  }

  return null;
}
