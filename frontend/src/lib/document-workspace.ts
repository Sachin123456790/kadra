import {
  GOVERNING_DOCUMENT_TYPE_OPTIONS,
  type FundDocument,
} from "@/services/documents.service";

/** Preserve the governing-document review scope when searching or selecting. */
export function isWorkspaceDocument(document: FundDocument): boolean {
  return (
    !document.documentType ||
    GOVERNING_DOCUMENT_TYPE_OPTIONS.some(
      (option) => option.value === document.documentType,
    )
  );
}
