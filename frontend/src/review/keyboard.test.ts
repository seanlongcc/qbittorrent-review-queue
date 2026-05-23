import { describe, expect, it } from "vitest";
import { commandFromKey } from "./keyboard";

describe("keyboard commands", () => {
  it("maps left-hand review keys", () => {
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "w" }))).toBe("previousCandidate");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "s" }))).toBe("nextCandidate");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "a" }))).toBe("previousTorrent");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "d" }))).toBe("nextTorrent");
    expect(commandFromKey(new KeyboardEvent("keydown", { code: "Space" }))).toBe("toggleMark");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "q" }))).toBe("keep");
    expect(commandFromKey(new KeyboardEvent("keydown", { key: "e" }))).toBe("reject");
  });

  it("keeps typing contexts from triggering review actions", () => {
    const input = document.createElement("input");
    const event = new KeyboardEvent("keydown", { key: "q" });
    Object.defineProperty(event, "target", { value: input });

    expect(commandFromKey(event)).toBeNull();
  });
});
