export type ReviewCommand =
  | "previousTorrent"
  | "nextTorrent"
  | "previousCandidate"
  | "nextCandidate"
  | "toggleMark"
  | "keep"
  | "reject"
  | "openExternal"
  | "openFolder"
  | "toggleMute"
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
    return "previousTorrent";
  }
  if (key === "a") {
    return "nextTorrent";
  }
  if (key === "w") {
    return "previousCandidate";
  }
  if (key === "s") {
    return "nextCandidate";
  }
  if (key === "f") {
    return "toggleMark";
  }
  if (key === "e") {
    return "keep";
  }
  if (key === "d") {
    return "reject";
  }
  if (key === "t") {
    return "openExternal";
  }
  if (key === "g") {
    return "openFolder";
  }
  if (key === "m") {
    return "toggleMute";
  }
  if (key === "escape") {
    return "cancel";
  }

  return null;
}
