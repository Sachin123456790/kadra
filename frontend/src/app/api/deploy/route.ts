import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { getProvider, getSigner, getSignerAddress } from "@/lib/provider";
import state, { addLog } from "@/lib/state";
import {
  IdentityRegistryABI,
  IdentityRegistryBytecode,
  DocumentRegistryABI,
  DocumentRegistryBytecode,
  KadraTokenABI,
  KadraTokenBytecode,
} from "@/lib/contracts";

export async function POST() {
  try {
    // Check if Hardhat node is reachable
    const provider = getProvider();
    try {
      await provider.getBlockNumber();
    } catch {
      return NextResponse.json(
        { error: "Hardhat node not running. Start it with: npx hardhat node" },
        { status: 503 }
      );
    }

    const deployer = await getSigner(0);
    const deployerAddr = await deployer.getAddress();

    addLog("STEP 1", `Deployer: ${deployerAddr}`, "info");
    addLog("STEP 1", "Deploying smart contracts...", "info");

    // Deploy IdentityRegistry
    const identityFactory = new ethers.ContractFactory(IdentityRegistryABI, IdentityRegistryBytecode, deployer);
    const identityRegistry = await identityFactory.deploy();
    await identityRegistry.waitForDeployment();
    const identityAddr = await identityRegistry.getAddress();
    state.identityRegistryAddress = identityAddr;
    addLog("STEP 1", `IdentityRegistry deployed: ${identityAddr}`, "success");

    // Deploy DocumentRegistry
    const docFactory = new ethers.ContractFactory(DocumentRegistryABI, DocumentRegistryBytecode, deployer);
    const documentRegistry = await docFactory.deploy();
    await documentRegistry.waitForDeployment();
    const docAddr = await documentRegistry.getAddress();
    state.documentRegistryAddress = docAddr;
    addLog("STEP 1", `DocumentRegistry deployed: ${docAddr}`, "success");

    // Deploy KadraToken
    const tokenFactory = new ethers.ContractFactory(KadraTokenABI, KadraTokenBytecode, deployer);
    const kadraToken = await tokenFactory.deploy(state.fundName, "KDRA", identityAddr);
    await kadraToken.waitForDeployment();
    const tokenAddr = await kadraToken.getAddress();
    state.kadraTokenAddress = tokenAddr;
    addLog("STEP 1", `KadraToken deployed: ${tokenAddr}`, "success");

    state.phase = "deployed";

    // Step 2: Create fund entity
    addLog("STEP 2", `Fund created: ${state.fundName} (LP, US-DE)`, "info");
    addLog("STEP 2", "Waterfall: Pref 8%, IRR 12%, GP 20% (display-only)", "info");

    // Step 3: Register investors
    addLog("STEP 3", "Registering investors in IdentityRegistry...", "info");
    const registry = new ethers.Contract(identityAddr, IdentityRegistryABI, deployer);

    for (const inv of state.investors) {
      const addr = await getSignerAddress(inv.walletIndex);
      inv.walletAddress = addr;

      const tx1 = await registry.addInvestor(addr);
      await tx1.wait();
      const tx2 = await registry.setEligibility(addr, true);
      await tx2.wait();

      inv.eligible = true;
      addLog("STEP 3", `${inv.name} (${inv.id}): ${addr} — eligible`, "success");
    }

    state.phase = "investors_registered";

    return NextResponse.json({
      success: true,
      contracts: {
        identityRegistry: identityAddr,
        documentRegistry: docAddr,
        kadraToken: tokenAddr,
      },
      investors: state.investors,
      logs: state.logs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addLog("ERROR", message, "error");
    return NextResponse.json({ error: message, logs: state.logs }, { status: 500 });
  }
}
