import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/angainor/StatusBadge";

describe("StatusBadge", () => {
  it("treats uppercase backend success statuses as success badges", () => {
    render(<StatusBadge status="CONFIRMED" />);

    const badge = screen.getByText("CONFIRMED");
    expect(badge.className).toContain("text-success");
  });

  it("treats documented transfer failure statuses as destructive badges", () => {
    render(<StatusBadge status="CHAIN_REVERTED" />);

    const badge = screen.getByText("CHAIN_REVERTED");
    expect(badge.className).toContain("text-destructive");
  });
});
