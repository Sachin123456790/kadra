import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importOffChainTransfer } from "@/services/investor-portal.service";
import { QUERY_KEYS } from "@/config/constants";
import { toFriendlyMessage } from "@/lib/errorMessages";
import type { InvestorCapTableRow } from "@/services/investor-portal.service";

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly fundId: string;
  readonly senderInvestorId: string | null;
  readonly senderTokenBalance: string;
  readonly capTableRows: readonly InvestorCapTableRow[];
}

export function ImportOffChainTransferModal({
  open,
  onOpenChange,
  fundId,
  senderInvestorId,
  senderTokenBalance,
  capTableRows,
}: Props) {
  const queryClient = useQueryClient();
  const [toInvestorId, setToInvestorId] = useState<string>("");
  const [tokenAmount, setTokenAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) {
      setToInvestorId("");
      setTokenAmount("");
      setNote("");
      setFile(null);
    }
  }, [open]);

  const recipientOptions = useMemo(() => {
    return capTableRows.filter(
      (r) =>
        r.investorId !== null &&
        r.investorId !== senderInvestorId &&
        r.investorName,
    );
  }, [capTableRows, senderInvestorId]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Upload a wire/receipt PDF");
      const amt = Number(tokenAmount);
      if (!Number.isFinite(amt) || amt <= 0) {
        throw new Error("Enter a valid token amount");
      }
      if (!toInvestorId) throw new Error("Pick a recipient");
      return importOffChainTransfer({
        toInvestorId,
        tokenAmount: amt,
        note: note.trim() || undefined,
        file,
        fundId,
      });
    },
    onSuccess: (res) => {
      toast.success(
        `Recorded ${res.data.tokenAmount} tokens to ${res.data.toInvestor.legalName}`,
      );
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.investorTransfers(fundId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.investorCapTable(fundId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.investorDashboard(fundId),
      });
      onOpenChange(false);
    },
    onError: (err) => toast.error(toFriendlyMessage(err)),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const isReady =
    toInvestorId &&
    tokenAmount &&
    Number(tokenAmount) > 0 &&
    file !== null &&
    !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import off-chain transfer
          </DialogTitle>
          <DialogDescription>
            Upload a signed wire/receipt PDF to record an off-chain transfer
            of fund ownership. The cap table updates immediately. No on-chain
            transaction, no eligibility checks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="recipient">Recipient</Label>
            <Select value={toInvestorId} onValueChange={setToInvestorId}>
              <SelectTrigger id="recipient">
                <SelectValue placeholder="Select an investor" />
              </SelectTrigger>
              <SelectContent>
                {recipientOptions.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No other investors available
                  </SelectItem>
                ) : (
                  recipientOptions.map((r) => (
                    <SelectItem key={r.investorId ?? ""} value={r.investorId ?? ""}>
                      {r.investorName ?? r.walletAddress}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tokenAmount">Token amount</Label>
            <Input
              id="tokenAmount"
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 500"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Your current balance: {senderTokenBalance} units
            </p>
          </div>

          <div>
            <Label htmlFor="evidence">Wire / receipt PDF</Label>
            <Input
              id="evidence"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
            />
            {file && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              placeholder="e.g. Quarterly LP rebalance"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!isReady}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recording…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Record transfer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
