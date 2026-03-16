import { useState } from "react";
import { ExternalLink, Eye, EyeOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const ETHERSCAN_URL = "https://sepolia.etherscan.io";

type ExplorerType = "address" | "tx";

interface ExplorerLinkProps {
  readonly value: string;
  readonly type: ExplorerType;
  /** @deprecated — text is now hidden by default; kept for backward compat */
  readonly truncate?: boolean;
  readonly className?: string;
  /** Optional label shown instead of icons (e.g. "View") */
  readonly label?: string;
}

function truncateHex(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 6)}...${hex.slice(-4)}`;
}

function getExplorerUrl(value: string, type: ExplorerType): string {
  return `${ETHERSCAN_URL}/${type}/${value}`;
}

export function ExplorerLink({
  value,
  type,
  className = "",
  label,
}: ExplorerLinkProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!value || value === "—") return <span className={className}>—</span>;

  const handleCopy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* Revealed hash text */}
      {revealed && (
        <span className="font-mono text-xs text-muted-foreground">
          {truncateHex(value)}
        </span>
      )}

      {/* Eye icon — toggle reveal + copy */}
      <button
        type="button"
        onClick={() => {
          if (revealed) {
            handleCopy();
          } else {
            setRevealed(true);
          }
        }}
        className="text-muted-foreground hover:text-foreground transition-colors inline-flex"
        title={revealed ? `Copy: ${value}` : "Reveal hash"}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : revealed ? (
          <Copy className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Close / hide when revealed */}
      {revealed && (
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="text-muted-foreground hover:text-foreground transition-colors inline-flex"
          title="Hide"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      )}

      {/* External link icon */}
      <a
        href={getExplorerUrl(value, type)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 hover:text-indigo-800 inline-flex"
        title={`View on Etherscan`}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      {/* Optional text label */}
      {label && (
        <a
          href={getExplorerUrl(value, type)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-600 hover:text-indigo-800"
        >
          {label}
        </a>
      )}
    </span>
  );
}
