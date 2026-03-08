import { ExternalLink } from "lucide-react";

const BASESCAN_URL = "https://sepolia.basescan.org";

type ExplorerType = "address" | "tx";

interface ExplorerLinkProps {
  readonly value: string;
  readonly type: ExplorerType;
  readonly truncate?: boolean;
  readonly className?: string;
}

function truncateHex(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 6)}...${hex.slice(-4)}`;
}

function getExplorerUrl(value: string, type: ExplorerType): string {
  return `${BASESCAN_URL}/${type}/${value}`;
}

export function ExplorerLink({
  value,
  type,
  truncate = true,
  className = "",
}: ExplorerLinkProps) {
  if (!value || value === "—") return <span className={className}>—</span>;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="font-mono text-xs">
        {truncate ? truncateHex(value) : value}
      </span>
      <a
        href={getExplorerUrl(value, type)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 hover:text-indigo-800 inline-flex"
        title={`View on BaseScan: ${value}`}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </span>
  );
}
