import { NextResponse } from "next/server";
import state from "@/lib/state";

export async function GET() {
  return NextResponse.json({
    phase: state.phase,
    contracts: {
      identityRegistry: state.identityRegistryAddress,
      documentRegistry: state.documentRegistryAddress,
      kadraToken: state.kadraTokenAddress,
    },
    fundName: state.fundName,
    lpaHash: state.lpaHash,
    lpaFileName: state.lpaFileName,
    investors: state.investors,
    subscriptions: state.subscriptions,
    logs: state.logs,
  });
}
