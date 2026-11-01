import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEFAULT_FUND_CODE, QUERY_KEYS } from "@/config/constants";
import { getDocuments } from "@/services";
import { isWorkspaceDocument } from "@/lib/document-workspace";

interface Destination {
  label: string;
  path: string;
}

export function WorkspaceSearch({
  destinations,
  isAdmin,
}: {
  destinations: Destination[];
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const {
    data: documents,
    isLoading,
    isError,
  } = useQuery({
    queryKey: QUERY_KEYS.documents(DEFAULT_FUND_CODE),
    queryFn: () => getDocuments(DEFAULT_FUND_CODE).then((r) => r.data),
    enabled: open && isAdmin,
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const normalized = query.trim().toLowerCase();
  const pages = destinations.filter((item) =>
    item.label.toLowerCase().includes(normalized),
  );
  const matches = isAdmin
    ? (documents ?? [])
        .filter(isWorkspaceDocument)
        .filter((doc) =>
          `${doc.originalFilename} ${doc.documentType}`
            .toLowerCase()
            .includes(normalized),
        )
    : [];
  const go = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };
  return (
    <>
      <button
        className="workspace-search"
        onClick={() => setOpen(true)}
        aria-label="Search workspace"
      >
        <Search size={14} />
        <span className="hidden sm:inline">Search workspace</span>
        <kbd className="hidden sm:inline">⌘ K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Search workspace</DialogTitle>
            <DialogDescription>
              Find a page or a document by name in your current fund.
            </DialogDescription>
          </DialogHeader>
          <input
            aria-label="Search pages and document names"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages and document names…"
            className="w-full rounded-md border bg-background p-3 text-sm"
          />
          <div className="max-h-[55vh] overflow-y-auto space-y-4">
            {pages.length > 0 && (
              <section>
                <p className="workspace-eyebrow mb-2">Pages</p>
                {pages.map((item) => (
                  <button
                    key={item.path}
                    className="workspace-result"
                    onClick={() => go(item.path)}
                  >
                    <Search size={15} />
                    {item.label}
                  </button>
                ))}
              </section>
            )}
            {isAdmin && (
              <section>
                <p className="workspace-eyebrow mb-2">Documents</p>
                {isLoading && (
                  <p className="text-sm text-muted-foreground">
                    Loading documents…
                  </p>
                )}
                {isError && (
                  <p role="alert" className="text-sm text-destructive">
                    Documents could not be loaded. Try again from Documents.
                  </p>
                )}
                {matches.map((doc) => (
                  <button
                    key={doc.documentId}
                    className="workspace-result"
                    onClick={() =>
                      go(
                        `/documents?document=${encodeURIComponent(doc.documentId)}`,
                      )
                    }
                  >
                    <FileText size={15} />
                    <span className="truncate">{doc.originalFilename}</span>
                  </button>
                ))}
              </section>
            )}
            {pages.length === 0 &&
              matches.length === 0 &&
              !isLoading &&
              !isError && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No matching pages or documents.
                </p>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
