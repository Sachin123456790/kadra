import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/angainor/ThemeProvider";
import { ControlRoom } from "./ControlRoom";
import { request } from "./api";
import { cents, decimal } from "./Overview";

vi.mock("./api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api")>()),
  request: vi.fn(),
}));
const api = vi.mocked(request);
let funds: any[],
  states: Record<string, any>,
  conversations: Record<string, any>;
const actor = {
  id: "user",
  orgId: "organization",
  name: "Preview",
  email: "preview@example.test",
  role: "owner",
};
function makeState(fund: any) {
  return {
    fund,
    funds,
    records: [],
    totals: { commitments: "0.00", contributions: "0.00" },
    documents: [],
    facts: [],
    rulebook: { version: 0, rules: [] },
    calls: [],
    runs: [],
    approvals: [],
    events: [],
    jobs: [],
    answers: [],
    conversations: [],
    generation: 1,
    capabilities: { answers: "Evidence search" },
  };
}
function Route() {
  const location = useLocation();
  return (
    <output aria-label="Current route">
      {location.pathname + location.search}
    </output>
  );
}
function open(route: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider defaultTheme="light">
        <MemoryRouter initialEntries={[route]}>
          <ControlRoom />
          <Route />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  funds = [
    {
      id: "north",
      name: "Northstar",
      currency: "USD",
      revision: 1,
      onboarding: {},
      documents: 1,
      ready_documents: 1,
      review_documents: 0,
      rules: 1,
      source_passages: 1,
      extracted_terms: 1,
    },
    {
      id: "other",
      name: "Other Fund",
      currency: "USD",
      revision: 1,
      onboarding: {},
      documents: 0,
      review_documents: 0,
      rules: 0,
    },
  ];
  states = Object.fromEntries(funds.map((f) => [f.id, makeState(f)]));
  conversations = {};
  api.mockReset();
  api.mockImplementation(async (path, method = "GET", body) => {
    if (path === "/auth/me") return actor;
    if (path === "/portfolio") return { funds, recent: [], upcoming: [] };
    if (path.startsWith("/state")) {
      const id =
        new URLSearchParams(path.split("?")[1]).get("fundId") || "north";
      return { ...states[id], funds };
    }
    if (path.endsWith("/conversations/thread")) return conversations.thread;
    if (path.endsWith("/questions")) {
      const answer = {
        text: "Fund notice: 10 calendar days.",
        status: "REVIEWED_RULES",
        mode: "deterministic_rulebook",
        asOf: body.asOf,
        citations: [
          {
            id: "source",
            documentId: "doc",
            filename: "LPA.pdf",
            version: 2,
            locator: { page: 3 },
            quote: "Ten calendar days.",
            interpretations: [{ key: "notice" }],
          },
        ],
      };
      const entry = {
        id: "answer",
        question: body.question,
        answer,
        conversation_id: "thread",
      };
      conversations.thread = { answers: [entry] };
      states.north.conversations = [
        { id: "thread", title: body.question, created_at: "2026-11-01" },
      ];
      return { id: "answer", conversationId: "thread", answer };
    }
    if (path === "/funds" && method === "POST") {
      const fund = {
        id: "new-fund",
        name: body.name,
        currency: body.currency,
        revision: 1,
        onboarding: {
          strategy: body.strategy,
          reviewerEmail: body.reviewerEmail,
          step: 2,
        },
      };
      funds = [...funds, fund];
      states[fund.id] = makeState(fund);
      return { id: fund.id };
    }
    if (path === "/funds/new-fund/documents") {
      const doc = {
        id: "new-doc",
        filename: (body.get("file") as File).name,
        document_type: body.get("documentType"),
        effective_date: body.get("effectiveDate"),
        version: 1,
        status: "NEEDS_REVIEW",
      };
      states["new-fund"].documents = [doc];
      return { id: doc.id };
    }
    if (path === "/funds/new-fund/onboarding/confirm") {
      states["new-fund"].fund.onboarding.step = 4;
      return { ok: true };
    }
    throw new Error(`Unexpected test request ${method} ${path}`);
  });
});
afterEach(cleanup);

