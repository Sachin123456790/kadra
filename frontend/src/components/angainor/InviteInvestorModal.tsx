import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { createInvestor } from "@/services/investors.service";
import { QUERY_KEYS } from "@/config/constants";
import { toFriendlyMessage } from "@/lib/errorMessages";

interface InviteInvestorModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly fundId: string;
  readonly onSuccess?: (investorId: string) => void;
}

export function InviteInvestorModal({
  open,
  onOpenChange,
  fundId,
  onSuccess,
}: InviteInvestorModalProps) {
  const queryClient = useQueryClient();
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [taxId, setTaxId] = useState("");

  const reset = () => {
    setLegalName("");
    setEmail("");
    setTaxId("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await createInvestor({
        legalName: legalName.trim(),
        email: email.trim(),
        taxId: taxId.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(
        "Investor added — they can sign up using this email",
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.investors(fundId) });
      onSuccess?.(data.investorId);
      reset();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(toFriendlyMessage(err));
    },
  });

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const canSubmit =
    legalName.trim().length > 0 &&
    email.trim().length > 0 &&
    !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Invite Investor</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create an investor record. They can sign up using this email to
            access the investor portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="legal-name" className="text-sm font-medium text-muted-foreground">
              Legal Name
            </Label>
            <Input
              id="legal-name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Alpine Capital Partners"
              className="mt-1"
              autoComplete="off"
            />
          </div>

          <div>
            <Label htmlFor="invite-email" className="text-sm font-medium text-muted-foreground">
              Email
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="investor@example.com"
              className="mt-1"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The investor's portal account will be linked when they sign up
              with this email.
            </p>
          </div>

          <div>
            <Label htmlFor="tax-id" className="text-sm font-medium text-muted-foreground">
              Tax ID <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="tax-id"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="EIN / TIN"
              className="mt-1"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Adding..." : "Add Investor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
