export const base = "/api/v1/sandbox";
export async function request<T = any>(
  path: string,
  method = "GET",
  body?: any,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET") headers["Idempotency-Key"] = crypto.randomUUID();
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method,
    credentials: "same-origin",
    headers,
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.error?.message || data.message || "Request failed"),
      { status: response.status, code: data.error?.code || data.code },
    );
  return data;
}
export function download(
  filename: string,
  content: string,
  mime = "text/plain",
) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function currency(value: unknown) {
  const input =
    typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(2)
      : String(value ?? "0");
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(input);
  if (!match) return "Unavailable";
  return `${match[1]}$${BigInt(match[2]).toLocaleString("en-US")}.${(match[3] || "").padEnd(2, "0")}`;
}
export const today = () => new Date().toISOString().slice(0, 10);
