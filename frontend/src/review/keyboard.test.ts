import { describe, expect, it } from "vitest";
import { commandFromKey } from "./keyboard";

describe("keyboard commands", () => {
  it("maps selected qBittorrent-theme left-hand review keys", () => {
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "q" }))).toBe("refreshQueue");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "e" }))).toBe("openExternal");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "r" }))).toBe("reject");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "t" }))).toBe("toggleSettings");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "a" }))).toBe("previousTorrent");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "s" }))).toBe("nextTorrent");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "d" }))).toBe("toggleMark");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "f" }))).toBe("keep");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "z" }))).toBe("previousCandidate");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "x" }))).toBe("nextCandidate");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "Escape" }))).toBe("cancel");
  });

  it("keeps typing contexts from triggering review actions", () => {
    const input = document.createElement("input");
    const event = new KeyboardEvent("keydown", { key: "q" });
    Object.defineProperty(event, "target", { value: input });

    expect(commandFromKey(event)).toBeNull();
  });
});
