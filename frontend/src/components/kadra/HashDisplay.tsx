import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface HashDisplayProps {
  /** The full hash or address string */
  readonly value: string | null | undefined;
  /** Placeholder shown when value is empty */
  readonly fallback?: string;
  readonly className?: string;
}

function truncateHex(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 6)}...${hex.slice(-4)}`;
}

/**
 * Icon-only hash/address display.
 * Hidden by default — eye icon reveals truncated value, copy icon copies full value.
 * Used for wallet addresses, tx hashes, document hashes, etc.
 */
export function HashDisplay({
  value,
  fallback = "—",
  className = "",
}: HashDisplayProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!value || value === "—") {
    return <span className={`text-gray-500 ${className}`}>{fallback}</span>;
  }

  const handleCopy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {revealed && (
        <span className="font-mono text-xs text-gray-500">
          {truncateHex(value)}
        </span>
      )}

      <button
        type="button"
        onClick={() => {
          if (revealed) {
            handleCopy();
          } else {
            setRevealed(true);
          }
        }}
        className="text-gray-400 hover:text-gray-600 transition-colors inline-flex"
        title={revealed ? `Copy: ${value}` : "Reveal"}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : revealed ? (
          <Copy className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>

      {revealed && (
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors inline-flex"
          title="Hide"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}
