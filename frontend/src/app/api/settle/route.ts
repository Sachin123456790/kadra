import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { getSigner } from "@/lib/provider";
import state, { addLog } from "@/lib/state";
import { KadraTokenABI } from "@/lib/contracts";

const WIRES = [
  { investorId: "investor-A", amount: "1000000", reference: "WIRE-A-001" },
  { investorId: "investor-B", amount: "1000000", reference: "WIRE-B-001" },
  { investorId: "investor-C", amount: "1000000", reference: "WIRE-C-001" },
  { investorId: "investor-D", amount: "1000000", reference: "WIRE-D-001" },
  { investorId: "investor-E", amount: "1000000", reference: "WIRE-E-001" },
];

export async function POST() {
  try {
    if (!state.kadraTokenAddress || !state.lpaHash) {
      return NextResponse.json({ error: "Contracts not deployed or LPA not uploaded." }, { status: 400 });
    }

    if (state.phase === "settled" || state.phase === "complete") {
      return NextResponse.json({ error: "Already settled." }, { status: 400 });
    }

    const deployer = await getSigner(0);
    const token = new ethers.Contract(state.kadraTokenAddress, KadraTokenABI, deployer);
    const decimals = await token.decimals();
    const sharesPerInvestor = 2000n;
    const mintAmount = sharesPerInvestor * (10n ** BigInt(decimals));

    addLog("STEP 6", "Processing wire confirmations (off-chain settlement)...", "info");
    addLog("STEP 6", "NOTE: Payments are settled OFF-CHAIN. Wires are parsed to confirm payment.", "warning");

    const results = [];

    for (const wire of WIRES) {
      const sub = state.subscriptions.find((s) => s.investorId === wire.investorId);
      if (!sub) {
        addLog("STEP 6", `SKIP: No subscription for ${wire.investorId}`, "warning");
        continue;
      }

      // 3-way match validation
      const errors: string[] = [];
      if (sub.status !== "pending") {
        errors.push(`Already ${sub.status} — no double settlement`);
      }
      if (sub.capitalCommitted !== wire.amount) {
        errors.push(`Amount mismatch: expected ${sub.capitalCommitted}, got ${wire.amount}`);
      }
      if (sub.lpaHash !== state.lpaHash) {
        errors.push(`Document reference mismatch`);
      }

      if (errors.length > 0) {
        addLog("STEP 6", `${wire.investorId}: FAILED — ${errors.join(", ")}`, "error");
        results.push({ investorId: wire.investorId, valid: false, errors });
        continue;
      }

      // Settle subscription
      sub.status = "settled";
      sub.settledAt = new Date().toISOString();

      // Mint tokens
      const investor = state.investors.find((i) => i.id === wire.investorId);
      if (investor?.walletAddress) {
        const tx = await token.mint(investor.walletAddress, mintAmount);
        await tx.wait();
      }

      addLog(
        "STEP 6",
        `${wire.investorId}: Wire $${wire.amount} validated → settled → ${ethers.formatUnits(mintAmount, decimals)} KDRA minted`,
        "success"
      );
      results.push({ investorId: wire.investorId, valid: true, tokensAmount: ethers.formatUnits(mintAmount, decimals) });
    }

    state.phase = "settled";

    return NextResponse.json({
      success: true,
      results,
      subscriptions: state.subscriptions,
      logs: state.logs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addLog("ERROR", message, "error");
    return NextResponse.json({ error: message, logs: state.logs }, { status: 500 });
  }
}
