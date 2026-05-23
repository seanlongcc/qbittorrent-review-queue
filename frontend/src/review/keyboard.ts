export type ReviewCommand =
  | "previousTorrent"
  | "nextTorrent"
  | "previousCandidate"
  | "nextCandidate"
  | "toggleMark"
  | "keep"
  | "reject"
  | "openExternal"
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

  if (key === "a" || event.key === "ArrowLeft") {
    return "previousTorrent";
  }
  if (key === "d" || event.key === "ArrowRight") {
    return "nextTorrent";
  }
  if (key === "w" || event.key === "ArrowUp") {
    return "previousCandidate";
  }
  if (key === "s" || event.key === "ArrowDown") {
    return "nextCandidate";
  }
  if (event.code === "Space") {
    return "toggleMark";
  }
  if (key === "q") {
    return "keep";
  }
  if (key === "e") {
    return "reject";
  }
  if (key === "enter") {
    return "openExternal";
  }
  if (key === "escape") {
    return "cancel";
  }

  return null;
}
