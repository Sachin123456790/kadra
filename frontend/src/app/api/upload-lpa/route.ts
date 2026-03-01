import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getSigner } from "@/lib/provider";
import { hashBuffer } from "@/lib/hash";
import state, { addLog } from "@/lib/state";
import { DocumentRegistryABI } from "@/lib/contracts";

export async function POST(request: NextRequest) {
  try {
    if (!state.documentRegistryAddress) {
      return NextResponse.json({ error: "Contracts not deployed. Run deploy first." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    addLog("STEP 4", `Received file: ${file.name} (${file.size} bytes)`, "info");

    // Hash the file
    const buffer = Buffer.from(await file.arrayBuffer());
    const { hash, algorithm, size } = hashBuffer(buffer);

    addLog("STEP 4", `SHA-256 hash: ${hash}`, "info");
    addLog("STEP 4", `Algorithm: ${algorithm}, Size: ${size} bytes`, "info");

    // Anchor on-chain
    const deployer = await getSigner(0);
    const docRegistry = new ethers.Contract(state.documentRegistryAddress, DocumentRegistryABI, deployer);

    // Convert hash to bytes32
    const hashBytes32 = ethers.zeroPadValue(hash, 32);

    const tx = await docRegistry.registerDocument(hashBytes32, "MASTER_LPA");
    const receipt = await tx.wait();
    const exists = await docRegistry.documentExists(hashBytes32);

    addLog("STEP 4", `Document anchored on-chain: ${exists}`, "success", {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    });

    state.lpaHash = hash;
    state.lpaFileName = file.name;
    state.phase = "lpa_anchored";

    // Step 5: Create subscription records
    addLog("STEP 5", "Creating subscription records...", "info");
    let subIndex = 1;
    for (const inv of state.investors) {
      const subId = `sub-${String(subIndex).padStart(3, "0")}`;
      state.subscriptions.push({
        id: subId,
        investorId: inv.id,
        investorName: inv.name,
        walletAddress: inv.walletAddress!,
        allocationPercent: 20,
        capitalCommitted: "1000000",
        lpaHash: hash,
        fundName: state.fundName,
        status: "pending",
        createdAt: new Date().toISOString(),
        settledAt: null,
      });
      addLog("STEP 5", `${subId}: ${inv.name} — 20% ($1,000,000) — pending`, "success");
      subIndex++;
    }

    state.phase = "subscriptions_created";

    return NextResponse.json({
      success: true,
      lpaHash: hash,
      fileName: file.name,
      fileSize: size,
      onChainVerified: exists,
      subscriptions: state.subscriptions,
      logs: state.logs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addLog("ERROR", message, "error");
    return NextResponse.json({ error: message, logs: state.logs }, { status: 500 });
  }
}
