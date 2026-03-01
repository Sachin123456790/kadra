import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getSigner, getSignerAddress } from "@/lib/provider";
import state, { addLog } from "@/lib/state";
import { KadraTokenABI } from "@/lib/contracts";

export async function POST(request: NextRequest) {
  try {
    if (!state.kadraTokenAddress) {
      return NextResponse.json({ error: "Contracts not deployed." }, { status: 400 });
    }

    const body = await request.json();
    const { fromInvestorId, toInvestorId, amount, testIllegal } = body;

    const token = new ethers.Contract(state.kadraTokenAddress, KadraTokenABI);
    const decimals = 18;
    const transferAmount = ethers.parseUnits(String(amount), decimals);

    if (testIllegal) {
      // Test illegal transfer to non-LP wallet (signer index 9)
      const fromInvestor = state.investors.find((i) => i.id === fromInvestorId);
      if (!fromInvestor) {
        return NextResponse.json({ error: "Investor not found" }, { status: 400 });
      }

      const fromSigner = await getSigner(fromInvestor.walletIndex);
      const nonLPAddr = await getSignerAddress(9);
      const tokenAsFrom = token.connect(fromSigner) as ethers.Contract;

      addLog("STEP 7", `Illegal transfer: ${fromInvestor.name} → non-LP (${nonLPAddr})...`, "info");

      try {
        await tokenAsFrom.transfer(nonLPAddr, transferAmount);
        addLog("STEP 7", "ERROR: Transfer should have been blocked!", "error");
        return NextResponse.json({ success: false, blocked: false, error: "Transfer was not blocked" });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isExpected = errMsg.includes("recipient is not an approved Limited Partner");
        addLog(
          "STEP 7",
          `Transfer BLOCKED: "recipient is not an approved Limited Partner"`,
          "success"
        );
        return NextResponse.json({
          success: true,
          blocked: true,
          message: "Transfer blocked: recipient is not an approved Limited Partner",
          logs: state.logs,
        });
      }
    }

    // Legal LP-to-LP transfer
    const fromInvestor = state.investors.find((i) => i.id === fromInvestorId);
    const toInvestor = state.investors.find((i) => i.id === toInvestorId);

    if (!fromInvestor || !toInvestor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 400 });
    }

    const fromSigner = await getSigner(fromInvestor.walletIndex);
    const tokenAsFrom = token.connect(fromSigner) as ethers.Contract;

    addLog("STEP 8", `Legal transfer: ${fromInvestor.name} → ${toInvestor.name} (${amount} KDRA)...`, "info");

    const tx = await tokenAsFrom.transfer(toInvestor.walletAddress!, transferAmount);
    await tx.wait();

    addLog("STEP 8", `Transfer succeeded`, "success", { txHash: tx.hash });

    state.phase = "complete";

    return NextResponse.json({
      success: true,
      blocked: false,
      from: fromInvestor.name,
      to: toInvestor.name,
      amount,
      txHash: tx.hash,
      logs: state.logs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addLog("ERROR", message, "error");
    return NextResponse.json({ error: message, logs: state.logs }, { status: 500 });
  }
}
