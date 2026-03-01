import crypto from "crypto";

export function hashBuffer(buffer: Buffer): { hash: string; algorithm: string; size: number } {
  const hash = "0x" + crypto.createHash("sha256").update(buffer).digest("hex");
  return { hash, algorithm: "sha256", size: buffer.length };
}
