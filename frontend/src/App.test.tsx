import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the review workbench", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Review Queue" })).toBeInTheDocument();
    expect(screen.getByLabelText("Review queue")).toBeInTheDocument();
    expect(screen.getByLabelText("Media preview")).toBeInTheDocument();
    expect(screen.getByLabelText("Video candidates")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });
});
