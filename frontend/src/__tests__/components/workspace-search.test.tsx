import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { WorkspaceSearch } from "@/components/angainor/WorkspaceSearch";
import { getDocuments } from "@/services";
vi.mock("@/services", () => ({ getDocuments: vi.fn() }));
function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function setup(isAdmin: boolean) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <WorkspaceSearch
          destinations={[{ label: "Documents", path: "/documents" }]}
          isAdmin={isAdmin}
        />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("workspace search", () => {
  beforeEach(() => vi.clearAllMocks());
  it("opens with the keyboard shortcut and routes to the selected source", async () => {
    vi.mocked(getDocuments).mockResolvedValue({
      meta: { requestId: "test", timestamp: "2026-11-01" },
      data: [
        {
          documentId: "doc/1",
          originalFilename: "Fund side letter.pdf",
          documentType: "SIDE_LETTER",
        } as never,
      ],
    });
    setup(true);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "side letter" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Fund side letter.pdf" }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/documents?document=doc%2F1",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("does not request administrator documents in an investor session", () => {
    setup(false);
    fireEvent.click(screen.getByRole("button", { name: "Search workspace" }));
    expect(getDocuments).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Documents" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/documents");
  });
});
