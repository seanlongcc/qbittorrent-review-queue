import { describe, expect, it } from "vitest";
import { commandFromKey } from "./keyboard";

describe("keyboard commands", () => {
  it("maps review keys to the current left-hand workflow", () => {
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "q" }))).toBe("previousTorrent");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "a" }))).toBe("nextTorrent");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "w" }))).toBe("previousCandidate");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "s" }))).toBe("nextCandidate");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "f" }))).toBe("toggleMark");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "e" }))).toBe("keep");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "d" }))).toBe("reject");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "t" }))).toBe("openExternal");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "g" }))).toBe("openFolder");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "m" }))).toBe("toggleMute");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "Escape" }))).toBe("cancel");
  });

  it("does not expose refresh or settings keyboard commands", () => {
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "r" }))).toBeNull();
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "," }))).toBeNull();
  });

  it("keeps typing contexts from triggering review actions", () => {
    const input = document.createElement("input");
    const event = new KeyboardEvent("keydown", { key: "q" });
    Object.defineProperty(event, "target", { value: input });

    expect(commandFromKey(event)).toBeNull();
  });
});
