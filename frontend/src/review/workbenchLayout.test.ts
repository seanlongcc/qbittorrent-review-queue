import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../styles.css"), "utf8");

function declarationBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, "m"));
  expect(match, `${selector} styles should exist`).not.toBeNull();
  return match?.groups?.body ?? "";
}

function declarationValue(block: string, property: string) {
  const match = block.match(new RegExp(`${property}\\s*:\\s*([^;]+);`));
  return match?.[1]?.trim();
}

describe("workbench layout CSS", () => {
  it("keeps the desktop workbench in the viewport row instead of a content-sized shell row", () => {
    const shell = declarationBlock(".qbt-shell");
    const main = declarationBlock(".qbt-main");

    expect(declarationValue(shell, "grid-template-rows")).toBe("auto minmax(0, 1fr)");
    expect(declarationValue(main, "min-height")).toBe("0");
    expect(declarationValue(main, "overflow")).toBe("hidden");
  });

  it("uses Mark blue for selected and marked candidates until kept candidates turn Keep green", () => {
    const marked = declarationBlock(".candidate-row.marked");
    const selected = declarationBlock(".candidate-row.selected");
    const moved = declarationBlock(".candidate-row.moved");
    const movedSelected = declarationBlock(".candidate-row.moved.selected");

    expect(declarationValue(marked, "border-color")).toBe("oklch(43% 0.058 224)");
    expect(declarationValue(marked, "background")).toBe("oklch(33% 0.052 224)");
    expect(declarationValue(selected, "border-color")).toBe("oklch(43% 0.058 224)");
    expect(declarationValue(selected, "background")).toBe("oklch(33% 0.052 224)");
    expect(declarationValue(moved, "border-color")).toBe("oklch(40% 0.07 154)");
    expect(declarationValue(moved, "background")).toBe("oklch(33% 0.052 154)");
    expect(declarationValue(movedSelected, "border-color")).toBe(declarationValue(moved, "border-color"));
    expect(declarationValue(movedSelected, "background")).toBe(declarationValue(moved, "background"));
  });

  it("keeps the mark checkbox neutral until row state makes it blue or Keep green", () => {
    const base = declarationBlock(".mark-cell");
    const selected = declarationBlock(".candidate-row.selected .mark-cell");
    const marked = declarationBlock(".candidate-row.marked .mark-cell");
    const moved = declarationBlock(".candidate-row.moved .mark-cell");

    expect(declarationValue(base, "color")).toBe("var(--muted-text)");
    expect(declarationValue(selected, "border-color")).toBe("oklch(43% 0.058 224)");
    expect(declarationValue(selected, "background")).toBe("oklch(33% 0.052 224)");
    expect(declarationValue(marked, "border-color")).toBe(declarationValue(selected, "border-color"));
    expect(declarationValue(marked, "background")).toBe(declarationValue(selected, "background"));
    expect(declarationValue(moved, "border-color")).toBe("oklch(40% 0.07 154)");
    expect(declarationValue(moved, "background")).toBe("oklch(33% 0.052 154)");
  });

  it("orders candidate row states so selection overrides marked and moved overrides selection", () => {
    expect(styles.indexOf(".candidate-row.marked")).toBeLessThan(styles.indexOf(".candidate-row.selected"));
    expect(styles.indexOf(".candidate-row.selected")).toBeLessThan(styles.indexOf(".candidate-row.moved"));
  });
});
