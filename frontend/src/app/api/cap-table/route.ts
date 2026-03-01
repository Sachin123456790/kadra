import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { getProvider } from "@/lib/provider";
import state, { addLog } from "@/lib/state";
import { KadraTokenABI } from "@/lib/contracts";

export async function GET() {
  try {
    if (!state.kadraTokenAddress) {
      return NextResponse.json({
        success: true,
        capTable: [],
        totalSupply: "0",
        fundName: state.fundName,
      });
    }

    const provider = getProvider();
    const token = new ethers.Contract(state.kadraTokenAddress, KadraTokenABI, provider);
    const decimals = await token.decimals();
    const totalSupply = await token.totalSupply();

    const capTable = [];
    for (const inv of state.investors) {
      if (!inv.walletAddress) continue;

      const balance = await token.balanceOf(inv.walletAddress);
      const pct = totalSupply > 0n ? Number((balance * 10000n) / totalSupply) / 100 : 0;
      const sub = state.subscriptions.find((s) => s.investorId === inv.id);

      capTable.push({
        investorId: inv.id,
        name: inv.name,
        walletAddress: inv.walletAddress,
        tokenBalance: ethers.formatUnits(balance, decimals),
        ownershipPercent: pct,
        status: sub?.status ?? "not_subscribed",
        eligible: inv.eligible,
      });
    }

    return NextResponse.json({
      success: true,
      capTable,
      totalSupply: ethers.formatUnits(totalSupply, decimals),
      fundName: state.fundName,
      tokenAddress: state.kadraTokenAddress,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