describe("restored control room flows", () => {
  it("opens the portfolio and carries the selected fund through Browse and Ask", async () => {
    open("/portfolio");
    await screen.findByRole("heading", { name: "Portfolio" });
    fireEvent.click(screen.getByRole("link", { name: "Other Fund" }));
    await screen.findByRole("heading", { name: "GP Dashboard" });
    expect(screen.getByRole("combobox", { name: "Current fund" })).toHaveValue(
      "other",
    );
    fireEvent.click(screen.getByRole("link", { name: "Ask" }));
    await screen.findByRole("heading", { name: "Fund Brain" });
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/ask?fund=other",
    );
    expect(screen.getByRole("link", { name: "Capital Call" })).toHaveAttribute(
      "href",
      "/settlement?fund=other",
    );
  });
  it("saves a conversation, opens version/page evidence, and restores the same thread", async () => {
    const client = open("/ask?fund=north");
    await screen.findByRole("textbox", { name: "Fund question" });
    fireEvent.change(screen.getByRole("textbox", { name: "Fund question" }), {
      target: { value: "What are the notice requirements?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByText("Fund notice: 10 calendar days.");
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "conversation=thread",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Open source 1: LPA.pdf" }),
    );
    expect(screen.getByTitle("Cited document page")).toHaveAttribute(
      "src",
      "/api/v1/sandbox/funds/north/documents/doc/content#page=3",
    );
    expect(
      screen.getByRole("heading", { name: "LPA.pdf · Version 2" }),
    ).toBeInTheDocument();
    cleanup();
    client.clear();
    open("/ask?fund=north&conversation=thread");
    await screen.findByText("Fund notice: 10 calendar days.");
    fireEvent.change(screen.getByRole("textbox", { name: "Fund question" }), {
      target: { value: "What are total commitments?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/funds/north/questions",
        "POST",
        expect.objectContaining({ conversationId: "thread" }),
      ),
    );
  });
  it("requires documents and a package decision before completing all four onboarding steps", async () => {
    open("/funds/new");
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Fund legal name" }),
      { target: { value: "New Demo Fund" } },
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Reviewer email" }), {
      target: { value: "reviewer@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", {
      name: "Add every governing document",
    });
    expect(
      screen.getByRole("button", { name: "Add a document to continue" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Choose governing documents"), {
      target: {
        files: [
          new File(["synthetic"], "Terms.pdf", { type: "application/pdf" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", {
      name: "Confirm types and precedence",
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Type for Terms.pdf" }),
      { target: { value: "lpa" } },
    );
    fireEvent.change(screen.getByLabelText("Effective date for Terms.pdf"), {
      target: { value: "2026-01-01" },
    });
    expect(
      screen.getByRole("button", { name: "Build the rulebook" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Package review notes"), {
      target: { value: "LPA reviewed; interpretations still pending." },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Build the rulebook" }));
    await screen.findByRole("heading", {
      name: "Your fund brain is ready for review",
    });
    const upload = api.mock.calls.find(
      (c) => c[0] === "/funds/new-fund/documents",
    )![2] as FormData;
    expect(upload.get("documentType")).toBe("lpa");
    expect(upload.get("effectiveDate")).toBe("2026-01-01");
    expect(api).toHaveBeenCalledWith(
      "/funds/new-fund/onboarding/confirm",
      "POST",
      expect.objectContaining({ documentIds: ["new-doc"], revision: 1 }),
    );
    expect(
      screen.getByRole("link", { name: "Open the Fund Brain" }),
    ).toHaveAttribute("href", "/ask?fund=new-fund");
  });
  it("keeps financial arithmetic exact beyond floating point precision", () => {
    expect(decimal(cents("9999999999999999.99") - cents("0.02"))).toBe(
      "9999999999999999.97",
    );
    expect(decimal(cents("10.00") + cents("-3.51"))).toBe("6.49");
  });
});
