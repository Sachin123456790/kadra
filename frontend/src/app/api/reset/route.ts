import { NextResponse } from "next/server";
import { getProvider } from "@/lib/provider";
import { resetState, addLog } from "@/lib/state";

export async function POST() {
  try {
    // Reset the Hardhat node to a clean state
    const provider = getProvider();
    await provider.send("hardhat_reset", []);

    // Reset in-memory state
    resetState();
    addLog("RESET", "Blockchain and application state reset to clean slate", "info");

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
